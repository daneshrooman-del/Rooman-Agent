"""Command line:

    avatar-engine create path/to/reference.mp4
    avatar-engine generate av_xxx "Hello, welcome to Rooman." talk [--language hi]
    avatar-engine generate av_xxx speech.wav talk
    avatar-engine serve [--port 8100]
"""
from __future__ import annotations

import argparse
import json
import sys

from . import api


def _progress(i: int, msg: str) -> None:
    print(f"  [{i + 1}] {msg}", flush=True)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="avatar-engine")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("create", help="build a digital twin from a reference video")
    c.add_argument("video")
    g = sub.add_parser("generate", help="render the twin performing an action")
    g.add_argument("avatar_id")
    g.add_argument("script_or_audio")
    g.add_argument("action_type", nargs="?", default="talk")
    g.add_argument("--language", default="en")
    g.add_argument("--out")
    s = sub.add_parser("serve", help="run the HTTP API")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8100)
    a = ap.parse_args(argv)

    try:
        if a.cmd == "create":
            avatar_id = api.create_avatar(a.video, on_progress=_progress)
            print(json.dumps(api.get_avatar(avatar_id), indent=2))
        elif a.cmd == "generate":
            path = api.generate(a.avatar_id, a.script_or_audio, a.action_type, language=a.language, out_path=a.out, on_progress=_progress)
            print(json.dumps({"video": str(path), "consistency": json.loads(path.with_suffix(".consistency.json").read_text())}, indent=2))
        else:
            import uvicorn

            uvicorn.run("avatar_engine.server:app", host=a.host, port=a.port)
    except (api.IngestError, api.ActionNotSupported, api.AvatarNotFound, api.AvatarNotReady, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except api.ConsistencyError as e:
        print(f"rejected: {e}\nquarantined at {e.quarantined}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
