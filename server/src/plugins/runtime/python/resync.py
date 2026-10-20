from __future__ import annotations

import asyncio
import random
from collections.abc import Callable

RESYNC_DELAY = 0.15
RESYNC_JITTER = 0.5


class ResyncScheduler:
    def __init__(self, resync: Callable[[], None]) -> None:
        self._resync = resync
        self._handle: asyncio.TimerHandle | None = None
        self._closed = False

    def trigger(self) -> None:
        if self._closed or self._handle is not None:
            return
        delay = RESYNC_DELAY + random.random() * RESYNC_JITTER
        self._handle = asyncio.get_running_loop().call_later(delay, self._fire)

    def close(self) -> None:
        self._closed = True
        if self._handle is not None:
            self._handle.cancel()
            self._handle = None

    def _fire(self) -> None:
        self._handle = None
        if not self._closed:
            self._resync()
