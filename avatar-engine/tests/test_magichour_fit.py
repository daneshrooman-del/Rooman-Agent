"""Credit fitting for Magic Hour renders — no network, no credits spent."""
import pytest

import importlib

from avatar_engine import media

generate = importlib.import_module("avatar_engine.generate")
from avatar_engine.providers import magichour as mh


@pytest.fixture
def fake_mh(monkeypatch, tmp_path):
    sent = {}
    monkeypatch.setattr(mh, "upload", lambda path, kind: f"fp/{path.name}")
    def create(image_fp, audio_fp, seconds, *, mode, name, max_resolution=None):
        sent.update(seconds=seconds, mode=mode)
        return {"id": "vid1", "credits_charged": 0}
    monkeypatch.setattr(mh, "create_talking_photo", create)
    monkeypatch.setattr(mh, "wait_video", lambda vid: {"downloads": [{"url": "u"}], "credits_charged": 1})
    monkeypatch.setattr(mh, "download", lambda url, out: out.write_bytes(b"x") or out)
    monkeypatch.setattr(media, "mux", lambda v, a, o: o)
    monkeypatch.setattr(media, "ffmpeg", lambda *a: "")
    return sent


def _run(monkeypatch, tmp_path, credits, seconds):
    monkeypatch.setattr(mh, "credits", lambda: credits)
    monkeypatch.setattr(media, "probe", lambda p: {"duration": seconds})
    speech = tmp_path / "s.wav"
    speech.write_bytes(b"x")
    return generate._render_magichour(tmp_path, speech, tmp_path, None)


def test_realistic_when_it_fits(fake_mh, monkeypatch, tmp_path):
    r = _run(monkeypatch, tmp_path, credits=400, seconds=6.4)
    assert fake_mh == {"seconds": 6.4, "mode": "realistic"} and r["credit_notes"] == []


def test_switches_to_prompted_to_fit(fake_mh, monkeypatch, tmp_path):
    r = _run(monkeypatch, tmp_path, credits=94, seconds=3.2)  # realistic 192 > 94, prompted 80 <= 94
    assert fake_mh["mode"] == "prompted" and "prompted" in r["credit_notes"][0]


def test_trims_to_what_credits_cover(fake_mh, monkeypatch, tmp_path):
    r = _run(monkeypatch, tmp_path, credits=94, seconds=10)  # prompted 200 > 94 -> 4 s
    assert fake_mh == {"seconds": 4.0, "mode": "prompted"} and "cut to the first 4s" in r["credit_notes"][-1]


def test_refuses_without_credits(fake_mh, monkeypatch, tmp_path):
    with pytest.raises(mh.NotEnoughCredits):
        _run(monkeypatch, tmp_path, credits=10, seconds=3)
    assert fake_mh == {}  # nothing was sent


def test_uses_magic_hours_own_quote_when_estimate_is_wrong(monkeypatch, tmp_path, fake_mh):
    """Published price said 20/s, Magic Hour quoted 96 for ~2 s -> trim to what 94 credits cover."""
    calls = []

    def create(image_fp, audio_fp, seconds, *, mode, name, max_resolution=None):
        calls.append(seconds)
        if seconds * 48 > 94:
            raise mh.NotEnoughCredits("Magic Hour POST /v1/ai-talking-photo failed (402): Rendering will cost 96 credits. You have 94 credits.")
        return {"id": "vid2", "credits_charged": round(seconds * 48)}

    monkeypatch.setattr(mh, "create_talking_photo", create)
    r = _run(monkeypatch, tmp_path, credits=94, seconds=2.0)
    assert calls[0] == 2.0 and calls[1] <= 94 / 48 and calls[1] >= 1
    assert "actual price" in r["credit_notes"][-1]
