"""Run a model worker inside its own virtualenv.

Protocol: the worker receives one JSON request on stdin and prints a single
line `RESULT <json>` on stdout. Everything else it prints is streamed to the
log. A fresh process per call means GPU/CPU memory is fully released between
the TTS and animation steps — essential on 4 GB GPUs / 8 GB RAM machines.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent


class WorkerError(RuntimeError):
    pass


def _ffmpeg_dir() -> Path:
    """SadTalker shells out to a plain `ffmpeg`; expose the bundled imageio-ffmpeg binary under that name."""
    import shutil

    from ..media import FFMPEG

    d = HERE.parent.parent / ".venvs" / "ffmpeg-bin"
    exe = d / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    if not exe.exists():
        d.mkdir(parents=True, exist_ok=True)
        shutil.copy2(FFMPEG, exe)
    return d


def run_worker(
    python: Path,
    script: str,
    request: dict,
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    on_log: Callable[[str], None] | None = None,
    timeout: float = 3600,
) -> dict:
    if not Path(python).exists():
        raise WorkerError(f"Worker interpreter not found: {python}. Run `py -3.10 scripts/setup.py`.")
    proc = subprocess.Popen(
        [str(python), "-u", str(HERE / script)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(cwd) if cwd else None,
        env={**os.environ, "PYTHONIOENCODING": "utf-8", "PATH": f"{_ffmpeg_dir()}{os.pathsep}{os.environ.get('PATH', '')}", **(env or {})},
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert proc.stdin and proc.stdout
    proc.stdin.write(json.dumps(request, default=str))
    proc.stdin.close()

    result: dict | None = None
    tail: list[str] = []
    for line in proc.stdout:
        line = line.rstrip()
        if line.startswith("RESULT "):
            result = json.loads(line[7:])
            continue
        tail = (tail + [line])[-40:]
        if on_log:
            on_log(line)
    try:
        code = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise WorkerError(f"{script} timed out after {timeout:.0f}s")
    if result is None or result.get("error"):
        msg = (result or {}).get("error") or "\n".join(tail[-15:])
        raise WorkerError(f"{script} failed (exit {code}): {msg}")
    return result
