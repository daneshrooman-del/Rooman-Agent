from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRACKB_", env_file=".env", extra="ignore")

    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    qdrant_url: str = "http://localhost:6333"

    redis_url: str = "redis://localhost:6379/0"
    database_url: str = "sqlite:///./trackb.db"

    whisper_model_size: str = "base"

    tts_voice_model_path: str = ""
    """Path to a downloaded Piper `.onnx` voice model file (its `.onnx.json` config must sit
    alongside it). Empty means no real voice model is configured -- callers fall back to
    `MockTTSProvider` rather than constructing `PiperTTSProvider` against a path that doesn't
    exist. See `trackb.tts.piper_tts`'s module docstring for how to obtain one."""

    avatar_service_url: str = "http://localhost:8100"

    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"

    llm_provider: str = "mock"

    max_concurrent_sessions: int = 10
    session_init_timeout_seconds: float = 15.0


def get_settings() -> Settings:
    return Settings()
