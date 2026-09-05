"""Cache em disco das respostas brapi — respeita o teto de 15k req/mês.

TTL padrão: 48h (alinhado ao refresh de 2 dias). Chave = URL + query params
(sem o token). Desligar com BRAPI_CACHE=0; forçar miss com force=True.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from nonio.config import RAIZ

CACHE_DIR = RAIZ / "data" / "cache" / "brapi"


def cache_enabled() -> bool:
    return os.getenv("BRAPI_CACHE", "1").strip().lower() not in {"0", "false", "no", "off"}


def cache_ttl_seconds() -> int:
    raw = os.getenv("BRAPI_CACHE_TTL_HOURS", "48").strip()
    try:
        hours = float(raw)
    except ValueError:
        hours = 48.0
    return max(0, int(hours * 3600))


def _key(url: str, params: dict | None) -> str:
    flat = urlencode(sorted((params or {}).items()), doseq=True)
    digest = hashlib.sha256(f"{url}?{flat}".encode()).hexdigest()[:32]
    return digest


def _path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def read(url: str, params: dict | None = None) -> Any | None:
    if not cache_enabled():
        return None
    path = _path(_key(url, params))
    if not path.exists():
        return None
    ttl = cache_ttl_seconds()
    age = time.time() - path.stat().st_mtime
    if ttl > 0 and age > ttl:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write(url: str, params: dict | None, payload: Any) -> Path | None:
    if not cache_enabled():
        return None
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _path(_key(url, params))
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return path


def clear() -> int:
    """Apaga entradas do cache. Retorna quantos arquivos removeu."""
    if not CACHE_DIR.exists():
        return 0
    n = 0
    for path in CACHE_DIR.glob("*.json"):
        path.unlink(missing_ok=True)
        n += 1
    return n
