from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings loaded from environment variables or .env files."""

    api_prefix: str = "/api"
    livekit_server_url: str = "wss://demo.livekit.cloud"
    livekit_api_key: str | None = None
    livekit_api_secret: str | None = None
    obs_room: str = "vision-nav-room"
    token_ttl_hours: int = 6
    redis_url: str | None = None
    allowed_origins: list[str] = ["*"]
    google_credentials_file: str | None = None
    google_credentials_json: str | None = None
    google_maps_api_key: str | None = None
    tts_voice: str = "en-US-Wavenet-F"
    tts_language_code: str = "en-US"
    tts_audio_encoding: str = "MP3"
    navigation_decision_ttl_seconds: int = 5
    navigation_history_limit: int = 50
    vision_api_token: str | None = None
    auto_start_vision_worker: bool = True
    worker_fastapi_base_url: str = "http://127.0.0.1:8080"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
