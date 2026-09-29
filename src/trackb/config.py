from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TRACKB_", env_file=".env", extra="ignore")

    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    qdrant_url: str = "http://localhost:6333"

    redis_url: str = "redis://localhost:6379/0"
    session_state_ttl_seconds: int = 6 * 60 * 60
    """How long session metadata and in-progress intake state (slots + utterance history) live
    in Redis before expiring. A session shouldn't live forever if the caller abandons it mid-
    intake and never resumes -- 6 hours is generous enough to cover a real disconnect/resume
    without leaving stale state around indefinitely. Completed intake progress is cleared
    explicitly (see `RedisSessionStore.clear_intake_progress`) well before this TTL would ever
    matter for the happy path; this TTL is what bounds the abandoned-session case."""
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
    """"mock" (default, no real backend) or "gemini". The concrete LLM choice is otherwise
    kept out of this track's code -- everything depends on the `LLMProvider` protocol -- but
    a factory has to read *some* config value to pick a concrete implementation somewhere,
    and this is it."""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    cors_allow_origins: list[str] = ["http://localhost:5173"]
    """Origins allowed to call this API cross-origin (`CORSMiddleware` in `api/app.py`).
    Defaults to the Vite dev server's default port (confirmed from this repo's own
    `vite.config.ts`, which has no port override) -- override via
    `TRACKB_CORS_ALLOW_ORIGINS` (a JSON array, per `pydantic-settings`' list-from-env parsing)
    for any other frontend deployment."""

    max_concurrent_sessions: int = 10
    session_init_timeout_seconds: float = 15.0
    participant_wait_timeout_seconds: float = 120.0
    """How long a session waits, after joining the room, for a human participant to actually
    appear before giving up. Distinct from `session_init_timeout_seconds` (which bounds the
    room-join call itself). 120s by default -- generous enough for a person to open a client,
    paste a token, and connect, rather than the tight window a fully automated client would
    need."""


def get_settings() -> Settings:
    return Settings()
