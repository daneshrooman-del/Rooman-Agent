"""Repo-wide test fixtures.

The test suite must be hermetic against a developer's local `.env` file (e.g. one
created for manual live-testing against a real LiveKit/Piper/Qdrant setup, following
the steps in the project's manual-verification guide) -- a test that behaves
differently depending on whatever happens to be sitting in `.env` on the machine
running it is not a real test. `Settings` (`trackb.config`) reads `TRACKB_`-prefixed
env vars and a `.env` file by default; this fixture strips both for every test.
"""

from __future__ import annotations

import os

import pytest

from trackb.config import Settings


@pytest.fixture(autouse=True)
def _isolated_settings_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in list(os.environ):
        if key.startswith("TRACKB_"):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setitem(Settings.model_config, "env_file", None)
