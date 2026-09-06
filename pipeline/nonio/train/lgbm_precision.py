"""Precision-first LGBM search — crown by OOS ΔBrier vs null only.

Product still *lists* by P(beat CDI). Model *reward* is precision (Brier).
CS-IC is logged, never used to pick.

Ship gate: mean ΔBrier(2024+) > 0 (beats null). Else keep lowvol publish.

    cd pipeline && uv run python -m nonio.train.lgbm_precision
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

import lightgbm as lgb
import numpy as np
import polars as pl

from nonio.config import RAIZ
from nonio.train.cdi_eval import evaluate_scored, print_report
from nonio.train.dataset import (
    DAMPED_FEATURE_COLS,
    LEAN_FEATURE_COLS,
    PRICE_FEATURE_COLS,
    PRICE_MACRO_FEATURE_COLS,
    build_panel,
    labeled_rows,
    resolve_universe,
)
from nonio.train.fit import (
    FOLDS,
    TrainConfig,
    _active_cols,
    _mean_cs_ic,
    _thin,
    excess_to_prob,
    lowvol_to_excess,
    scored_fold_frame_spine,
)

HORIZON = 63
THIN = 5
LEADERBOARD = RAIZ / "data" / "models" / "lgbm_precision_leaderboard.json"

# --- what we select ----------------------------------------------------------
# Primary: mean ΔBrier 2024+ (baseline Brier − model Brier); higher = better
# Ship gate: primary > 0  (beats null booth)
# Not selected on: CS-IC, spread, RMSE, train loss


@dataclass
class Row:
    name: str
    kind: str  # ref | regress | clf | residual
    mean_brier_delta_2024plus: float | None
    mean_brier_model_2024plus: float | None
    mean_cs_ic_2024plus: float | None
    n_scored: int
    beats_null: bool
    notes: str = ""


def _brier_means(report: dict) -> tuple[float | None, float | None]:
    folds = [f for f in (report.get("folds") or []) if f["fold"] >= "2024-01-01"]
    if not folds:
        folds = report.get("folds") or []
    if not folds:
        return None, None
    delta = float(np.mean([f["brier_delta"] for f in folds]))
    model = float(np.mean([f["brier_model"] for f in folds]))
    return delta, model


def _cs(scored: pl.DataFrame) -> float:
    if scored.is_empty():
        return float("nan")
    recent = scored.filter(pl.col("fold") >= "2024-01-01")
    if recent.is_empty():
        recent = scored
    min_names = 8 if recent["code"].n_unique() < 30 else 15
    return _mean_cs_ic(
        recent.rename({"excess_previsto": "pred"}),
        "pred",
        min_names=min_names,
    )


def _pack(name: str, kind: str, scored: pl.DataFrame, notes: str = "") -> Row:
    report = evaluate_scored(scored)
    print(f"\n--- [{name}] ---", flush=True)
    print_report(report)
    delta, brier_m = _brier_means(report)
    cs = _cs(scored)
    return Row(
        name=name,
        kind=kind,
        mean_brier_delta_2024plus=delta,
        mean_brier_model_2024plus=brier_m,
        mean_cs_ic_2024plus=float(cs) if cs == cs else None,
        n_scored=scored.height,
        beats_null=bool(delta is not None and delta > 0),
        notes=notes,
    )


def _scored_regress(labeled: pl.DataFrame, cfg: TrainConfig) -> pl.DataFrame:
    cols = _active_cols(labeled, cfg.feature_cols)
    base = labeled.drop_nulls(subset=[*cols, "y_excess", "y_beat_cdi"])
    embargo = max(30, int(HORIZON * 365 / 252))
    pieces: list[pl.DataFrame] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), cfg.thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            cfg.thin_every,
        )
        if train.height < 80 or test.height < 20:
            continue
        cut = train["date"].quantile(0.85, interpolation="nearest")
        tr = train.filter(pl.col("date") < cut)
        va = train.filter(pl.col("date") >= cut)
        if tr.height < 60:
            tr, va = train, train
        model = lgb.LGBMRegressor(
            n_estimators=cfg.n_estimators,
            learning_rate=cfg.learning_rate,
            num_leaves=cfg.num_leaves,
            min_child_samples=cfg.min_child_samples,
            subsample=cfg.subsample,
            colsample_bytree=cfg.colsample_bytree,
            reg_lambda=cfg.reg_lambda,
            reg_alpha=cfg.reg_alpha,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        model.fit(
            tr.select(cols).to_numpy(),
            tr["y_excess"].to_numpy(),
            eval_set=[(va.select(cols).to_numpy(), va["y_excess"].to_numpy())],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        excess = np.asarray(model.predict(test.select(cols).to_numpy()), dtype=np.float64)
        p, p0 = excess_to_prob(test, excess, horizon=HORIZON)
        pieces.append(
            test.select(
                ["code", "date", "y_excess", "y_beat_cdi", "ret_stock", "ret_cdi"]
            ).with_columns(
                pl.Series("excess_previsto", excess),
                pl.Series("probabilidade", p),
                pl.Series("probabilidade_baseline", p0),
                pl.lit(str(test_start)).alias("fold"),
            )
        )
    return pl.concat(pieces, how="vertical_relaxed") if pieces else pl.DataFrame()


def _scored_clf(labeled: pl.DataFrame, cfg: TrainConfig) -> pl.DataFrame:
    """Direct P(beat CDI) via LGBMClassifier — aligns reward with Brier."""
    cols = _active_cols(labeled, cfg.feature_cols)
    base = labeled.drop_nulls(subset=[*cols, "y_beat_cdi", "y_excess"])
    embargo = max(30, int(HORIZON * 365 / 252))
    pieces: list[pl.DataFrame] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), cfg.thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            cfg.thin_every,
        )
        if train.height < 80 or test.height < 20:
            continue
        cut = train["date"].quantile(0.85, interpolation="nearest")
        tr = train.filter(pl.col("date") < cut)
        va = train.filter(pl.col("date") >= cut)
        if tr.height < 60:
            tr, va = train, train
        model = lgb.LGBMClassifier(
            n_estimators=cfg.n_estimators,
            learning_rate=cfg.learning_rate,
            num_leaves=cfg.num_leaves,
            min_child_samples=cfg.min_child_samples,
            subsample=cfg.subsample,
            colsample_bytree=cfg.colsample_bytree,
            reg_lambda=cfg.reg_lambda,
            reg_alpha=cfg.reg_alpha,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        y_tr = tr["y_beat_cdi"].to_numpy().astype(int)
        y_va = va["y_beat_cdi"].to_numpy().astype(int)
        model.fit(
            tr.select(cols).to_numpy(),
            y_tr,
            eval_set=[(va.select(cols).to_numpy(), y_va)],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        proba = model.predict_proba(test.select(cols).to_numpy())[:, 1]
        # excess_previsto only for CS-IC diagnostic / quintiles — use centered score
        excess = (proba - 0.5) * 0.2
        _, p0 = excess_to_prob(test, np.zeros(test.height), horizon=HORIZON)
        pieces.append(
            test.select(
                ["code", "date", "y_excess", "y_beat_cdi", "ret_stock", "ret_cdi"]
            ).with_columns(
                pl.Series("excess_previsto", excess),
                pl.Series("probabilidade", proba),
                pl.Series("probabilidade_baseline", p0),
                pl.lit(str(test_start)).alias("fold"),
            )
        )
    return pl.concat(pieces, how="vertical_relaxed") if pieces else pl.DataFrame()


def _scored_residual(labeled: pl.DataFrame, cfg: TrainConfig) -> pl.DataFrame:
    """lowvol spine + LGBM residual on excess; always add residual (no CS gate)."""
    cols = _active_cols(labeled, cfg.feature_cols)
    need = [*cols, "lowvol_score", "y_excess", "y_beat_cdi"]
    base = labeled.drop_nulls(subset=need)
    embargo = max(30, int(HORIZON * 365 / 252))
    pieces: list[pl.DataFrame] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), cfg.thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            cfg.thin_every,
        )
        if train.height < 80 or test.height < 20:
            continue
        cut = train["date"].quantile(0.85, interpolation="nearest")
        tr = train.filter(pl.col("date") < cut)
        va = train.filter(pl.col("date") >= cut)
        if tr.height < 60:
            tr, va = train, train
        lv_tr = lowvol_to_excess(tr)
        lv_va = lowvol_to_excess(va)
        lv_te = lowvol_to_excess(test)
        model = lgb.LGBMRegressor(
            n_estimators=cfg.n_estimators,
            learning_rate=cfg.learning_rate,
            num_leaves=cfg.num_leaves,
            min_child_samples=cfg.min_child_samples,
            subsample=cfg.subsample,
            colsample_bytree=cfg.colsample_bytree,
            reg_lambda=cfg.reg_lambda,
            reg_alpha=cfg.reg_alpha,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        model.fit(
            tr.select(cols).to_numpy(),
            tr["y_excess"].to_numpy() - lv_tr,
            eval_set=[
                (va.select(cols).to_numpy(), va["y_excess"].to_numpy() - lv_va)
            ],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        excess = lv_te + model.predict(test.select(cols).to_numpy())
        p, p0 = excess_to_prob(test, excess, horizon=HORIZON)
        pieces.append(
            test.select(
                ["code", "date", "y_excess", "y_beat_cdi", "ret_stock", "ret_cdi"]
            ).with_columns(
                pl.Series("excess_previsto", excess),
                pl.Series("probabilidade", p),
                pl.Series("probabilidade_baseline", p0),
                pl.lit(str(test_start)).alias("fold"),
            )
        )
    return pl.concat(pieces, how="vertical_relaxed") if pieces else pl.DataFrame()


def _cfg(name: str, cols: tuple[str, ...], **kw) -> TrainConfig:
    base = dict(
        thin_every=THIN,
        n_estimators=250,
        learning_rate=0.03,
        num_leaves=7,
        min_child_samples=80,
        reg_lambda=20.0,
        reg_alpha=2.0,
        subsample=0.8,
        colsample_bytree=0.7,
    )
    base.update(kw)
    return TrainConfig(name=name, feature_cols=cols, **base)


def main() -> None:
    universe = resolve_universe()
    print(
        f"lgbm precision search  horizon={HORIZON}d  n={len(universe)}\n"
        f"SELECT on: mean dBrier(2024+)   SHIP if > 0 vs null\n"
        f"NOT select on: CS-IC / spread",
        flush=True,
    )
    panel = build_panel(universe, horizon=HORIZON)
    labeled = labeled_rows(panel)
    print(
        f"labeled={labeled.height} beat_rate={labeled['y_beat_cdi'].mean():.3f}",
        flush=True,
    )

    rows: list[Row] = []

    # Reference: current ship
    print("\n=== REF lowvol ===", flush=True)
    rows.append(
        _pack(
            "lowvol",
            "ref",
            scored_fold_frame_spine(labeled, horizon=HORIZON, mode="lowvol"),
            notes="current ship",
        )
    )

    candidates: list[tuple[str, str, object]] = [
        (
            "reg_price_strong",
            "regress",
            _cfg("reg_price_strong", tuple(PRICE_FEATURE_COLS)),
        ),
        (
            "reg_lean_strong",
            "regress",
            _cfg("reg_lean_strong", tuple(LEAN_FEATURE_COLS)),
        ),
        (
            "reg_damped_strong",
            "regress",
            _cfg("reg_damped_strong", tuple(DAMPED_FEATURE_COLS)),
        ),
        (
            "reg_macro_strong",
            "regress",
            _cfg("reg_macro_strong", tuple(PRICE_MACRO_FEATURE_COLS)),
        ),
        (
            "clf_price",
            "clf",
            _cfg("clf_price", tuple(PRICE_FEATURE_COLS)),
        ),
        (
            "clf_damped",
            "clf",
            _cfg("clf_damped", tuple(DAMPED_FEATURE_COLS)),
        ),
        (
            "clf_lean",
            "clf",
            _cfg("clf_lean", tuple(LEAN_FEATURE_COLS)),
        ),
        (
            "resid_damped",
            "residual",
            _cfg(
                "resid_damped",
                tuple(DAMPED_FEATURE_COLS),
                n_estimators=200,
                learning_rate=0.05,
            ),
        ),
    ]

    for name, kind, cfg in candidates:
        assert isinstance(cfg, TrainConfig)
        print(f"\n=== {kind.upper()} {name} ===", flush=True)
        if kind == "regress":
            scored = _scored_regress(labeled, cfg)
        elif kind == "clf":
            scored = _scored_clf(labeled, cfg)
        else:
            scored = _scored_residual(labeled, cfg)
        rows.append(_pack(name, kind, scored, notes=cfg.name))

    ranked = sorted(
        [r for r in rows if r.mean_brier_delta_2024plus is not None],
        key=lambda r: float(r.mean_brier_delta_2024plus),
        reverse=True,
    )
    print("\n======== PRECISION LEADERBOARD (dBrier 2024+) ========", flush=True)
    for i, r in enumerate(ranked, 1):
        flag = "SHIP?" if r.beats_null else "no"
        print(
            f"{i:2d}. {r.name:<22} dBrier={r.mean_brier_delta_2024plus:+.4f}  "
            f"brier={r.mean_brier_model_2024plus:.4f}  "
            f"CS={r.mean_cs_ic_2024plus:+.4f}  [{flag}]",
            flush=True,
        )

    best = ranked[0] if ranked else None
    ship = next((r for r in ranked if r.beats_null), None)
    if ship is None:
        print(
            "\nVERDICT: nobody beats null on precision — keep lowvol publish.",
            flush=True,
        )
    else:
        print(
            f"\nVERDICT: {ship.name} clears ship gate "
            f"(dBrier={ship.mean_brier_delta_2024plus:+.4f}).",
            flush=True,
        )
    if best and (ship is None or best.name != ship.name):
        print(
            f"(best dBrier overall still: {best.name} "
            f"{best.mean_brier_delta_2024plus:+.4f})",
            flush=True,
        )

    LEADERBOARD.parent.mkdir(parents=True, exist_ok=True)
    LEADERBOARD.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "selection": "mean_brier_delta_2024plus",
                "ship_gate": "mean_brier_delta_2024plus > 0",
                "not_used_for_selection": ["cs_ic", "spread"],
                "winner_ship": ship.name if ship else None,
                "winner_best": best.name if best else None,
                "rows": [asdict(r) for r in ranked],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"leaderboard: {LEADERBOARD}", flush=True)


if __name__ == "__main__":
    main()
