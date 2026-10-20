from __future__ import annotations

import asyncio
import contextlib
import json
import os
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Protocol

if TYPE_CHECKING:
    from plugins.runtime.python.store import PluginStoreFile

STALE_INSTANCE = "STALE_INSTANCE"
FLUSH_DELAY = 0.2
RETRY_DELAYS = (1.0, 2.0, 5.0, 10.0)
STOP_FLUSH = 5.0
SPILL_FILE = ".pending-config.json"
SPILL_MAX_AGE = 24 * 60 * 60


class PluginConfigStoreRPC(Protocol):
    async def get(self) -> dict[str, Any] | None: ...

    async def load(self) -> dict[str, Any] | None: ...

    async def put(
        self, config: dict[str, Any], meta: dict[str, Any] | None = None
    ) -> dict[str, Any] | None: ...

    async def putIfRev(
        self, config: dict[str, Any], base_rev: str, meta: dict[str, Any] | None = None
    ) -> dict[str, Any] | None: ...


class PluginConfigDb(Protocol):
    def get(self, key: Literal["config"], /) -> dict[str, Any] | None: ...

    async def put(self, key: Literal["config"], value: dict[str, Any], /) -> None: ...

    def put_sync(self, key: Literal["config"], value: dict[str, Any], /) -> None: ...

    async def flush(self) -> None: ...

    async def close(self) -> None: ...


class ConfigLogger(Protocol):
    def log(self, *args: Any) -> None: ...

    def warn(self, *args: Any) -> None: ...

    def debug(self, *args: Any) -> None: ...


class LocalPluginConfigDb:
    def __init__(self, store: PluginStoreFile) -> None:
        self._store = store

    def get(self, key: Literal["config"], /) -> dict[str, Any]:
        return self._store.get()

    async def put(self, key: Literal["config"], value: dict[str, Any], /) -> None:
        await self._store.put(value)

    def put_sync(self, key: Literal["config"], value: dict[str, Any], /) -> None:
        self._store.put_sync(value)

    async def flush(self) -> None:
        pass

    async def close(self) -> None:
        await self._store.close()


class RemotePluginConfigDb:
    def __init__(
        self,
        store: PluginConfigStoreRPC,
        probe: PluginConfigStoreRPC,
        storage_path: str,
        instance_id: str | None,
        logger: ConfigLogger,
    ) -> None:
        self._store = store
        self._probe = probe
        self._instance_id = instance_id
        self._logger = logger
        self._spill_path = Path(storage_path) / SPILL_FILE
        self._cache: dict[str, Any] = {}
        self._rev: str | None = None
        self._dirty = False
        self._attempt = 0
        self._closed = False
        self._task: asyncio.Task[None] | None = None

    async def init(self) -> None:
        with contextlib.suppress(OSError):
            self._spill_path.parent.mkdir(parents=True, exist_ok=True)
        await self._replay_spill()
        try:
            loaded = await self._probe.load()
            self._cache = (loaded or {}).get("doc") or {}
            self._rev = (loaded or {}).get("rev")
        except Exception as error:
            if not _is_no_responders(error):
                raise
            self._cache = (await self._store.get()) or {}
            self._rev = None

    def get(self, key: Literal["config"], /) -> dict[str, Any]:
        return self._cache

    async def put(self, key: Literal["config"], value: dict[str, Any], /) -> None:
        self.put_sync(key, value)

    def put_sync(self, key: Literal["config"], value: dict[str, Any], /) -> None:
        self._cache = value
        self._dirty = True
        self._write_spill()
        if not self._closed and self._task is None:
            self._task = asyncio.create_task(self._pump(FLUSH_DELAY))

    async def flush(self) -> None:
        if not self._dirty:
            return
        await self._cancel_pump()
        await self._flush()
        if self._dirty:
            if not self._closed:
                self._task = asyncio.create_task(self._pump(RETRY_DELAYS[0]))
            raise RuntimeError("the config change is not saved yet")

    async def close(self) -> None:
        self._closed = True
        await self._cancel_pump()
        if self._dirty:
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._flush(), timeout=STOP_FLUSH)

    async def _cancel_pump(self) -> None:
        task = self._task
        self._task = None
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task

    async def _pump(self, delay: float) -> None:
        try:
            while not self._closed:
                await asyncio.sleep(delay)
                await self._flush()
                if not self._dirty:
                    return
                delay = (
                    RETRY_DELAYS[min(self._attempt - 1, len(RETRY_DELAYS) - 1)]
                    if self._attempt
                    else FLUSH_DELAY
                )
        finally:
            if self._task is asyncio.current_task():
                self._task = None

    async def _flush(self) -> None:
        doc = self._cache
        self._dirty = False
        try:
            result = await self._store.put(doc, {"instanceId": self._instance_id})
        except asyncio.CancelledError:
            self._dirty = True
            raise
        except Exception as error:
            if STALE_INSTANCE in str(error):
                self._logger.warn(
                    f"Dropped a config change: instance {self._instance_id} no longer runs the plugin"
                )
                self._remove_spill()
                return
            if self._attempt == 0:
                # no responders: the master restarts, the change waits on disk
                log = self._logger.debug if _is_no_responders(error) else self._logger.warn
                log(f"Saving the config failed, retrying: {error}")
            self._attempt += 1
            self._dirty = True
            return

        self._rev = (result or {}).get("rev")
        self._attempt = 0
        if self._dirty:
            # a newer change arrived, its spill needs the new rev
            self._write_spill()
        else:
            self._remove_spill()

    async def _replay_spill(self) -> None:
        try:
            spill = json.loads(self._spill_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return
        except (OSError, ValueError) as error:
            self._logger.warn(f"Dropped an unreadable unsaved config change: {error}")
            self._remove_spill()
            return

        if (
            not isinstance(spill, dict)
            or not spill.get("doc")
            or time.time() * 1000 - spill.get("at", 0) > SPILL_MAX_AGE * 1000
        ):
            self._logger.warn("Dropped an unsaved config change older than 24 h")
            self._remove_spill()
            return
        if not spill.get("baseRev"):
            self._logger.warn("Dropped an unsaved config change made under an older camera.ui server")
            self._remove_spill()
            return

        try:
            result = await self._probe.putIfRev(
                spill["doc"],
                spill["baseRev"],
                {"instanceId": self._instance_id, "madeBy": spill.get("instanceId")},
            )
        except Exception as error:
            if _is_no_responders(error):
                self._logger.warn(
                    "Dropped an unsaved config change, the camera.ui server is too old to take it"
                )
            elif STALE_INSTANCE in str(error):
                self._logger.warn("Dropped an unsaved config change: this instance no longer runs the plugin")
            else:
                # kept for the next start
                raise
        else:
            if (result or {}).get("applied"):
                self._logger.log("Restored a config change the last run did not save")
            else:
                self._logger.warn(
                    f"Dropped an unsaved config change of the last run (instance {spill.get('instanceId')}),"
                    " the config was saved in between"
                )
        self._remove_spill()

    def _write_spill(self) -> None:
        spill = {
            "instanceId": self._instance_id,
            "baseRev": self._rev,
            "doc": self._cache,
            "at": int(time.time() * 1000),
        }
        tmp = self._spill_path.with_name(f"{SPILL_FILE}.tmp")
        try:
            tmp.write_text(json.dumps(spill), encoding="utf-8")
            os.replace(tmp, self._spill_path)
        except (OSError, TypeError, ValueError) as error:
            self._logger.debug(f"Could not write the unsaved config change to disk: {error}")

    def _remove_spill(self) -> None:
        with contextlib.suppress(OSError):
            self._spill_path.unlink()


def _is_no_responders(error: BaseException) -> bool:
    return "no responders" in str(error).lower()
