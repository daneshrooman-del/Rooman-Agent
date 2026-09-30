from dataclasses import dataclass, field
from typing import Any

import pytest
from livekit import rtc
from livekit.agents.stt import SpeechEventType
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS

from trackb.config import Settings
from trackb.stt.livekit_plugin import WhisperLiveKitSTT
from trackb.stt.whisper_stt import WhisperSTT


@dataclass
class _FakeSegment:
    text: str


@dataclass
class _FakeModel:
    text: str
    calls: list[Any] = field(default_factory=list)

    def transcribe(self, audio: Any, **kwargs: Any) -> tuple[list[_FakeSegment], None]:
        self.calls.append(audio)
        return ([_FakeSegment(self.text)], None)


def _frame(samples: int) -> rtc.AudioFrame:
    return rtc.AudioFrame(
        data=b"\x00\x00" * samples, sample_rate=16000, num_channels=1, samples_per_channel=samples
    )


@pytest.mark.asyncio
async def test_recognize_impl_returns_final_transcript_from_whisper() -> None:
    model = _FakeModel(text="hello from livekit")
    whisper = WhisperSTT(settings=Settings(whisper_model_size="tiny"), model=model)
    plugin = WhisperLiveKitSTT(whisper=whisper)

    event = await plugin._recognize_impl(_frame(1600), conn_options=DEFAULT_API_CONNECT_OPTIONS)

    assert event.type == SpeechEventType.FINAL_TRANSCRIPT
    assert len(event.alternatives) == 1
    assert event.alternatives[0].text == "hello from livekit"
    assert len(model.calls) == 1


@pytest.mark.asyncio
async def test_recognize_impl_combines_multiple_frames_before_transcribing() -> None:
    model = _FakeModel(text="combined")
    whisper = WhisperSTT(settings=Settings(whisper_model_size="tiny"), model=model)
    plugin = WhisperLiveKitSTT(whisper=whisper)

    frames = [_frame(800), _frame(800)]

    event = await plugin._recognize_impl(frames, conn_options=DEFAULT_API_CONNECT_OPTIONS)

    assert event.alternatives[0].text == "combined"
    assert len(model.calls[0]) == 1600


def test_model_and_provider_properties_reflect_whisper_config() -> None:
    whisper = WhisperSTT(settings=Settings(whisper_model_size="small"), model=_FakeModel(text=""))
    plugin = WhisperLiveKitSTT(whisper=whisper)

    assert plugin.model == "faster-whisper-small"
    assert plugin.provider == "trackb-whisper"
