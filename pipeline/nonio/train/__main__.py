"""CLI: monta painel, varre configs, treina a melhor, exporta previews.

    cd pipeline && uv run python -m nonio.train
    TRAIN_UNIVERSE=ALL uv run python -m nonio.train
"""

from __future__ import annotations

import polars as pl

from nonio.train import DEFAULT_UNIVERSE, MODELO_VERSAO
from nonio.train.dataset import (
    build_panel,
    labeled_rows,
    latest_feature_rows,
    resolve_universe,
)
from nonio.train.fit import (
    export_previews,
    fit_final,
    pick_best,
    predict_frame,
    save_artifact,
)


def main() -> None:
    universe = resolve_universe()
    head = ", ".join(universe[:12])
    suffix = "..." if len(universe) > 12 else ""
    print(f"universo ({len(universe)}): {head}{suffix}")
    print(f"modelo: {MODELO_VERSAO}")

    panel = build_panel(universe, horizon=252)
    labeled = labeled_rows(panel)
    print(
        f"painel={panel.height}  rotulados={labeled.height}  "
        f"pos_rate={labeled['y_beat_cdi'].mean():.3f}  "
        f"datas {labeled['date'].min()} -> {labeled['date'].max()}"
    )

    print("sweep walk-forward (embargo ~horizon, score 2024+):")
    cfg, scores = pick_best(labeled, horizon=252)
    if not scores:
        raise SystemExit("nenhum fold válido — abortando")

    print("fit final:")
    model, cols, blend_w = fit_final(labeled, cfg, horizon=252)
    save_artifact(
        model,
        cols,
        scores,
        n_labeled=labeled.height,
        universe=universe,
        cfg=cfg,
        blend_w=blend_w,
    )

    latest = latest_feature_rows(panel)
    if len(universe) > 40:
        latest = latest.filter(pl.col("code").is_in(list(DEFAULT_UNIVERSE)))

    preds = predict_frame(model, cols, latest, blend_w=blend_w, horizon=252)
    export_previews(preds)

    print("amostra previews:")
    for row in preds.sort("probabilidade", descending=True).head(8).to_dicts():
        print(
            f"  {row['code']:<6} p={row['probabilidade']:.3f}  "
            f"base={row['probabilidade_baseline']:.3f}  "
            f"ref={row['preco_referencia']:.2f}  asof={row['date']}"
        )


if __name__ == "__main__":
    main()
