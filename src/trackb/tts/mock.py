"""A deterministic, canned-audio TTS provider for unit tests and local dev.

Mirrors `trackb.llm.mock.MockLLMProvider`: real backends (`trackb.tts.piper_tts.PiperTTSProvider`,
or whatever else satisfies `TTSProvider` later) are swapped in via config -- nothing that
depends on `TTSProvider` needs to change.
"""

from collections.abc import Callable

from trackb.tts.base import TTS_SAMPLE_RATE

_BYTES_PER_SAMPLE = 2  # PCM16
DEFAULT_SILENCE_SECONDS = 0.2

SynthesizeFn = Callable[[str, "str | None"], bytes]


def _silence(seconds: float, sample_rate: int = TTS_SAMPLE_RATE) -> bytes:
    """`seconds` of PCM16 mono silence at `sample_rate` -- a validly-shaped, empty audio buffer."""
    return b"\x00" * (_BYTES_PER_SAMPLE * int(seconds * sample_rate))


class MockTTSProvider:
    """Stands in for a real `TTSProvider` -- no model load, no inference, fully deterministic.

    By default returns a short fixed silence buffer (correct format, no real speech) for every
    call. Pass `synthesize_fn` to control the returned bytes per-call in a test (e.g. to assert
    on the `text`/`voice_id` a caller passed through).
    """

    def __init__(
        self,
        synthesize_fn: SynthesizeFn | None = None,
        *,
        silence_seconds: float = DEFAULT_SILENCE_SECONDS,
    ) -> None:
        self._synthesize_fn = synthesize_fn
        self._default_audio = _silence(silence_seconds)
        self.calls: list[tuple[str, str | None]] = []

    async def synthesize(self, text: str, voice_id: str | None = None) -> bytes:
        self.calls.append((text, voice_id))
        if self._synthesize_fn is not None:
            return self._synthesize_fn(text, voice_id)
        return self._default_audio
