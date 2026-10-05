from types import SimpleNamespace

import pytest

from trackb.config import Settings
from trackb.session import prewarm as prewarm_mod
from trackb.session.entrypoint import _build_stt, _build_tts_provider, _worker_options
from trackb.session.prewarm import USERDATA_KEY, WarmModels, prewarm, warm_models


def test_warm_models_reads_process_userdata_or_falls_back_to_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(prewarm_mod, "_cached", None)
    models = WarmModels(whisper="w")
    ctx = SimpleNamespace(proc=SimpleNamespace(userdata={USERDATA_KEY: models}))

    assert warm_models(ctx) is models
    assert warm_models(SimpleNamespace(proc=SimpleNamespace(userdata={}))) == WarmModels()
    assert warm_models(SimpleNamespace()) == WarmModels()


def test_prewarm_failure_is_logged_not_raised(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(settings: Settings) -> WarmModels:
        raise RuntimeError("no model file")

    monkeypatch.setattr(prewarm_mod, "load_models", boom)
    proc = SimpleNamespace(userdata={})

    prewarm(proc)

    assert USERDATA_KEY not in proc.userdata


def test_builders_use_prewarmed_models() -> None:
    models = WarmModels(whisper="whisper-model", piper_voice="piper-voice", vad_session="vad")

    chunk_stt = _build_stt(Settings(stt_turn_detection="chunk"), models)
    vad_stt = _build_stt(Settings(), models)
    tts = _build_tts_provider(Settings(tts_voice_model_path="/x.onnx"), models)

    assert chunk_stt._model == "whisper-model"  # type: ignore[attr-defined]
    assert vad_stt._transcriber._model == "whisper-model"  # type: ignore[attr-defined]
    assert vad_stt._endpointer._prob._session == "vad"  # type: ignore[attr-defined]
    assert tts._voice == "piper-voice"  # type: ignore[attr-defined]


def test_worker_options_register_prewarm_and_idle_processes() -> None:
    opts = _worker_options(Settings(worker_idle_processes=2, worker_init_timeout_seconds=45))

    assert opts.prewarm_fnc is prewarm
    assert opts.num_idle_processes == 2
    assert opts.initialize_process_timeout == 45


def test_shared_models_loads_once_per_process(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[Settings] = []

    def fake_load(settings: Settings) -> WarmModels:
        calls.append(settings)
        return WarmModels(whisper=f"w{len(calls)}")

    monkeypatch.setattr(prewarm_mod, "load_models", fake_load)
    monkeypatch.setattr(prewarm_mod, "_cached", None)

    first = prewarm_mod.shared_models(Settings())
    second = prewarm_mod.shared_models(Settings())

    assert first is second and len(calls) == 1
    # A job whose process userdata is empty (thread executor) still gets the shared models.
    assert warm_models(SimpleNamespace(proc=SimpleNamespace(userdata={}))) is first


def test_worker_options_executor_type_from_settings() -> None:
    from livekit.agents import JobExecutorType

    assert _worker_options(Settings()).job_executor_type == JobExecutorType.THREAD
    assert (
        _worker_options(Settings(worker_job_executor="process")).job_executor_type
        == JobExecutorType.PROCESS
    )
