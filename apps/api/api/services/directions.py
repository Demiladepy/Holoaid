from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


@dataclass(slots=True)
class DirectionsStep:
    instruction: str
    distance_meters: int
    distance_text: str
    duration_seconds: int
    duration_text: str
    travel_mode: str


@dataclass(slots=True)
class RouteGuidance:
    summary: str | None
    total_distance_meters: int
    total_duration_seconds: int
    next_step: DirectionsStep


class GoogleDirectionsClient:
    """Minimal client for Google Directions API focusing on walking guidance."""

    def __init__(self, api_key: str, *, default_mode: Literal["walking", "driving", "transit", "bicycling"] = "walking") -> None:
        self.api_key = api_key
        self.default_mode = default_mode
        self._client = httpx.Client(timeout=10.0)

    def get_route(
        self,
        *,
        origin: tuple[float, float],
        destination: tuple[float, float],
        mode: str | None = None,
        language: str = "en",
    ) -> RouteGuidance:
        params = {
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{destination[0]},{destination[1]}",
            "mode": mode or self.default_mode,
            "key": self.api_key,
            "language": language,
        }
        response = self._client.get(GOOGLE_DIRECTIONS_URL, params=params)
        response.raise_for_status()
        payload = response.json()
        status = payload.get("status")
        if status != "OK":
            message = payload.get("error_message") or status or "unknown error"
            raise RuntimeError(f"Google Directions error: {message}")
        routes = payload.get("routes") or []
        if not routes:
            raise RuntimeError("Google Directions returned no routes")
        route = routes[0]
        legs = route.get("legs") or []
        if not legs:
            raise RuntimeError("Google Directions returned no legs")
        leg = legs[0]
        steps = leg.get("steps") or []
        if not steps:
            raise RuntimeError("Google Directions leg missing steps")
        next_step_raw = steps[0]
        instruction_html = next_step_raw.get("html_instructions", "")
        instruction = _strip_html(instruction_html)
        distance = next_step_raw.get("distance") or {}
        duration = next_step_raw.get("duration") or {}
        step = DirectionsStep(
            instruction=instruction or "Proceed to the highlighted route",
            distance_meters=int(distance.get("value") or 0),
            distance_text=str(distance.get("text") or "0 m"),
            duration_seconds=int(duration.get("value") or 0),
            duration_text=str(duration.get("text") or "0 mins"),
            travel_mode=str(next_step_raw.get("travel_mode") or "WALKING").upper(),
        )
        return RouteGuidance(
            summary=route.get("summary"),
            total_distance_meters=int((leg.get("distance") or {}).get("value") or step.distance_meters),
            total_duration_seconds=int((leg.get("duration") or {}).get("value") or step.duration_seconds),
            next_step=step,
        )

    def close(self) -> None:
        self._client.close()


def _strip_html(value: str) -> str:
    text = html.unescape(value)
    return re.sub(r"<[^>]+>", "", text).strip()
