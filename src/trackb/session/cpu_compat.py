"""Keep LiveKit Agents' job processes alive on CPUs without AVX2.

`livekit-agents` (>=1.8) warms up `livekit.local_inference` -- its bundled VAD/end-of-turn model,
a prebuilt native library compiled for AVX2 -- inside every job process (`ipc._preload`). On an
older x86 CPU (e.g. Ivy Bridge, which has AVX but not AVX2) that native code executes an illegal
instruction and the job process dies with SIGILL before our entrypoint ever runs; the worker then
logs only "no process became available". This project doesn't use that model (turn detection is
faster-whisper's own VAD, see `trackb.stt.whisper_stt`).

Importing this module, on a CPU without AVX2, replaces `livekit.local_inference.init_vad` and
`init_eot` with functions that raise. Merely importing/loading the library is harmless (plain
`import livekit.agents` does it); only those initializers run AVX2 code. LiveKit's preload treats
an exception from a warm-up step as "skip it", so the job process starts normally. On CPUs with
AVX2 (Kaggle GPU hosts, any recent machine) it does nothing.

`register()` registers this module as a LiveKit `Plugin`, which is what makes the forkserver
import it *before* `ipc._preload` runs (plugin packages are preloaded first).
"""

from __future__ import annotations

from pathlib import Path
from types import ModuleType
from typing import Any

import structlog

logger = structlog.get_logger(__name__)

_DISABLED_INITIALIZERS = ("init_vad", "init_eot")
_CPUINFO = Path("/proc/cpuinfo")


def cpu_supports_avx2(cpuinfo: Path = _CPUINFO) -> bool:
    """True if the CPU advertises AVX2, or if that can't be determined (non-Linux)."""
    try:
        text = cpuinfo.read_text()
    except OSError:
        return True
    for line in text.splitlines():
        if line.startswith("flags"):
            return "avx2" in line.split()
    return True


def _disabled(name: str) -> Any:
    def _raise(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError(
            f"livekit.local_inference.{name} disabled: its native code requires AVX2, which "
            "this CPU lacks (see trackb.session.cpu_compat)"
        )

    _raise._trackb_disabled = True  # type: ignore[attr-defined]
    return _raise


def install_guard(*, avx2: bool | None = None, module: ModuleType | None = None) -> bool:
    """Disable the AVX2-only initializers if the CPU lacks AVX2. Returns whether it did."""
    if avx2 is None:
        avx2 = cpu_supports_avx2()
    if avx2:
        return False
    if module is None:
        try:
            import livekit.local_inference as module
        except ImportError:
            return False
    for name in _DISABLED_INITIALIZERS:
        current = getattr(module, name, None)
        if current is not None and not getattr(current, "_trackb_disabled", False):
            setattr(module, name, _disabled(name))
    return True


def register() -> None:
    """Register this module as a LiveKit plugin so the forkserver preloads it. Main thread only."""
    if cpu_supports_avx2():
        return
    from livekit.agents import Plugin

    class _CpuCompatPlugin(Plugin):
        def __init__(self) -> None:
            super().__init__("trackb-cpu-compat", "0.1.0", __name__)

    Plugin.register_plugin(_CpuCompatPlugin())
    logger.warning("cpu_without_avx2_livekit_local_inference_disabled")


install_guard()
