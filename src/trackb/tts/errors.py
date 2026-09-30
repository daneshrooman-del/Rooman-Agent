class TTSConfigurationError(Exception):
    """Raised when a `TTSProvider` is used without the configuration it needs to run --
    e.g. `PiperTTSProvider` with no (or a missing) voice model file.

    Callers should get this instead of a raw `FileNotFoundError` or an onnxruntime traceback,
    so a misconfigured deployment fails with a message that says exactly what to fix.
    """


class TTSSynthesisError(Exception):
    """Raised when speech synthesis itself fails or times out, after configuration was fine."""
