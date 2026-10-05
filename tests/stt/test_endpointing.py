import asyncio

import numpy as np
import pytest

from trackb.config import Settings
from trackb.session.entrypoint import _build_stt
from trackb.stt.endpointing import WINDOW_SAMPLES, EndpointedSTT, Endpointer, SileroStreamingVAD
from trackb.stt.whisper_stt import WhisperSTT

WINDOW_MS = 32


def _loud_prob(window: np.ndarray) -> float:
    """Fake VAD: a window is speech iff it's loud."""
    return 1.0 if float(np.abs(window).max()) > 0.1 else 0.0


def _audio(ms: int, loud: bool) -> bytes:
    n = WINDOW_SAMPLES * max(1, round(ms / WINDOW_MS))
    value = 10_000 if loud else 0
    return np.full(n, value, dtype=np.int16).tobytes()


def _endpointer(**kwargs: int) -> Endpointer:
    return Endpointer(_loud_prob, min_speech_ms=96, min_silence_ms=320, pre_roll_ms=96, **kwargs)


def test_emits_one_utterance_after_enough_silence_with_pre_roll() -> None:
    ep = _endpointer()

    assert ep.feed(_audio(320, loud=False)) == []
    assert ep.feed(_audio(640, loud=True)) == []
    assert ep.in_speech
    assert ep.feed(_audio(288, loud=False)) == []  # 9 windows < 10 needed
    (utterance,) = ep.feed(_audio(32, loud=False))

    # 3 pre-roll windows (the 3 loud ones that triggered start) + rest of speech + 10 silent
    assert len(utterance) // (2 * WINDOW_SAMPLES) == 20 + 10
    assert not ep.in_speech


def test_short_pause_inside_speech_does_not_end_the_turn() -> None:
    ep = _endpointer()
    out = ep.feed(_audio(320, True) + _audio(160, False) + _audio(320, True) + _audio(320, False))
    assert len(out) == 1


def test_blips_shorter_than_min_speech_are_ignored() -> None:
    ep = _endpointer()
    assert ep.feed(_audio(64, True) + _audio(640, False)) == []
    assert not ep.in_speech


def test_handles_arbitrary_frame_sizes() -> None:
    ep = _endpointer()
    audio = _audio(320, True) + _audio(352, False)
    out: list[bytes] = []
    for i in range(0, len(audio), 320):  # 10 ms LiveKit-sized frames
        out += ep.feed(audio[i : i + 320])
    assert len(out) == 1


def test_max_utterance_cuts_long_speech() -> None:
    ep = Endpointer(_loud_prob, min_speech_ms=32, max_utterance_s=0.32)
    assert len(ep.feed(_audio(640, True))) == 2  # 20 windows of speech, cut every 10


def test_flush_returns_in_progress_utterance() -> None:
    ep = _endpointer()
    ep.feed(_audio(320, True))
    assert ep.flush()
    assert ep.flush() is None


class _FakeTranscriber:
    def __init__(self, delay: float = 0.0, fail_first: bool = False) -> None:
        self.calls: list[int] = []
        self._delay = delay
        self._fail_first = fail_first

    async def transcribe_utterance(self, audio_bytes: bytes) -> str:
        self.calls.append(len(audio_bytes))
        await asyncio.sleep(self._delay)
        if self._fail_first and len(self.calls) == 1:
            raise RuntimeError("whisper hiccup")
        return f" utterance {len(self.calls)} "


async def _collect(stt: EndpointedSTT) -> list[str]:
    return [e.text async for e in stt.events() if e.is_final]


@pytest.mark.asyncio
async def test_endpointed_stt_emits_final_per_utterance_without_blocking_push() -> None:
    stt = EndpointedSTT(_FakeTranscriber(delay=0.05), _endpointer())
    collector = asyncio.create_task(_collect(stt))

    turn = _audio(320, True) + _audio(320, False)
    loop = asyncio.get_running_loop()
    started = loop.time()
    await stt.push_audio(turn)
    await stt.push_audio(turn)
    assert loop.time() - started < 0.04  # transcription runs in the background

    await stt.aclose()
    assert await collector == ["utterance 1", "utterance 2"]


@pytest.mark.asyncio
async def test_endpointed_stt_survives_a_failed_transcription_and_flushes_on_close() -> None:
    stt = EndpointedSTT(_FakeTranscriber(fail_first=True), _endpointer())
    collector = asyncio.create_task(_collect(stt))

    await stt.push_audio(_audio(320, True) + _audio(320, False))  # fails
    await stt.push_audio(_audio(320, True))  # still speaking at close
    await stt.aclose()

    assert await collector == ["utterance 2"]
    with pytest.raises(RuntimeError, match="closed"):
        await stt.push_audio(b"\x00\x00")


class _FakeSession:
    def __init__(self) -> None:
        self.inputs: list[np.ndarray] = []

    def run(self, _outputs: object, feeds: dict[str, np.ndarray]) -> tuple:
        self.inputs.append(feeds["input"])
        return np.array([[0.9]]), feeds["h"] + 1, feeds["c"]


def test_silero_streaming_vad_carries_state_and_context_between_windows() -> None:
    session = _FakeSession()
    vad = SileroStreamingVAD(session=session)
    w1 = np.linspace(0, 1, WINDOW_SAMPLES, dtype=np.float32)

    assert vad(w1) == pytest.approx(0.9)
    vad(np.zeros(WINDOW_SAMPLES, dtype=np.float32))

    assert session.inputs[0].shape == (1, WINDOW_SAMPLES + 64)
    np.testing.assert_array_equal(session.inputs[1][0, :64], w1[-64:])  # context carried
    assert vad._h[0, 0, 0] == 2  # LSTM state carried across calls


def test_build_stt_selects_mode_from_settings() -> None:
    assert isinstance(_build_stt(Settings(stt_turn_detection="chunk")), WhisperSTT)
    assert isinstance(_build_stt(Settings()), EndpointedSTT)
