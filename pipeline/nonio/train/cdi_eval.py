"""Camada CDI — NÃO entra no critério de treino.

Recebe previsões de excesso (já feitas) e responde:
  1) Brier de P(beat CDI) mapeado do excesso vs baseline excess=0
  2) backtest simples: top vs bottom quintil por excesso previsto
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import polars as pl

from nonio import avaliacao as A


@dataclass
class CdiFoldReport:
    fold: str
    n: int
    brier_model: float
    brier_baseline: float
    brier_delta: float
    top_quintile_beat_rate: float
    bottom_quintile_beat_rate: float
    spread_beat_rate: float
    top_mean_excess: float
    bottom_mean_excess: float


def _quintile_stats(df: pl.DataFrame) -> tuple[float, float, float, float, float]:
    if df.height < 20:
        return (float("nan"),) * 5
    # rank-based buckets — qcut breaks when predictions collapse
    q = (
        df.with_columns(
            (pl.col("excess_previsto").rank(method="average") / pl.len())
            .alias("_pct")
        )
        .with_columns(
            pl.when(pl.col("_pct") >= 0.8)
            .then(pl.lit("top"))
            .when(pl.col("_pct") <= 0.2)
            .then(pl.lit("bot"))
            .otherwise(pl.lit("mid"))
            .alias("bucket")
        )
    )
    top = q.filter(pl.col("bucket") == "top")
    bot = q.filter(pl.col("bucket") == "bot")
    if top.height == 0 or bot.height == 0:
        return (float("nan"),) * 5
    top_beat = float(top["y_beat_cdi"].mean())
    bot_beat = float(bot["y_beat_cdi"].mean())
    return (
        top_beat,
        bot_beat,
        top_beat - bot_beat,
        float(top["y_excess"].mean()),
        float(bot["y_excess"].mean()),
    )


def evaluate_scored(scored: pl.DataFrame) -> dict:
    if scored.is_empty():
        return {"folds": [], "mean_brier_delta_2024plus": None, "mean_spread_2024plus": None}

    folds: list[CdiFoldReport] = []
    for fold in scored["fold"].unique().sort().to_list():
        part = scored.filter(pl.col("fold") == fold)
        y = part["y_beat_cdi"].to_numpy().astype(float)
        p = part["probabilidade"].to_numpy()
        p0 = part["probabilidade_baseline"].to_numpy()
        brier_m = A.brier(p, y)
        brier_0 = A.brier(p0, y)
        top_b, bot_b, spread, top_x, bot_x = _quintile_stats(part)
        folds.append(
            CdiFoldReport(
                fold=str(fold),
                n=part.height,
                brier_model=brier_m,
                brier_baseline=brier_0,
                brier_delta=brier_0 - brier_m,
                top_quintile_beat_rate=top_b,
                bottom_quintile_beat_rate=bot_b,
                spread_beat_rate=spread,
                top_mean_excess=top_x,
                bottom_mean_excess=bot_x,
            )
        )

    recent = [f for f in folds if f.fold >= "2024-01-01"] or folds
    report = {
        "folds": [asdict(f) for f in folds],
        "mean_brier_delta_2024plus": float(np.mean([f.brier_delta for f in recent])),
        "mean_spread_2024plus": float(
            np.nanmean([f.spread_beat_rate for f in recent])
        ),
        "mean_top_excess_2024plus": float(
            np.nanmean([f.top_mean_excess for f in recent])
        ),
    }
    return report


def print_report(report: dict) -> None:
    print("CDI eval (not used for model selection):", flush=True)
    for f in report.get("folds") or []:
        print(
            f"  fold {f['fold']}: ΔBrier={f['brier_delta']:+.4f}  "
            f"top_beat={f['top_quintile_beat_rate']:.1%}  "
            f"bot_beat={f['bottom_quintile_beat_rate']:.1%}  "
            f"spread={f['spread_beat_rate']:+.1%}  "
            f"top_excess={f['top_mean_excess']:+.1%}  n={f['n']}",
            flush=True,
        )
    print(
        f"  mean ΔBrier(2024+)={report.get('mean_brier_delta_2024plus')}  "
        f"mean spread={report.get('mean_spread_2024plus')}  "
        f"mean top excess={report.get('mean_top_excess_2024plus')}",
        flush=True,
    )
