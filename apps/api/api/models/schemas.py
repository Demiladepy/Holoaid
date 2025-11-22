from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class LiveKitTokenRequest(BaseModel):
    room: str | None = None
    identity: str
    name: str | None = None


class LiveKitTokenResponse(BaseModel):
    token: str
    expires_at: datetime


class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TextToSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    voice: str | None = None
    language_code: str | None = None
    speaking_rate: float | None = Field(default=None, ge=0.25, le=4.0)
    pitch: float | None = Field(default=None, ge=-20.0, le=20.0)


class TextToSpeechResponse(BaseModel):
    audio_content: str  # base64 string
    audio_mime: str = "audio/mpeg"
    voice_used: str


class NavigationCommand(str, Enum):
    MOVE_FORWARD = "MOVE_FORWARD"
    TURN_LEFT = "TURN_LEFT"
    TURN_RIGHT = "TURN_RIGHT"
    STOP = "STOP"


class NavigationDecisionRequest(BaseModel):
    room: str = Field(..., description="LiveKit room identifier")
    command: NavigationCommand
    message: str | None = Field(default=None, max_length=240)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    source: str | None = Field(default=None, max_length=64)


class NavigationDecisionResponse(BaseModel):
    sequence: int
    room: str
    command: NavigationCommand
    message: str | None = None
    confidence: float | None = None
    source: str | None = None
    created_at: datetime
    expires_at: datetime


class NavigationDestinationRequest(BaseModel):
    room: str = Field(..., description="LiveKit room identifier")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    label: str | None = Field(default=None, max_length=120)
    requested_by: str | None = Field(default=None, max_length=64)


class NavigationDestinationResponse(NavigationDestinationRequest):
    updated_at: datetime


class NavigationDirectionsRequest(BaseModel):
    room: str = Field(..., description="LiveKit room identifier")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    mode: str | None = Field(default=None, description="Google Directions travel mode, e.g., walking")


class NavigationDirectionStep(BaseModel):
    instruction: str
    distance_meters: int
    distance_text: str
    duration_seconds: int
    duration_text: str
    travel_mode: str


class NavigationDirectionsResponse(BaseModel):
    summary: str | None = None
    total_distance_meters: int
    total_duration_seconds: int
    next_step: NavigationDirectionStep
    destination_latitude: float
    destination_longitude: float
    fetched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
