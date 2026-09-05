"""Varredura barata no alvo de excesso (IC), com CDI report no vencedor.

    cd pipeline && uv run python -m nonio.train.experiments
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

import polars as pl

from nonio.config import RAIZ
from nonio.train import DEFAULT_UNIVERSE, MODELO_VERSAO
from nonio.train.cdi_eval import evaluate_scored, print_report
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
    mean_ic,
    predict_frame,
    save_artifact,
    scored_fold_frame,
    walk_forward,
)

HORIZONS = (63, 126, 252)
PACKS = ("price", "price_macro", "lean", "full")
UNIVERSES = ("ibov20", "long4")

LEADERBOARD_PATH = RAIZ / "data" / "models" / "experiment_leaderboard.json"


@dataclass
class ExperimentRow:
    universe: str
    horizon: int
    pack: str
    mean_ic_2024plus: float
    folds: int
    n_labeled: int


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
    return TrainConfig(
        name=f"{pack}-h{horizon}",
        feature_cols=tuple(FEATURE_PACKS[pack]),
        thin_every=max(5, horizon // 12),
        num_leaves=7,
        min_child_samples=50 if horizon <= 126 else 80,
        reg_lambda=12.0,
        n_estimators=250,
    )


def run_sweep(*, export_winner: bool = True) -> list[ExperimentRow]:
    rows: list[ExperimentRow] = []
    best: tuple | None = None

    for uni in UNIVERSES:
        codes = _universe_codes(uni)
        print(f"\n======== universo={uni} n={len(codes)} ========", flush=True)
        for horizon in HORIZONS:
            panel = build_panel(codes, horizon=horizon)
            labeled = labeled_rows(panel)
            print(
                f"  labeled={labeled.height} excess_mean={labeled['y_excess'].mean():+.3f}",
                flush=True,
            )
            for pack in PACKS:
                cfg = _cfg_for(pack, horizon)
                print(f"\n>> {uni} h={horizon} pack={pack}", flush=True)
                scores = walk_forward(labeled, cfg, horizon=horizon)
                if not scores:
                    continue
                ic = mean_ic(scores)
                row = ExperimentRow(
                    universe=uni,
                    horizon=horizon,
                    pack=pack,
                    mean_ic_2024plus=ic,
                    folds=len(scores),
                    n_labeled=labeled.height,
                )
                rows.append(row)
                print(f"  SUMMARY IC={ic:+.4f} folds={len(scores)}", flush=True)
                if best is None or ic > best[0]:
                    best = (ic, row, scores, cfg, panel, codes)

    rows.sort(key=lambda r: r.mean_ic_2024plus, reverse=True)
    LEADERBOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    LEADERBOARD_PATH.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "metric": "mean_spearman_ic_2024plus",
                "train_target": "y_excess",
                "rows": [asdict(r) for r in rows],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print("\n======== LEADERBOARD (top 10 by IC) ========", flush=True)
    for i, r in enumerate(rows[:10], 1):
        print(
            f"{i:2d}. IC={r.mean_ic_2024plus:+.4f}  h={r.horizon:<3}  "
            f"pack={r.pack:<12}  uni={r.universe}",
            flush=True,
        )

    if export_winner and best is not None:
        ic, row, scores, cfg, panel, codes = best
        print(f"\nexportando vencedor IC={ic:+.4f} h={row.horizon} {row.pack}", flush=True)
        labeled = labeled_rows(panel)
        model, cols = fit_final(labeled, cfg, horizon=row.horizon)
        scored = scored_fold_frame(model, cols, labeled, cfg, horizon=row.horizon)
        cdi_report = evaluate_scored(scored)
        print_report(cdi_report)

        import nonio.train as train_mod
        import nonio.train.fit as fit_mod

        tag = f"lgbm-excess-h{row.horizon}-{row.pack}"
        train_mod.MODELO_VERSAO = tag
        fit_mod.MODELO_VERSAO = tag
        save_artifact(
            model,
            cols,
            scores,
            n_labeled=labeled.height,
            universe=codes,
            cfg=cfg,
            cdi_report=cdi_report,
        )
        latest = latest_feature_rows(panel)
        if len(codes) > 40:
            latest = latest.filter(pl.col("code").is_in(list(DEFAULT_UNIVERSE)))
        export_previews(predict_frame(model, cols, latest, horizon=row.horizon))

    return rows


def main() -> None:
    run_sweep(export_winner=True)


if __name__ == "__main__":
    main()
