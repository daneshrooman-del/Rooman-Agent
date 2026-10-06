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
    stt_turn_detection: str = "vad"
    """"vad" (default): Silero VAD on 32 ms windows ends the turn after `stt_min_silence_ms` of
    silence, then the whole utterance is transcribed once (`trackb.stt.endpointing`).
    "chunk": the original fixed 2 s chunk mode in `WhisperSTT` (ends a turn on a fully silent
    chunk; slower and cuts words at chunk edges)."""
    stt_min_silence_ms: int = 500
    whisper_device: str = "cpu"
    """"cpu" or "cuda" (e.g. on a Kaggle T4)."""
    whisper_compute_type: str = "int8"
    """ctranslate2 precision: "int8" suits CPU; use "float16" on a CUDA GPU."""
    whisper_language: str | None = None
    """Fix the spoken language (e.g. "en") instead of letting faster-whisper detect it per chunk.
    Detection runs on every chunk -- even ones its VAD already emptied as silence -- and on a slow
    CPU it costs more than the transcription itself (measured ~1.4 s per 2 s chunk on an
    i7-3770S), which leaves STT barely faster than real time. `None` keeps auto-detection."""

    tts_voice_model_path: str = ""
    """Path to a downloaded Piper `.onnx` voice model file (its `.onnx.json` config must sit
    alongside it). Empty means no real voice model is configured -- callers fall back to
    `MockTTSProvider` rather than constructing `PiperTTSProvider` against a path that doesn't
    exist. See `trackb.tts.piper_tts`'s module docstring for how to obtain one."""

    avatar_service_url: str = "http://localhost:8100"

    avatar_renderer: str = "none"
    """Live talking-head video for the agent: "none" (default, audio only) or "placeholder" (a
    CPU-drawn face whose mouth follows loudness, `trackb.avatar.placeholder`). A GPU lip-sync
    renderer (MuseTalk) will be another value here."""
    avatar_fps: int = 25

    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"

    llm_provider: str = "mock"
    """"mock" (default, no real backend), "ollama" (local/self-hosted, free) or "gemini".
    The concrete LLM choice is otherwise kept out of this track's code -- everything depends
    on the `LLMProvider` protocol -- but a factory has to read *some* config value to pick a
    concrete implementation somewhere, and this is it."""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    """Any model pulled into the Ollama server (`ollama pull qwen2.5:3b`). A 3B quantized model
    is the practical ceiling for CPU-only hardware; on a GPU (e.g. Kaggle T4) 7-8B is fine."""
    ollama_keep_alive: str = "30m"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    cors_allow_origins: list[str] = ["http://localhost:5173"]
    """Origins allowed to call this API cross-origin (`CORSMiddleware` in `api/app.py`).
    Defaults to the Vite dev server's default port (confirmed from this repo's own
    `vite.config.ts`, which has no port override) -- override via
    `TRACKB_CORS_ALLOW_ORIGINS` (a JSON array, per `pydantic-settings`' list-from-env parsing)
    for any other frontend deployment."""

    max_concurrent_sessions: int = 10
    worker_job_executor: str = "thread"
    """"thread" (default): every session runs as a thread in one worker process, sharing a single
    loaded copy of Whisper/Piper/Silero (`trackb.session.prewarm.shared_models`). This avoids
    reloading models per session, the CPU contention of warming the next process mid-call, and --
    on a GPU host -- one model copy in VRAM per session. "process": LiveKit's per-session process
    isolation (a crash takes down only one session), at the cost of all of the above."""
    worker_idle_processes: int = 1
    """Job processes LiveKit keeps prewarmed (models loaded, see `trackb.session.prewarm`) and
    waiting for the next session. Each holds Whisper + Piper + Silero in memory (~400 MB with
    Whisper `base`), so keep this small on low-RAM machines."""
    worker_init_timeout_seconds: float = 60.0
    """How long LiveKit lets a job process spend in `prewarm` before killing it. LiveKit's own
    default (10 s) is shorter than loading Whisper + Piper on a slow CPU, which made it kill and
    respawn warming processes forever."""
    session_init_timeout_seconds: float = 15.0
    participant_wait_timeout_seconds: float = 120.0
    """How long a session waits, after joining the room, for a human participant to actually
    appear before giving up. Distinct from `session_init_timeout_seconds` (which bounds the
    room-join call itself). 120s by default -- generous enough for a person to open a client,
    paste a token, and connect, rather than the tight window a fully automated client would
    need."""


def get_settings() -> Settings:
    return Settings()
