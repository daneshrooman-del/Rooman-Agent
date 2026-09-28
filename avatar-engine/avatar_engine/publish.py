"""Give a hosted provider (Tavus) a temporary public link to a local file.

Tavus only trains from a publicly downloadable URL. Instead of uploading the
person's face/voice video to a third-party file host, the file stays on this
machine:

  * a tiny file server (127.0.0.1:<port+1>) serves ONLY registered files, each
    under a random 128-bit token path that expires (default 24 h);
  * a Cloudflare quick tunnel (free, no account) exposes that server at a random
    https://<words>.trycloudflare.com address.

Set AVATAR_ENGINE_PUBLIC_URL to use your own public reverse proxy / domain instead.
The machine must stay online until the provider has downloaded the file.
"""
from __future__ import annotations

import atexit
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .config import ROOT, settings

CLOUDFLARED_URL = {
    "nt": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
    "posix": "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
}
TUNNEL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")

_files: dict[str, tuple[Path, float]] = {}  # token -> (path, expires_at)
_lock = threading.Lock()
_server: ThreadingHTTPServer | None = None
_tunnel: subprocess.Popen | None = None
_base_url: str | None = None


class PublishError(RuntimeError):
    pass


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parts = self.path.strip("/").split("/")
        if parts == ["health"]:
            self._send(200, b"ok", "text/plain")
            return
        token = parts[0] if parts else ""
        with _lock:
            entry = _files.get(token)
        if not entry or entry[1] < time.time() or not entry[0].exists():
            self._send(404, b"not found", "text/plain")
            return
        path = entry[0]
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(path.stat().st_size))
        self.end_headers()
        with path.open("rb") as f:
            shutil.copyfileobj(f, self.wfile)

    do_HEAD = do_GET

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args) -> None:  # keep logs quiet
        pass


def _file_port() -> int:
    return settings.port + 1


def _ensure_server() -> None:
    global _server
    if _server:
        return
    _server = ThreadingHTTPServer(("127.0.0.1", _file_port()), _Handler)
    threading.Thread(target=_server.serve_forever, daemon=True, name="publish-files").start()


def _cloudflared() -> Path:
    exe = ROOT / ".venvs" / "bin" / ("cloudflared.exe" if os.name == "nt" else "cloudflared")
    if not exe.exists():
        exe.parent.mkdir(parents=True, exist_ok=True)
        tmp = exe.with_suffix(".part")
        urllib.request.urlretrieve(CLOUDFLARED_URL["nt" if os.name == "nt" else "posix"], tmp)
        tmp.replace(exe)
        if os.name != "nt":
            exe.chmod(0o755)
    return exe


def _reachable(url: str, attempts: int = 30) -> bool:
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=5) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(2)
    return False


def _start_tunnel() -> str:
    global _tunnel
    proc = subprocess.Popen(
        [str(_cloudflared()), "tunnel", "--no-autoupdate", "--url", f"http://127.0.0.1:{_file_port()}"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace",
    )
    _tunnel = proc
    atexit.register(stop)
    deadline = time.time() + 90
    assert proc.stdout
    url: str | None = None
    while time.time() < deadline:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
        if not url and (m := TUNNEL_RE.search(line)):
            url = m.group(0)
        # Querying the hostname before the edge registers it makes Windows cache
        # a negative DNS answer for minutes — wait for registration first.
        if url and "Registered tunnel connection" in line:
            # drain the rest of the log so the pipe never blocks cloudflared
            threading.Thread(target=lambda: [None for _ in proc.stdout], daemon=True).start()  # type: ignore[union-attr]
            time.sleep(3)
            if not _reachable(url, attempts=15):
                # Local DNS can lag; Tavus resolves from its own network, so don't fail here.
                print(f"[publish] warning: {url} not reachable from this machine yet (local DNS cache?) — continuing", flush=True)
            return url
    stop()
    raise PublishError("Could not start a Cloudflare tunnel. Set AVATAR_ENGINE_PUBLIC_URL or check your internet connection.")


def base_url() -> str:
    global _base_url
    _ensure_server()
    if settings.public_base_url:
        return settings.public_base_url
    with _lock:
        tunnel_alive = _tunnel is not None and _tunnel.poll() is None
    if not _base_url or not tunnel_alive:
        _base_url = _start_tunnel()
    return _base_url


def publish(path: Path, ttl_seconds: int = 24 * 3600) -> str:
    """Public https URL for `path`, valid for ttl_seconds (unguessable token)."""
    path = Path(path).resolve()
    if not path.exists():
        raise FileNotFoundError(path)
    token = secrets.token_hex(16)
    with _lock:
        _files[token] = (path, time.time() + ttl_seconds)
    return f"{base_url()}/{token}/{path.name}"


def revoke(url: str) -> None:
    token = url.rstrip("/").split("/")[-2]
    with _lock:
        _files.pop(token, None)


def stop() -> None:
    global _tunnel, _base_url
    if _tunnel and _tunnel.poll() is None:
        _tunnel.terminate()
    _tunnel, _base_url = None, None
