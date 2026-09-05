"""Cache generico em disco por fonte (mesmo contrato do brapi_cache)."""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from nonio.config import RAIZ


def _enabled() -> bool:
    return os.getenv("SOURCE_CACHE", "1").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def _ttl() -> int:
    raw = os.getenv("SOURCE_CACHE_TTL_HOURS", os.getenv("BRAPI_CACHE_TTL_HOURS", "48"))
    try:
        return max(0, int(float(raw.strip()) * 3600))
    except ValueError:
        return 48 * 3600


def _dir(source: str) -> Path:
    return RAIZ / "data" / "cache" / source


def _key(url: str, params: dict | None) -> str:
    flat = urlencode(sorted((params or {}).items()), doseq=True)
    return hashlib.sha256(f"{url}?{flat}".encode()).hexdigest()[:32]


def read(source: str, url: str, params: dict | None = None) -> Any | None:
    if not _enabled():
        return None
    path = _dir(source) / f"{_key(url, params)}.json"
    if not path.exists():
        return None
    ttl = _ttl()
    if ttl > 0 and time.time() - path.stat().st_mtime > ttl:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write(source: str, url: str, params: dict | None, payload: Any) -> Path | None:
    if not _enabled():
        return None
    folder = _dir(source)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{_key(url, params)}.json"
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return path
