class TranscriptionError(Exception):
    """Raised when faster-whisper fails or times out, after retries are exhausted.

    Callers should never see a raw exception from the underlying model or a bare
    `asyncio.TimeoutError` -- `WhisperSTT` wraps both into this so the session layer has one
    thing to catch.
    """
