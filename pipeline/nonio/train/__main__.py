"""CLI: low-vol spine (+ gated dampened residual), then CDI eval.

    cd pipeline && uv run python -m nonio.train
    TRAIN_UNIVERSE=ALL uv run python -m nonio.train
"""

from __future__ import annotations

import polars as pl

from nonio.train import DEFAULT_UNIVERSE, MODELO_VERSAO
from nonio.train.cdi_eval import evaluate_scored, print_report
from nonio.train.dataset import (
    PRICE_FEATURE_COLS,
    build_panel,
    labeled_rows,
    latest_feature_rows,
    resolve_universe,
)
from nonio.train.fit import (
    TrainConfig,
    export_previews,
    fit_residual_final,
    mean_cs_ic,
    predict_frame_spine,
    save_spine_artifact,
    scored_fold_frame_spine,
    walk_forward,
    walk_forward_lowvol,
    walk_forward_lowvol_gated,
)

# diagnostics showed stable CS-IC at ~3m, not 12m
HORIZON = 63


def main() -> None:
    universe = resolve_universe()
    head = ", ".join(universe[:12])
    suffix = "..." if len(universe) > 12 else ""
    print(f"universo ({len(universe)}): {head}{suffix}")
    print(f"modelo: {MODELO_VERSAO}  horizon={HORIZON}d  spine=lowvol")

    panel = build_panel(universe, horizon=HORIZON)
    labeled = labeled_rows(panel)
    print(
        f"painel={panel.height}  rotulados={labeled.height}  "
        f"excess_mean={labeled['y_excess'].mean():+.3f}  "
        f"beat_rate={labeled['y_beat_cdi'].mean():.3f}  "
        f"datas {labeled['date'].min()} -> {labeled['date'].max()}"
    )

    print("\n=== status quo LGBM (price) — referência ===", flush=True)
    status_cfg = TrainConfig(
        name="price-status",
        feature_cols=tuple(PRICE_FEATURE_COLS),
        thin_every=5,
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=7,
        min_child_samples=50,
        reg_lambda=10.0,
    )
    status_scores = walk_forward(labeled, status_cfg, horizon=HORIZON)
    status_cs = mean_cs_ic(status_scores)
    print(f"  → mean CS-IC(2024+)={status_cs:+.4f}", flush=True)

    print("\n=== low-vol spine ===", flush=True)
    lowvol_scores = walk_forward_lowvol(labeled, horizon=HORIZON)
    lowvol_cs = mean_cs_ic(lowvol_scores)
    print(f"  → mean CS-IC(2024+)={lowvol_cs:+.4f}", flush=True)

    print("\n=== low-vol + gated dampened residual ===", flush=True)
    gated_scores, gated_cfg = walk_forward_lowvol_gated(labeled, horizon=HORIZON)
    gated_cs = mean_cs_ic(gated_scores)
    print(f"  → mean CS-IC(2024+)={gated_cs:+.4f}", flush=True)

    print("\n=== escolha ===", flush=True)
    candidates = [
        ("lowvol", lowvol_cs, lowvol_scores, None),
        ("gated", gated_cs, gated_scores, gated_cfg),
    ]
    mode, best_cs, scores, cfg = max(candidates, key=lambda t: t[1])
    print(
        f"vencedor: {mode}  CS={best_cs:+.4f}  "
        f"(status quo LGBM CS={status_cs:+.4f}, "
        f"Δ={best_cs - status_cs:+.4f})",
        flush=True,
    )
    if best_cs <= status_cs:
        print(
            "aviso: spine não bateu status quo neste universo — "
            "ainda exportamos o spine (métrica CS é a correta p/ ranking)",
            flush=True,
        )

    model = None
    cols: list[str] | None = None
    if mode == "gated":
        print("fit residual final:", flush=True)
        model, cols = fit_residual_final(labeled, cfg)

    print("CDI validation / stock backtest:", flush=True)
    scored = scored_fold_frame_spine(
        labeled, horizon=HORIZON, mode=mode, cfg=cfg
    )
    cdi_report = evaluate_scored(scored)
    print_report(cdi_report)

    save_spine_artifact(
        scores,
        mode=mode,
        n_labeled=labeled.height,
        universe=universe,
        horizon=HORIZON,
        cfg=cfg,
        model=model,
        cols=cols,
        cdi_report=cdi_report,
    )

    latest = latest_feature_rows(panel)
    if len(universe) > 40:
        latest = latest.filter(pl.col("code").is_in(list(DEFAULT_UNIVERSE)))

    preds = predict_frame_spine(
        latest, horizon=HORIZON, mode=mode, model=model, cols=cols
    )
    export_previews(preds)

    print("amostra previews (por excesso previsto):")
    for row in preds.sort("excess_previsto", descending=True).head(8).to_dicts():
        print(
            f"  {row['code']:<6} excess={row['excess_previsto']:+.3f}  "
            f"p={row['probabilidade']:.3f}  "
            f"base={row['probabilidade_baseline']:.3f}  "
            f"ref={row['preco_referencia']:.2f}"
        )


if __name__ == "__main__":
    main()
