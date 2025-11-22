from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings, get_settings
from ..models.schemas import LiveKitTokenRequest, LiveKitTokenResponse
from ..services.livekit import LiveKitTokenService

router = APIRouter(prefix="/livekit", tags=["livekit"])


def get_token_service(settings: Settings = Depends(get_settings)) -> LiveKitTokenService:
    return LiveKitTokenService(api_key=settings.livekit_api_key, api_secret=settings.livekit_api_secret)


@router.post("/token", response_model=LiveKitTokenResponse)
def issue_token(
    payload: LiveKitTokenRequest,
    service: LiveKitTokenService = Depends(get_token_service),
    settings: Settings = Depends(get_settings)
) -> LiveKitTokenResponse:
    try:
        token = service.issue_token(room=payload.room or settings.obs_room, identity=payload.identity, name=payload.name)
    except RuntimeError as exc:  # pragma: no cover - configuration error
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    expires_at = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=settings.token_ttl_hours)
    return LiveKitTokenResponse(token=token, expires_at=expires_at)
