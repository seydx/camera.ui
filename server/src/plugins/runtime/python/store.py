from __future__ import annotations

import asyncio
import math
import os
import shutil
import sys
import time
import zlib
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Protocol

import msgpack

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

STORE_FILE_NAME = "store.cui"
_JOURNAL_SUFFIX = ".journal"

_MAGIC = b"CUI1"
_MAX_SAFE_INTEGER = 2**53 - 1
_RENAME_RETRY_DELAYS_MS = (10, 25, 60, 150, 300)
_IS_WINDOWS = sys.platform == "win32"


class StoreLogger(Protocol):
    def debug(self, message: str, /) -> None: ...

    def warn(self, message: str, /) -> None: ...

    def error(self, message: str, /) -> None: ...


class StoreCorruptError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(f"store envelope: {message}")


def encode_envelope(payload: dict[str, Any]) -> bytes:
    body: bytes = msgpack.packb(payload, use_bin_type=True)
    return _MAGIC + body + zlib.crc32(body).to_bytes(4, "little")


def decode_envelope(buf: bytes) -> dict[str, Any]:
    if len(buf) < len(_MAGIC) + 4 or buf[: len(_MAGIC)] != _MAGIC:
        raise StoreCorruptError("bad magic")

    body = buf[len(_MAGIC) : -4]
    if zlib.crc32(body) != int.from_bytes(buf[-4:], "little"):
        raise StoreCorruptError("crc mismatch")

    try:
        payload = msgpack.unpackb(body, raw=False, strict_map_key=False)
    except Exception as error:
        raise StoreCorruptError(f"payload decode failed: {error}") from error

    if not isinstance(payload, dict):
        raise StoreCorruptError("payload is not a map")

    return payload


def _replace_with_retry(tmp_path: str, path: str) -> None:
    for attempt, delay_ms in enumerate(_RENAME_RETRY_DELAYS_MS):
        try:
            os.replace(tmp_path, path)
            return
        except PermissionError:
            # windows AV and the search indexer briefly hold the rename target, retry only there
            if not _IS_WINDOWS or attempt >= len(_RENAME_RETRY_DELAYS_MS) - 1:
                raise
            time.sleep(delay_ms / 1000)


def _write_store_file_sync(path: str, buf: bytes) -> None:
    tmp_path = f"{path}.tmp-{os.getpid()}"
    try:
        try:
            fd = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
        except FileNotFoundError:
            # a restore or cleanup can remove the volume under a running plugin, recreate it
            os.makedirs(os.path.dirname(path), exist_ok=True)
            fd = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
        try:
            os.write(fd, buf)
            os.fsync(fd)
        finally:
            os.close(fd)
        _replace_with_retry(tmp_path, path)
    except Exception:
        with suppress(OSError):
            os.unlink(tmp_path)
        raise


async def write_store_file(path: str, payload: dict[str, Any], log: StoreLogger | None = None) -> None:
    buf = encode_envelope(payload)

    try:
        await asyncio.to_thread(_write_store_file_sync, path, buf)
    except Exception as error:
        if log:
            log.error(f"store: write {path} failed: {error}")
        raise


def _read_bytes(path: str) -> bytes | None:
    try:
        return Path(path).read_bytes()
    except FileNotFoundError:
        return None


async def read_store_file(path: str, log: StoreLogger | None = None) -> dict[str, Any] | None:
    buf = await asyncio.to_thread(_read_bytes, path)
    if buf is None:
        return None

    try:
        payload = decode_envelope(buf)
        return payload
    except StoreCorruptError as error:
        if log:
            log.error(f"store: {path} is corrupt ({error}) — trying backup")

    bak_path = f"{path}.bak"
    try:
        bak_buf = await asyncio.to_thread(Path(bak_path).read_bytes)
    except OSError:
        bak_buf = None

    if bak_buf is not None:
        try:
            payload = decode_envelope(bak_buf)
        except StoreCorruptError as error:
            if log:
                log.error(f"store: backup {bak_path} is corrupt too ({error})")
        else:
            # replace the corrupt file now, the next backup refresh would overwrite the only good copy
            await asyncio.to_thread(_write_store_file_sync, path, bak_buf)
            if log:
                log.warn(f"store: recovered {path} from backup ({len(bak_buf)} bytes)")
            return payload

    # a corrupt store must never become an empty one, recover from .bak or fail the open
    raise StoreCorruptError(f"{path} unreadable and no usable backup")


def _backup_store_file_sync(path: str) -> None:
    # copy via a temp file, a crash mid-copy must not truncate .bak, it may be the only good copy
    tmp_path = f"{path}.bak.tmp-{os.getpid()}"
    try:
        shutil.copyfile(path, tmp_path)
        _replace_with_retry(tmp_path, f"{path}.bak")
    except Exception:
        with suppress(OSError):
            os.unlink(tmp_path)
        raise


async def backup_store_file(path: str, log: StoreLogger | None = None) -> None:
    try:
        await asyncio.to_thread(_backup_store_file_sync, path)
    except FileNotFoundError:
        return
    except OSError as error:
        if log:
            log.warn(f"store: backup for {path} failed: {error}")
        return


class _PendingFlush:
    __slots__ = ("future", "snapshot")

    def __init__(self, snapshot: dict[str, Any], future: asyncio.Future[None]) -> None:
        self.snapshot = snapshot
        self.future = future


class CoalescingWriter:
    def __init__(
        self,
        flush: Callable[[dict[str, Any]], Awaitable[None]],
        log: StoreLogger | None = None,
    ) -> None:
        self._flush = flush
        self._log = log
        self._in_flight: asyncio.Task[None] | None = None
        self._pending: _PendingFlush | None = None

    def write(self, snapshot: dict[str, Any]) -> Awaitable[None]:
        if self._in_flight is None:
            self._in_flight = asyncio.ensure_future(self._run(snapshot))
            return self._in_flight

        if self._pending is not None:
            self._pending.snapshot = snapshot
            return self._pending.future

        self._pending = _PendingFlush(snapshot, asyncio.get_running_loop().create_future())
        return self._pending.future

    async def idle(self) -> None:
        while (in_flight := self._in_flight) is not None:
            try:
                await in_flight
            except asyncio.CancelledError:
                # re-raise only our own cancellation, a cancelled flush must not abort the drain
                if not in_flight.cancelled():
                    raise
            except Exception:
                pass

    async def _run(self, snapshot: dict[str, Any]) -> None:
        try:
            await self._flush(snapshot)
        finally:
            pending = self._pending
            self._pending = None

            if pending is not None:
                task = asyncio.ensure_future(self._run(pending.snapshot))
                task.add_done_callback(_settler(pending.future))
                self._in_flight = task
            else:
                self._in_flight = None


def _settler(future: asyncio.Future[None]) -> Callable[[asyncio.Task[None]], None]:
    def settle(task: asyncio.Task[None]) -> None:
        if future.done():
            return
        if task.cancelled():
            future.cancel()
        elif (error := task.exception()) is not None:
            future.set_exception(error)
        else:
            future.set_result(None)

    return settle


@dataclass(frozen=True)
class PluginLocation:
    pass


@dataclass(frozen=True)
class CameraLocation:
    camera_id: str


@dataclass(frozen=True)
class SensorLocation:
    sensor_id: str


StoreLocation = PluginLocation | CameraLocation | SensorLocation


def read_location(config: dict[str, Any], location: StoreLocation) -> dict[str, Any] | None:
    if isinstance(location, PluginLocation):
        return config.get("plugin")
    if isinstance(location, CameraLocation):
        return (config.get("cameras") or {}).get(location.camera_id)
    return (config.get("sensors") or {}).get(location.sensor_id)


def write_location(config: dict[str, Any], location: StoreLocation, values: dict[str, Any]) -> None:
    if isinstance(location, PluginLocation):
        config["plugin"] = values
        return
    if isinstance(location, CameraLocation):
        config.setdefault("cameras", {})[location.camera_id] = values
        return
    config.setdefault("sensors", {})[location.sensor_id] = values


def delete_location(config: dict[str, Any], location: StoreLocation) -> None:
    if isinstance(location, PluginLocation):
        config.pop("plugin", None)
        return

    if isinstance(location, CameraLocation):
        cameras = config.get("cameras")
        if isinstance(cameras, dict):
            cameras.pop(location.camera_id, None)
        _prune_if_empty(config, "cameras")
        return

    sensors = config.get("sensors")
    if isinstance(sensors, dict):
        sensors.pop(location.sensor_id, None)
    _prune_if_empty(config, "sensors")


def _prune_if_empty(parent: dict[str, Any], key: str) -> None:
    child = parent.get(key)
    if isinstance(child, dict) and not child:
        del parent[key]


_LAYOUT_VERSION_KEY = "__v"
# v2 keys sensors by persistent sensor id, older camera-keyed trees can't be mapped
_LAYOUT_VERSION = 2


def upgrade_layout(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get(_LAYOUT_VERSION_KEY) == _LAYOUT_VERSION:
        return payload

    upgraded = dict(payload)
    upgraded.pop("sensors", None)
    upgraded[_LAYOUT_VERSION_KEY] = _LAYOUT_VERSION
    return upgraded


def validate_store_value(key: str, value: Any) -> None:
    _walk_value(value, key, 0)


_MAX_VALUE_DEPTH = 64


def _walk_value(value: Any, path: str, depth: int) -> None:
    # catches circular references before a RecursionError
    if depth > _MAX_VALUE_DEPTH:
        raise ValueError(
            f"store: value at '{path}' exceeds {_MAX_VALUE_DEPTH} nesting levels — circular reference?"
        )
    # bool is an int subclass, check it before int
    if value is None or isinstance(value, bool | str):
        return

    if isinstance(value, int):
        if abs(value) > _MAX_SAFE_INTEGER:
            raise ValueError(f"store: value at '{path}' exceeds the float64-safe integer range (±2^53)")
        return

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f"store: value at '{path}' is {value} — NaN/Infinity are not storable")
        return

    if isinstance(value, bytes | bytearray | memoryview):
        raise ValueError(
            f"store: value at '{path}' is binary — large artifacts belong in files under the plugin storage dir"
        )

    if isinstance(value, list | tuple):
        for index, entry in enumerate(value):
            _walk_value(entry, f"{path}[{index}]", depth + 1)
        return

    if isinstance(value, dict):
        for key, entry in value.items():
            if not isinstance(key, str):
                raise ValueError(f"store: map key {key!r} at '{path}' is not a string")
            _walk_value(entry, f"{path}.{key}", depth + 1)
        return

    raise ValueError(
        f"store: value at '{path}' is a {type(value).__name__} instance — only plain objects are storable"
    )


class PluginStoreFile:
    def __init__(self, volume_dir: str, log: StoreLogger | None = None) -> None:
        self._volume_dir = volume_dir
        self._log = log
        self._path = str(Path(volume_dir) / STORE_FILE_NAME)
        self._journal_path = f"{self._path}{_JOURNAL_SUFFIX}"
        self._writer = CoalescingWriter(self._write_snapshot, log)
        self._payload: dict[str, Any] = {}
        self._closed = True
        self._seq = 0
        self._journaled = False
        self._detached: set[asyncio.Task[None]] = set()

    @property
    def path(self) -> str:
        return self._path

    async def open(self) -> None:
        await asyncio.to_thread(os.makedirs, self._volume_dir, exist_ok=True)
        await asyncio.to_thread(self._remove_orphaned_tmp_files)

        journal = await asyncio.to_thread(self._read_journal)
        payload = journal if journal is not None else await read_store_file(self._path, self._log)
        if payload is None:
            payload = {}
            await write_store_file(self._path, payload, self._log)
        elif journal is not None:
            await write_store_file(self._path, payload, self._log)
            await asyncio.to_thread(os.unlink, self._journal_path)

        upgraded = upgrade_layout(payload)
        if upgraded is not payload:
            await write_store_file(self._path, upgraded, self._log)

        self._payload = upgraded
        await backup_store_file(self._path, self._log)
        self._closed = False

    def get(self) -> dict[str, Any]:
        return self._payload

    async def put(self, payload: dict[str, Any]) -> None:
        self._assert_open()
        self._payload = payload
        self._seq += 1
        seq = self._seq
        if self._journaled:
            # the store file write below still carries it
            with suppress(Exception):
                self._write_journal(payload)
        await self._persist(payload, seq)

    def put_sync(self, payload: dict[str, Any]) -> None:
        self._assert_open()
        self._payload = payload
        self._seq += 1
        seq = self._seq
        try:
            self._write_journal(payload)
        finally:
            self._persist_detached(payload, seq)

    async def close(self) -> None:
        self._closed = True
        await asyncio.gather(*self._detached, return_exceptions=True)
        await self._writer.idle()

    def _assert_open(self) -> None:
        if self._closed:
            # a silent no-op would lose writes during shutdown
            raise RuntimeError(f"store: put on closed store {self._path}")

    async def _persist(self, payload: dict[str, Any], seq: int) -> None:
        await self._writer.write(payload)
        if self._journaled and seq == self._seq:
            self._remove_journal()

    def _persist_detached(self, payload: dict[str, Any], seq: int) -> None:
        task = asyncio.ensure_future(self._persist(payload, seq))
        self._detached.add(task)
        task.add_done_callback(self._settle_detached)

    def _settle_detached(self, task: asyncio.Task[None]) -> None:
        self._detached.discard(task)
        # a failed store write keeps the journal for the next open
        if not task.cancelled():
            task.exception()

    def _write_journal(self, payload: dict[str, Any]) -> None:
        try:
            _write_store_file_sync(self._journal_path, encode_envelope(payload))
            self._journaled = True
        except Exception:
            # an older journal must not outlive a newer state
            self._remove_journal()
            raise

    def _remove_journal(self) -> None:
        try:
            os.unlink(self._journal_path)
        except FileNotFoundError:
            pass
        except OSError:
            return
        self._journaled = False

    def _read_journal(self) -> dict[str, Any] | None:
        buf = _read_bytes(self._journal_path)
        if buf is None:
            return None
        try:
            return decode_envelope(buf)
        except StoreCorruptError:
            # rename rules out a torn journal, a damaged one yields to the store file
            with suppress(OSError):
                os.unlink(self._journal_path)
            return None

    async def _write_snapshot(self, snapshot: dict[str, Any]) -> None:
        await write_store_file(self._path, snapshot, self._log)

    def _remove_orphaned_tmp_files(self) -> None:
        try:
            names = os.listdir(self._volume_dir)
        except OSError:
            return
        for name in names:
            if name.startswith(STORE_FILE_NAME) and ".tmp-" in name:
                with suppress(OSError):
                    os.unlink(os.path.join(self._volume_dir, name))
