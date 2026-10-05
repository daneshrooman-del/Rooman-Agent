from pathlib import Path
from types import ModuleType

import pytest

from trackb.session import cpu_compat


def _cpuinfo(tmp_path: Path, flags: str) -> Path:
    p = tmp_path / "cpuinfo"
    p.write_text(f"processor\t: 0\nflags\t\t: {flags}\n")
    return p


def _fake_local_inference() -> ModuleType:
    mod = ModuleType("fake_local_inference")
    mod.init_vad = lambda: "vad"  # type: ignore[attr-defined]
    mod.init_eot = lambda: "eot"  # type: ignore[attr-defined]
    mod.other = lambda: "untouched"  # type: ignore[attr-defined]
    return mod


def test_detects_avx2_presence_and_absence(tmp_path: Path) -> None:
    assert cpu_compat.cpu_supports_avx2(_cpuinfo(tmp_path, "fpu sse4_2 avx avx2 fma"))
    assert not cpu_compat.cpu_supports_avx2(_cpuinfo(tmp_path, "fpu sse4_2 avx f16c"))
    assert cpu_compat.cpu_supports_avx2(tmp_path / "missing")  # unknown -> don't interfere


def test_guard_is_noop_with_avx2() -> None:
    mod = _fake_local_inference()

    assert cpu_compat.install_guard(avx2=True, module=mod) is False
    assert mod.init_vad() == "vad"


def test_guard_disables_only_the_avx2_initializers_and_is_idempotent() -> None:
    mod = _fake_local_inference()

    assert cpu_compat.install_guard(avx2=False, module=mod) is True
    first = mod.init_vad
    assert cpu_compat.install_guard(avx2=False, module=mod) is True
    assert mod.init_vad is first

    for name in ("init_vad", "init_eot"):
        with pytest.raises(RuntimeError, match="AVX2"):
            getattr(mod, name)()
    assert mod.other() == "untouched"
