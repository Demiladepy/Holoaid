from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..config import Settings, get_settings
from ..models.schemas import TextToSpeechRequest, TextToSpeechResponse
from ..services.tts import TextToSpeechService

router = APIRouter(prefix="/tts", tags=["tts"])


def get_tts_service(settings: Settings = Depends(get_settings)) -> TextToSpeechService:
    return TextToSpeechService(settings)


@router.post("/speak", response_model=TextToSpeechResponse)
def synthesize_speech(
    payload: TextToSpeechRequest,
    service: TextToSpeechService = Depends(get_tts_service),
    settings: Settings = Depends(get_settings)
) -> TextToSpeechResponse:
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text payload is empty")

    result = service.synthesize(
        payload.text,
        voice=payload.voice,
        language_code=payload.language_code,
        speaking_rate=payload.speaking_rate,
        pitch=payload.pitch,
    )
    return TextToSpeechResponse(**result)
