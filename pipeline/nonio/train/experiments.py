"""Varredura barata: horizonte × pacote de features × universo.

    cd pipeline && uv run python -m nonio.train.experiments
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

from nonio.config import RAIZ
from nonio.train import DEFAULT_UNIVERSE, MODELO_VERSAO
from nonio.train.dataset import (
    FEATURE_PACKS,
    build_panel,
    labeled_rows,
    latest_feature_rows,
    resolve_universe,
)
from nonio.train.fit import (
    TrainConfig,
    export_previews,
    fit_final,
    mean_brier_delta,
    predict_frame,
    save_artifact,
    walk_forward,
)

HORIZONS = (63, 126, 252)  # ~3m, 6m, 12m
PACKS = ("price", "price_macro", "lean", "full")
UNIVERSES = ("ibov20", "long4", "all")

LEADERBOARD_PATH = RAIZ / "data" / "models" / "experiment_leaderboard.json"


@dataclass
class ExperimentRow:
    universe: str
    horizon: int
    pack: str
    mean_delta_2024plus: float
    wins: int
    folds: int
    n_labeled: int
    pos_rate: float


def _universe_codes(name: str) -> list[str]:
    if name == "ibov20":
        os.environ.pop("TRAIN_UNIVERSE", None)
        return resolve_universe()
    if name == "long4":
        os.environ["TRAIN_UNIVERSE"] = "PETR4,VALE3,ITUB4,MGLU3"
        return resolve_universe()
    if name == "all":
        os.environ["TRAIN_UNIVERSE"] = "ALL"
        return resolve_universe()
    raise ValueError(name)


def _cfg_for(pack: str, horizon: int) -> TrainConfig:
    thin = max(5, horizon // 12)
    return TrainConfig(
        name=f"{pack}-h{horizon}",
        feature_cols=tuple(FEATURE_PACKS[pack]),
        thin_every=thin,
        num_leaves=7,
        min_child_samples=50 if horizon <= 126 else 80,
        reg_lambda=12.0,
        n_estimators=250,
        blend_baseline=0.4,
    )


def run_sweep(*, export_winner: bool = True) -> list[ExperimentRow]:
    rows: list[ExperimentRow] = []
    best: tuple[float, ExperimentRow, list, TrainConfig, pl.DataFrame, list[str]] | None = None

    for uni in UNIVERSES:
        codes = _universe_codes(uni)
        print(f"\n======== universo={uni} n={len(codes)} ========", flush=True)
        for horizon in HORIZONS:
            panel = build_panel(codes, horizon=horizon)
            labeled = labeled_rows(panel)
            print(
                f"  labeled={labeled.height} pos={labeled['y_beat_cdi'].mean():.3f} "
                f"{labeled['date'].min()}->{labeled['date'].max()}",
                flush=True,
            )
            for pack in PACKS:
                cfg = _cfg_for(pack, horizon)
                print(f"\n>> {uni} h={horizon} pack={pack}", flush=True)
                scores = walk_forward(labeled, cfg, horizon=horizon)
                if not scores:
                    print("  (sem folds)", flush=True)
                    continue
                delta = mean_brier_delta(scores)
                wins = sum(1 for s in scores if s.brier_model < s.brier_baseline)
                row = ExperimentRow(
                    universe=uni,
                    horizon=horizon,
                    pack=pack,
                    mean_delta_2024plus=delta,
                    wins=wins,
                    folds=len(scores),
                    n_labeled=labeled.height,
                    pos_rate=float(labeled["y_beat_cdi"].mean()),
                )
                rows.append(row)
                print(
                    f"  SUMMARY Δ={delta:+.4f} wins={wins}/{len(scores)}",
                    flush=True,
                )
                if best is None or delta > best[0]:
                    best = (delta, row, scores, cfg, panel, codes)

    rows.sort(key=lambda r: r.mean_delta_2024plus, reverse=True)
    LEADERBOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metric": "mean_brier_delta_2024plus",
        "rows": [asdict(r) for r in rows],
    }
    LEADERBOARD_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print("\n======== LEADERBOARD (top 12) ========", flush=True)
    for i, r in enumerate(rows[:12], 1):
        print(
            f"{i:2d}. Δ={r.mean_delta_2024plus:+.4f}  "
            f"h={r.horizon:<3}  pack={r.pack:<12}  uni={r.universe:<6}  "
            f"wins={r.wins}/{r.folds}  n={r.n_labeled}",
            flush=True,
        )
    print(f"\nsalvo: {LEADERBOARD_PATH}", flush=True)

    if export_winner and best is not None:
        delta, row, scores, cfg, panel, codes = best
        print(
            f"\nexportando vencedor: h={row.horizon} pack={row.pack} "
            f"uni={row.universe} Δ={delta:+.4f}",
            flush=True,
        )
        labeled = labeled_rows(panel)
        model, cols, blend_w = fit_final(labeled, cfg, horizon=row.horizon)
        # tag versão com horizonte
        import nonio.train as train_mod
        import nonio.train.fit as fit_mod

        tag = f"lgbm-cdi-h{row.horizon}-{row.pack}"
        train_mod.MODELO_VERSAO = tag
        fit_mod.MODELO_VERSAO = tag
        save_artifact(
            model,
            cols,
            scores,
            n_labeled=labeled.height,
            universe=codes,
            cfg=cfg,
            blend_w=blend_w,
        )
        latest = latest_feature_rows(panel)
        if len(codes) > 40:
            latest = latest.filter(pl.col("code").is_in(list(DEFAULT_UNIVERSE)))
        preds = predict_frame(
            model, cols, latest, blend_w=blend_w, horizon=row.horizon
        )
        export_previews(preds)

    return rows


def main() -> None:
    run_sweep(export_winner=True)


if __name__ == "__main__":
    main()
