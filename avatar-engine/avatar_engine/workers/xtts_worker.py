"""XTTS-v2 voice-cloning worker — runs inside .venvs/xtts.

ops:
  clone  {speaker_wav, out}            -> cache the speaker's conditioning latents (the "voice twin")
  speak  {text, language, voice, out}  -> synthesize speech in the cloned voice (24 kHz wav)

XTTS-v2 weights are licensed under the Coqui Public Model License (non-commercial).
"""
import json
import re
import sys
import traceback

MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
SUPPORTED = {"en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi"}


def _model():
    import torch
    from TTS.api import TTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    return TTS(MODEL).to(device).synthesizer.tts_model, device


def clone(req):
    import torch

    model, device = _model()
    gpt_latent, speaker_emb = model.get_conditioning_latents(audio_path=[req["speaker_wav"]])
    torch.save({"gpt_cond_latent": gpt_latent.cpu(), "speaker_embedding": speaker_emb.cpu()}, req["out"])
    return {"voice": req["out"], "device": device}


def _stock_speakers():
    """The 58 studio voices ship as a small speakers_xtts.pth next to the model — reading it takes
    ~5 s instead of ~100 s for loading the full 1.8 GB model. Falls back to the model if missing."""
    import glob
    import os

    import torch

    roots = [os.environ.get("TTS_HOME", ""), os.path.join(os.environ.get("LOCALAPPDATA", ""), "tts"), os.path.expanduser("~/.local/share/tts")]
    for root in filter(None, roots):
        for f in glob.glob(os.path.join(root, "*xtts_v2*", "speakers_xtts.pth")):
            return torch.load(f, weights_only=False)
    model, _ = _model()
    return model.speaker_manager.speakers


def stock(req):
    """Use one of XTTS-v2's built-in studio speakers when no voice sample exists (photo avatars)."""
    import torch

    speakers = _stock_speakers()
    name = req.get("speaker") or ""
    if name not in speakers:
        return {"error": f"Unknown stock voice '{name}'.", "speakers": sorted(speakers)}
    s = speakers[name]
    torch.save({"gpt_cond_latent": s["gpt_cond_latent"].cpu(), "speaker_embedding": s["speaker_embedding"].cpu()}, req["out"])
    return {"voice": req["out"], "speaker": name, "speakers": sorted(speakers)}


def _sentences(text, limit=220):
    """XTTS degrades past ~250 chars per call — split on sentence ends, then commas."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?।])\s+", text.strip()) if p.strip()]
    out = []
    for p in parts:
        while len(p) > limit:
            cut = p.rfind(",", 0, limit)
            cut = cut if cut > 40 else limit
            out.append(p[: cut + 1].strip())
            p = p[cut + 1 :].strip()
        if p:
            out.append(p)
    return out


def speak(req):
    import numpy as np
    import soundfile as sf
    import torch

    lang = req["language"]
    if lang not in SUPPORTED:
        return {"error": f"XTTS-v2 does not support language '{lang}'. Supported: {', '.join(sorted(SUPPORTED))}"}
    model, device = _model()
    voice = torch.load(req["voice"])
    gpt, spk = voice["gpt_cond_latent"].to(device), voice["speaker_embedding"].to(device)
    sr = model.config.audio.output_sample_rate
    pause = np.zeros(int(sr * 0.18), dtype=np.float32)
    chunks = []
    for s in _sentences(req["text"]):
        wav = model.inference(s, lang, gpt, spk, temperature=0.65, enable_text_splitting=False)["wav"]
        chunks += [np.asarray(wav, dtype=np.float32), pause]
    sf.write(req["out"], np.concatenate(chunks[:-1]) if chunks else pause, sr)
    return {"audio": req["out"], "sample_rate": sr, "device": device}


def main():
    req = json.loads(sys.stdin.read())
    try:
        out = {"clone": clone, "speak": speak, "stock": stock}[req["op"]](req)
    except Exception as e:
        traceback.print_exc()
        out = {"error": f"{type(e).__name__}: {e}"}
    print("RESULT " + json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
