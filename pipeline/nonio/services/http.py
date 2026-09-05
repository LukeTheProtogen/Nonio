"""GET JSON que não confia só no status HTTP (armadilha do SGS)."""

from __future__ import annotations

import time

import requests


class FonteIndisponivel(RuntimeError):
    """A fonte respondeu, mas não com o dado pedido."""


def get_json(
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    tentativas: int = 4,
    timeout: int = 90,
) -> dict | list:
    espera = 2.0
    for n in range(1, tentativas + 1):
        r = requests.get(url, params=params, headers=headers, timeout=timeout)
        tipo = r.headers.get("content-type", "")
        if r.ok and "json" in tipo.lower():
            try:
                return r.json()
            except ValueError:
                pass
        if n < tentativas:
            time.sleep(espera)
            espera *= 2
            continue
        raise FonteIndisponivel(
            f"{url} respondeu HTTP {r.status_code}, content-type '{tipo}', "
            f"{len(r.content)} bytes, após {tentativas} tentativas."
        )
