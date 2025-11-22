from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from livekit.api.access_token import AccessToken, VideoGrants

from ..config import get_settings


@dataclass(slots=True)
class LiveKitTokenService:
    """Wraps LiveKit's AccessToken helper and enforces credential validation."""

    api_key: str | None = None
    api_secret: str | None = None

    def __post_init__(self) -> None:
        if not self.api_key or not self.api_secret:
            settings = get_settings()
            self.api_key = self.api_key or settings.livekit_api_key
            self.api_secret = self.api_secret or settings.livekit_api_secret
        self.ensure_credentials()

    def ensure_credentials(self) -> None:
        if not self.api_key or not self.api_secret:
            raise RuntimeError("LiveKit credentials are not configured")

    def issue_token(
        self,
        room: str | None,
        identity: str,
        name: str | None = None,
        *,
        ttl_hours: int | None = None
    ) -> str:
        self.ensure_credentials()
        settings = get_settings()
        ttl = dt.timedelta(hours=ttl_hours or settings.token_ttl_hours)
        grants = VideoGrants(room_join=True, room=room or settings.obs_room, can_publish=True, can_subscribe=True)
        token = (
            AccessToken(self.api_key, self.api_secret)
            .with_identity(identity)
            .with_name(name or identity)
            .with_grants(grants)
            .with_ttl(ttl)
            .to_jwt()
        )
        return token
