"""Retorno / probabilidade 12m acima do CDI — lê o artifact do treino."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import polars as pl

from app.config import settings

_PREVIEWS = settings.parquet_root / "models" / "previews_lgbm.parquet"


@lru_cache(maxsize=1)
def _load_previews() -> pl.DataFrame | None:
    path = Path(_PREVIEWS)
    if not path.exists():
        return None
    return pl.read_parquet(path)


def return_above_cdi_12m(code: str) -> float | None:
    """Probabilidade prevista de bater o CDI em 12m (modelo lgbm), ou None."""
    df = _load_previews()
    if df is None or df.is_empty():
        return None
    hit = df.filter(pl.col("code") == code.strip().upper())
    if hit.is_empty():
        return None
    return float(hit["probabilidade"][0])


def clear_preview_cache() -> None:
    _load_previews.cache_clear()
