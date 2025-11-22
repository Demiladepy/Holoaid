from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from threading import Lock
from typing import Iterable

from ..config import Settings, get_settings
from ..models.schemas import NavigationCommand
    

@dataclass(slots=True)
class DecisionEntry:
    sequence: int
    room: str
    command: NavigationCommand
    message: str | None
    confidence: float | None
    source: str | None
    created_at: datetime
    expires_at: datetime


@dataclass(slots=True)
class DestinationEntry:
    room: str
    latitude: float
    longitude: float
    label: str | None = None
    requested_by: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class NavigationStateStore:
    def __init__(self, *, ttl_seconds: int, history_limit: int) -> None:
        self._ttl = max(ttl_seconds, 1)
        self._history_limit = max(history_limit, 1)
        self._sequence = 0
        self._lock = Lock()
        self._decisions: dict[str, DecisionEntry] = {}
        self._history: dict[str, list[DecisionEntry]] = {}
        self._destinations: dict[str, DestinationEntry] = {}

    def record_decision(
        self,
        *,
        room: str,
        command: NavigationCommand,
        message: str | None = None,
        confidence: float | None = None,
        source: str | None = None,
    ) -> DecisionEntry:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=self._ttl)
        with self._lock:
            self._sequence += 1
            entry = DecisionEntry(
                sequence=self._sequence,
                room=room,
                command=command,
                message=message,
                confidence=confidence,
                source=source,
                created_at=now,
                expires_at=expires_at,
            )
            self._decisions[room] = entry
            history = self._history.setdefault(room, [])
            history.append(entry)
            if len(history) > self._history_limit:
                history.pop(0)
            return entry

    def get_latest_decision(self, room: str) -> DecisionEntry | None:
        now = datetime.now(timezone.utc)
        with self._lock:
            entry = self._decisions.get(room)
            if not entry:
                return None
            if entry.expires_at < now:
                del self._decisions[room]
                return None
            return entry

    def get_history(self, room: str) -> Iterable[DecisionEntry]:
        with self._lock:
            return tuple(self._history.get(room, ()))

    def set_destination(
        self,
        *,
        room: str,
        latitude: float,
        longitude: float,
        label: str | None = None,
        requested_by: str | None = None,
    ) -> DestinationEntry:
        entry = DestinationEntry(room=room, latitude=latitude, longitude=longitude, label=label, requested_by=requested_by)
        with self._lock:
            self._destinations[room] = entry
            return entry

    def get_destination(self, room: str) -> DestinationEntry | None:
        with self._lock:
            return self._destinations.get(room)

    def clear_destination(self, room: str) -> None:
        with self._lock:
            self._destinations.pop(room, None)


@lru_cache(maxsize=1)
def get_navigation_store(settings: Settings | None = None) -> NavigationStateStore:
    cfg = settings or get_settings()
    return NavigationStateStore(
        ttl_seconds=cfg.navigation_decision_ttl_seconds,
        history_limit=cfg.navigation_history_limit,
    )
