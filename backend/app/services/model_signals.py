"""Retorno / probabilidade acima do CDI — lê o artifact do treino (lowvol spine)."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import polars as pl

from app.config import settings

_PREVIEWS = settings.parquet_root / "models" / "previews_lgbm.parquet"


@dataclass(frozen=True)
class PreviewSignal:
    code: str
    probabilidade: float
    probabilidade_baseline: float | None
    horizonte_meses: int
    modelo_versao: str
    calculado_em: str
    preco_referencia: float | None
    excess_previsto: float | None


@lru_cache(maxsize=1)
def _load_previews() -> pl.DataFrame | None:
    path = Path(_PREVIEWS)
    if not path.exists():
        return None
    return pl.read_parquet(path)


def clear_preview_cache() -> None:
    _load_previews.cache_clear()


def all_preview_signals() -> list[PreviewSignal]:
    df = _load_previews()
    if df is None or df.is_empty():
        return []
    # latest row per code if multiples ever appear
    if "date" in df.columns:
        df = df.sort("date").unique(subset=["code"], keep="last")
    out: list[PreviewSignal] = []
    for row in df.to_dicts():
        calc = str(row.get("calculado_em") or "")
        if calc and "+" not in calc[10:] and not calc.endswith("Z"):
            calc = calc + "+00:00"
        if calc.endswith("Z"):
            calc = calc[:-1] + "+00:00"
        out.append(
            PreviewSignal(
                code=str(row["code"]).upper(),
                probabilidade=float(row["probabilidade"]),
                probabilidade_baseline=(
                    float(row["probabilidade_baseline"])
                    if row.get("probabilidade_baseline") is not None
                    else None
                ),
                horizonte_meses=int(row.get("horizonte_meses") or 3),
                modelo_versao=str(row.get("modelo_versao") or "unknown"),
                calculado_em=calc or "1970-01-01T00:00:00+00:00",
                preco_referencia=(
                    float(row["preco_referencia"])
                    if row.get("preco_referencia") is not None
                    else None
                ),
                excess_previsto=(
                    float(row["excess_previsto"])
                    if row.get("excess_previsto") is not None
                    else None
                ),
            )
        )
    return out


def preview_for(code: str) -> PreviewSignal | None:
    wanted = code.strip().upper()
    for sig in all_preview_signals():
        if sig.code == wanted:
            return sig
    return None


def return_above_cdi_12m(code: str) -> float | None:
    """Compat: probabilidade do spine (horizonte do artifact, tipicamente 3m)."""
    sig = preview_for(code)
    return None if sig is None else sig.probabilidade
