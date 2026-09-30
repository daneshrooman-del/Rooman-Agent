"""TTS abstraction.

Mirrors `trackb.llm.base.LLMProvider`: nothing outside `trackb/tts/` may import a specific
TTS backend directly -- everything goes through `TTSProvider` so swapping the backend (or
pointing at a different self-hosted voice model) later is a config change, not a rewrite.

Audio contract
--------------
`synthesize()` returns raw PCM16 (signed 16-bit little-endian) mono audio bytes at
`TTS_SAMPLE_RATE` (16 kHz). That rate is not arbitrary -- it matches the two other fixed points
in this audio pipeline:

- `trackb.stt.whisper_stt.DEFAULT_SAMPLE_RATE` (16_000) -- what `WhisperSTT` assumes incoming
  audio is already at.
- `trackb.session.room_client.DEFAULT_SAMPLE_RATE` (16_000) -- what `LiveKitRoomClient`
  publishes outgoing audio as: `RoomClient.publish_audio()` builds an `rtc.AudioFrame` tagged
  with its own fixed `sample_rate`, not one read off the bytes it's given, so a provider that
  synthesized at a different rate would be published at the wrong pitch/speed with no error.

`SessionWorker.speak()` calls `tts(text)` then `self.say_audio(audio)` ->
`RoomClient.publish_audio(audio)` with no resampling step in between, so every `TTSProvider`
implementation is responsible for returning audio already at `TTS_SAMPLE_RATE`.
"""

from typing import Protocol

TTS_SAMPLE_RATE = 16_000
"""Fixed output sample rate for every `TTSProvider`. See module docstring for why 16 kHz."""


class TTSProvider(Protocol):
    async def synthesize(self, text: str, voice_id: str | None = None) -> bytes:
        """Synthesize `text` to speech.

        Returns raw PCM16 mono audio bytes at `TTS_SAMPLE_RATE`, ready to hand to
        `RoomClient.publish_audio()` unchanged.

        `voice_id` selects which voice to speak with, when the backend supports more than
        one (e.g. `AgentSpec.voice_id` / `AvatarAssignment.voice_id`). `None` means "use
        whatever default voice the provider is configured with".
        """
        ...
