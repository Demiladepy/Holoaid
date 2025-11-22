from __future__ import annotations

from dataclasses import asdict

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status

from ..config import Settings, get_settings
from ..models.schemas import (
    NavigationDecisionRequest,
    NavigationDecisionResponse,
    NavigationDirectionStep,
    NavigationDirectionsRequest,
    NavigationDirectionsResponse,
    NavigationDestinationRequest,
    NavigationDestinationResponse,
)
from ..services.directions import GoogleDirectionsClient
from ..services.navigation import NavigationStateStore, get_navigation_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/navigation", tags=["navigation"])


def _authorize(settings: Settings, authorization: str | None) -> None:
    if settings.vision_api_token and authorization != f"Bearer {settings.vision_api_token}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vision token")


@router.post("/decision", response_model=NavigationDecisionResponse)
def submit_decision(
    payload: NavigationDecisionRequest,
    store: NavigationStateStore = Depends(get_navigation_store),
    settings: Settings = Depends(get_settings),
    authorization: str | None = Header(default=None),
) -> NavigationDecisionResponse:
    _authorize(settings, authorization)
    entry = store.record_decision(
        room=payload.room,
        command=payload.command,
        message=payload.message,
        confidence=payload.confidence,
        source=payload.source,
    )
    return NavigationDecisionResponse(**asdict(entry))


@router.get("/decision/latest", response_model=NavigationDecisionResponse)
def latest_decision(
    room: str,
    store: NavigationStateStore = Depends(get_navigation_store),
) -> NavigationDecisionResponse:
    entry = store.get_latest_decision(room)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No decision available")
    return NavigationDecisionResponse(**asdict(entry))


@router.post("/destination", response_model=NavigationDestinationResponse)
def set_destination(
    payload: NavigationDestinationRequest,
    store: NavigationStateStore = Depends(get_navigation_store),
) -> NavigationDestinationResponse:
    entry = store.set_destination(
        room=payload.room,
        latitude=payload.latitude,
        longitude=payload.longitude,
        label=payload.label,
        requested_by=payload.requested_by,
    )
    return NavigationDestinationResponse(**asdict(entry))


@router.get("/destination/{room}", response_model=NavigationDestinationResponse)
def get_destination(
    room: str,
    store: NavigationStateStore = Depends(get_navigation_store),
) -> NavigationDestinationResponse:
    entry = store.get_destination(room)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not set")
    return NavigationDestinationResponse(**asdict(entry))


@router.delete("/destination/{room}", status_code=status.HTTP_204_NO_CONTENT)
def clear_destination(room: str, store: NavigationStateStore = Depends(get_navigation_store)) -> None:
    store.clear_destination(room)


@router.post("/directions/next", response_model=NavigationDirectionsResponse)
def next_direction(
    payload: NavigationDirectionsRequest,
    store: NavigationStateStore = Depends(get_navigation_store),
    settings: Settings = Depends(get_settings),
) -> NavigationDirectionsResponse:
    destination = store.get_destination(payload.room)
    if not destination:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not set")
    if not settings.google_maps_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Directions service unavailable")

    client = GoogleDirectionsClient(settings.google_maps_api_key)
    try:
        guidance = client.get_route(
            origin=(payload.latitude, payload.longitude),
            destination=(destination.latitude, destination.longitude),
            mode=payload.mode,
        )
    except RuntimeError as exc:
        logger.error("Directions lookup failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    finally:
        client.close()

    step = guidance.next_step
    next_step = NavigationDirectionStep(
        instruction=step.instruction,
        distance_meters=step.distance_meters,
        distance_text=step.distance_text,
        duration_seconds=step.duration_seconds,
        duration_text=step.duration_text,
        travel_mode=step.travel_mode,
    )

    return NavigationDirectionsResponse(
        summary=guidance.summary,
        total_distance_meters=guidance.total_distance_meters,
        total_duration_seconds=guidance.total_duration_seconds,
        next_step=next_step,
        destination_latitude=destination.latitude,
        destination_longitude=destination.longitude,
    )
