from __future__ import annotations

import base64
import json
from typing import Any, Optional

from google.cloud import texttospeech_v1 as texttospeech
from google.oauth2 import service_account

from ..config import Settings, get_settings


class TextToSpeechService:
    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.client = self._build_client()

    def _build_client(self) -> texttospeech.TextToSpeechClient:
        credentials: Optional[service_account.Credentials] = None
        json_blob = self.settings.google_credentials_json
        if json_blob:
            credentials_dict: Any
            if isinstance(json_blob, str):
                try:
                    credentials_dict = json.loads(json_blob)
                except json.JSONDecodeError:
                    credentials_dict = json.loads(base64.b64decode(json_blob).decode("utf-8"))
            else:
                credentials_dict = json_blob  # pragma: no cover - typed configs
            credentials = service_account.Credentials.from_service_account_info(credentials_dict)
        elif self.settings.google_credentials_file:
            credentials = service_account.Credentials.from_service_account_file(self.settings.google_credentials_file)
        if credentials:
            return texttospeech.TextToSpeechClient(credentials=credentials)
        return texttospeech.TextToSpeechClient()

    def synthesize(
        self,
        text: str,
        *,
        voice: str | None = None,
        language_code: str | None = None,
        speaking_rate: float | None = None,
        pitch: float | None = None
    ) -> dict[str, Any]:
        input_text = texttospeech.SynthesisInput(text=text)
        voice_params = texttospeech.VoiceSelectionParams(
            language_code=language_code or self.settings.tts_language_code,
            name=voice or self.settings.tts_voice,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=getattr(texttospeech.AudioEncoding, self.settings.tts_audio_encoding, texttospeech.AudioEncoding.MP3),
            speaking_rate=speaking_rate,
            pitch=pitch,
        )
        response = self.client.synthesize_speech(request={"input": input_text, "voice": voice_params, "audio_config": audio_config})
        audio_content = base64.b64encode(response.audio_content).decode("utf-8")
        return {
            "audio_content": audio_content,
            "voice_used": voice or self.settings.tts_voice,
            "audio_mime": _encoding_to_mime(self.settings.tts_audio_encoding),
        }


def _encoding_to_mime(encoding: str) -> str:
    mapping = {
        "MP3": "audio/mpeg",
        "OGG_OPUS": "audio/ogg",
        "LINEAR16": "audio/wav",
    }
    return mapping.get(encoding.upper(), "audio/mpeg")
