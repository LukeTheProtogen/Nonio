"""Bake-off: algorithm vs OSS defaults vs optional pretrained Chronos.

Crown by mean ΔBrier (2024+) vs null baseline — CS-IC / spread are secondary.

    cd pipeline && uv run python -m nonio.train.compare
    COMPARE_ARMS=A,B uv run python -m nonio.train.compare
    COMPARE_INCLUDE_CHRONOS=1 uv run python -m nonio.train.compare

Arms:
  A  - lowvol algorithm (no fit)
  B  - OSS defaults: LGBM library defaults + sklearn HistGradientBoosting defaults
  M  - our status-quo LGBM (price-status from nonio.train)
  C  - amazon/chronos-bolt-tiny zero-shot (optional; needs chronos-forecasting + torch)
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.ensemble import HistGradientBoostingRegressor

from nonio.config import RAIZ
from nonio.train.cdi_eval import evaluate_scored, print_report
from nonio.train.dataset import PRICE_FEATURE_COLS, build_panel, labeled_rows, resolve_universe
from nonio.train.fit import (
    FOLDS,
    TrainConfig,
    _active_cols,
    _mean_cs_ic,
    _thin,
    _xy_excess,
    excess_to_prob,
    lowvol_to_excess,
    mean_cs_ic,
    scored_fold_frame,
    scored_fold_frame_spine,
    walk_forward,
    walk_forward_lowvol,
)

HORIZON = 63
LEADERBOARD_PATH = RAIZ / "data" / "models" / "compare_leaderboard.json"
THIN_EVERY = 5

# LightGBM "public defaults" - library-ish, not our tuned TrainConfig.
LGBM_DEFAULTS = TrainConfig(
    name="lgbm-defaults",
    feature_cols=tuple(PRICE_FEATURE_COLS),
    thin_every=THIN_EVERY,
    n_estimators=100,
    learning_rate=0.1,
    num_leaves=31,
    min_child_samples=20,
    reg_lambda=0.0,
    reg_alpha=0.0,
    subsample=1.0,
    colsample_bytree=1.0,
)

# Status-quo LGBM from nonio.train.__main__ (our quick/tuned price model).
LGBM_STATUS = TrainConfig(
    name="price-status",
    feature_cols=tuple(PRICE_FEATURE_COLS),
    thin_every=THIN_EVERY,
    n_estimators=300,
    learning_rate=0.05,
    num_leaves=7,
    min_child_samples=50,
    reg_lambda=10.0,
)


@dataclass
class ArmResult:
    arm: str
    family: str  # A | B | C
    mean_brier_delta_2024plus: float | None
    mean_spread_2024plus: float | None
    mean_cs_ic_2024plus: float | None
    n_scored: int
    notes: str = ""
    cdi_report: dict | None = None


def _cs_ic_scored(scored: pl.DataFrame) -> float:
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


def _pack(
    arm: str,
    family: str,
    scored: pl.DataFrame,
    *,
    cs_ic: float | None = None,
    notes: str = "",
) -> ArmResult:
    report = evaluate_scored(scored)
    print(f"\n--- CDI eval [{arm}] ---", flush=True)
    print_report(report)
    return ArmResult(
        arm=arm,
        family=family,
        mean_brier_delta_2024plus=report.get("mean_brier_delta_2024plus"),
        mean_spread_2024plus=report.get("mean_spread_2024plus"),
        mean_cs_ic_2024plus=(
            float(cs_ic) if cs_ic is not None else float(_cs_ic_scored(scored))
        ),
        n_scored=scored.height,
        notes=notes,
        cdi_report=report,
    )


def _run_lowvol(labeled: pl.DataFrame) -> ArmResult:
    print("\n=== A: lowvol algorithm ===", flush=True)
    scores = walk_forward_lowvol(labeled, horizon=HORIZON, thin_every=THIN_EVERY)
    cs = mean_cs_ic(scores)
    print(f"  -> mean CS-IC(2024+)={cs:+.4f}", flush=True)
    scored = scored_fold_frame_spine(labeled, horizon=HORIZON, mode="lowvol")
    return _pack("A_lowvol", "A", scored, cs_ic=cs, notes="algorithm spine")


def _run_lgbm_defaults(labeled: pl.DataFrame) -> ArmResult:
    print("\n=== B: LGBM public defaults ===", flush=True)
    cfg = LGBM_DEFAULTS
    scores = walk_forward(labeled, cfg, horizon=HORIZON)
    cs = mean_cs_ic(scores)
    print(f"  -> mean CS-IC(2024+)={cs:+.4f}", flush=True)
    # scored_fold_frame refits OOS; pass dummy model
    dummy = lgb.LGBMRegressor(n_estimators=1, verbose=-1)
    scored = scored_fold_frame(dummy, _active_cols(labeled, cfg.feature_cols), labeled, cfg, horizon=HORIZON)
    return _pack("B_lgbm_defaults", "B", scored, cs_ic=cs, notes="lightgbm library-ish defaults")


def _run_lgbm_status(labeled: pl.DataFrame) -> ArmResult:
    print("\n=== M: our status-quo LGBM (price-status) ===", flush=True)
    cfg = LGBM_STATUS
    scores = walk_forward(labeled, cfg, horizon=HORIZON)
    cs = mean_cs_ic(scores)
    print(f"  -> mean CS-IC(2024+)={cs:+.4f}", flush=True)
    dummy = lgb.LGBMRegressor(n_estimators=1, verbose=-1)
    scored = scored_fold_frame(
        dummy, _active_cols(labeled, cfg.feature_cols), labeled, cfg, horizon=HORIZON
    )
    return _pack(
        "M_lgbm_status",
        "M",
        scored,
        cs_ic=cs,
        notes="our TrainConfig price-status from nonio.train",
    )


def _scored_fold_sklearn(
    labeled: pl.DataFrame,
    cols: list[str],
    *,
    horizon: int,
    thin_every: int,
    factory: Callable[[], object],
) -> pl.DataFrame:
    base = labeled.drop_nulls(subset=[*cols, "y_excess", "y_beat_cdi"])
    embargo = max(30, int(horizon * 365 / 252))
    pieces: list[pl.DataFrame] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            thin_every,
        )
        if train.height < 80 or test.height < 20:
            continue
        cut = train["date"].quantile(0.85, interpolation="nearest")
        tr = train.filter(pl.col("date") < cut)
        if tr.height < 60:
            tr = train
        model = factory()
        x_tr, y_tr = _xy_excess(tr, cols)
        model.fit(x_tr, y_tr)
        excess = np.asarray(model.predict(test.select(cols).to_numpy()), dtype=np.float64)
        p, p0 = excess_to_prob(test, excess, horizon=horizon)
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
    if not pieces:
        return pl.DataFrame()
    return pl.concat(pieces, how="vertical_relaxed")


def _run_sklearn_defaults(labeled: pl.DataFrame) -> ArmResult:
    print("\n=== B: sklearn HistGradientBoosting defaults ===", flush=True)
    cols = _active_cols(labeled, tuple(PRICE_FEATURE_COLS))

    def factory():
        return HistGradientBoostingRegressor(random_state=42)

    scored = _scored_fold_sklearn(
        labeled, cols, horizon=HORIZON, thin_every=THIN_EVERY, factory=factory
    )
    # CS-IC from scored OOS preds
    cs = _cs_ic_scored(scored)
    print(f"  -> mean CS-IC(2024+) from scored={cs:+.4f}", flush=True)
    return _pack(
        "B_sklearn_hgbr",
        "B",
        scored,
        cs_ic=cs,
        notes="sklearn HistGradientBoostingRegressor defaults",
    )


def _chronos_available() -> tuple[bool, str]:
    try:
        import torch  # noqa: F401
        from chronos import BaseChronosPipeline  # noqa: F401

        return True, ""
    except Exception as exc:  # noqa: BLE001 — report any import failure
        return False, f"{type(exc).__name__}: {exc}"


def _run_chronos(labeled: pl.DataFrame, prices: pl.DataFrame) -> ArmResult:
    """Zero-shot Chronos-Bolt-Tiny: forecast close -> excess vs CDI proxy."""
    print("\n=== C: chronos-bolt-tiny (zero-shot) ===", flush=True)
    ok, err = _chronos_available()
    if not ok:
        print(f"  skip: chronos/torch not installed ({err})", flush=True)
        return ArmResult(
            arm="C_chronos_bolt_tiny",
            family="C",
            mean_brier_delta_2024plus=None,
            mean_spread_2024plus=None,
            mean_cs_ic_2024plus=None,
            n_scored=0,
            notes=f"skipped - install chronos-forecasting + torch ({err})",
        )

    import torch
    from chronos import BaseChronosPipeline

    model_id = os.getenv("COMPARE_CHRONOS_MODEL", "amazon/chronos-bolt-tiny")
    print(f"  loading {model_id}...", flush=True)
    pipeline = BaseChronosPipeline.from_pretrained(
        model_id,
        device_map="cpu",
        torch_dtype=torch.float32,
    )

    closes: dict[str, pl.DataFrame] = {}
    for key, g in prices.group_by("code"):
        code = key[0] if isinstance(key, tuple) else key
        closes[str(code)] = g.sort("date").select(["date", "close"])

    need = ["y_excess", "y_beat_cdi", "cdi_pct", "close"]
    missing = [c for c in need if c not in labeled.columns]
    if missing:
        return ArmResult(
            arm="C_chronos_bolt_tiny",
            family="C",
            mean_brier_delta_2024plus=None,
            mean_spread_2024plus=None,
            mean_cs_ic_2024plus=None,
            n_scored=0,
            notes=f"labeled missing cols {missing}",
        )
    base = labeled.drop_nulls(subset=need)
    context_len = int(os.getenv("COMPARE_CHRONOS_CONTEXT", "256"))
    batch_size = int(os.getenv("COMPARE_CHRONOS_BATCH", "32"))
    thin_c = int(os.getenv("COMPARE_CHRONOS_THIN", str(max(THIN_EVERY, 10))))
    pieces: list[pl.DataFrame] = []

    for test_start, test_end in FOLDS:
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            thin_c,
        )
        if test.height < 20:
            continue
        print(
            f"  [chronos] fold {test_start}..{test_end} n={test.height} "
            f"thin={thin_c} batch={batch_size}...",
            flush=True,
        )
        rows = test.select(["code", "date", "close", "cdi_pct"]).to_dicts()
        excesses = np.zeros(len(rows), dtype=np.float64)
        contexts: list[np.ndarray] = []
        valid_idx: list[int] = []
        for i, row in enumerate(rows):
            hist = closes.get(row["code"])
            if hist is None:
                continue
            ctx = hist.filter(pl.col("date") <= row["date"]).tail(context_len)
            if ctx.height < 32:
                continue
            arr = ctx["close"].to_numpy().astype(np.float32)
            if arr.shape[0] < context_len:
                pad = np.full(context_len - arr.shape[0], arr[0], dtype=np.float32)
                arr = np.concatenate([pad, arr])
            contexts.append(arr)
            valid_idx.append(i)

        for start in range(0, len(contexts), batch_size):
            chunk = contexts[start : start + batch_size]
            idx_chunk = valid_idx[start : start + batch_size]
            tensor = torch.tensor(np.stack(chunk), dtype=torch.float32)
            forecast = pipeline.predict(tensor, prediction_length=HORIZON)
            arr_f = forecast.detach().cpu().numpy()
            q = arr_f.shape[1] // 2 if arr_f.ndim == 3 else 0
            for j, i in enumerate(idx_chunk):
                p0 = float(rows[i]["close"])
                if arr_f.ndim == 3:
                    p_hat = float(arr_f[j, q, -1])
                else:
                    p_hat = float(arr_f[j, -1])
                if not np.isfinite(p_hat) or p0 <= 0:
                    continue
                ret_hat = p_hat / p0 - 1.0
                cdi_d = float(rows[i]["cdi_pct"])
                if not np.isfinite(cdi_d):
                    cdi_d = 0.05
                ret_cdi_hat = (1.0 + cdi_d / 100.0) ** HORIZON - 1.0
                excesses[i] = float(np.clip(ret_hat - ret_cdi_hat, -0.5, 0.5))

        p, p0b = excess_to_prob(test, excesses, horizon=HORIZON)
        pieces.append(
            test.select(
                ["code", "date", "y_excess", "y_beat_cdi", "ret_stock", "ret_cdi"]
            ).with_columns(
                pl.Series("excess_previsto", excesses),
                pl.Series("probabilidade", p),
                pl.Series("probabilidade_baseline", p0b),
                pl.lit(str(test_start)).alias("fold"),
            )
        )

    if not pieces:
        return ArmResult(
            arm="C_chronos_bolt_tiny",
            family="C",
            mean_brier_delta_2024plus=None,
            mean_spread_2024plus=None,
            mean_cs_ic_2024plus=None,
            n_scored=0,
            notes="no chronos folds produced",
        )
    scored = pl.concat(pieces, how="vertical_relaxed")
    return _pack(
        "C_chronos_bolt_tiny",
        "C",
        scored,
        notes=f"zero-shot {model_id}; map close->excess vs CDI proxy",
    )


def _wanted_arms() -> set[str]:
    raw = os.getenv("COMPARE_ARMS", "A,B").strip().upper()
    if not raw:
        return {"A", "B"}
    return {a.strip() for a in raw.split(",") if a.strip()}


def _crown(results: list[ArmResult]) -> ArmResult | None:
    usable = [
        r
        for r in results
        if r.mean_brier_delta_2024plus is not None
        and r.n_scored > 0
        and r.mean_spread_2024plus is not None
        and r.mean_spread_2024plus == r.mean_spread_2024plus  # not NaN
    ]
    if not usable:
        # fall back: any scored arm
        usable = [
            r
            for r in results
            if r.mean_brier_delta_2024plus is not None and r.n_scored > 0
        ]
    if not usable:
        return None

    def key(r: ArmResult) -> tuple:
        spread = r.mean_spread_2024plus
        if spread is None or spread != spread:
            spread = float("-inf")
        cs = r.mean_cs_ic_2024plus
        if cs is None or cs != cs:
            cs = float("-inf")
        return (
            float(r.mean_brier_delta_2024plus),
            float(spread),
            float(cs),
        )

    return max(usable, key=key)


def run_compare() -> list[ArmResult]:
    wanted = _wanted_arms()
    if os.getenv("COMPARE_INCLUDE_CHRONOS", "").strip() in {"1", "true", "yes"}:
        wanted.add("C")

    universe = resolve_universe()
    print(
        f"compare bake-off  horizon={HORIZON}d  arms={sorted(wanted)}  "
        f"n_tickers={len(universe)}",
        flush=True,
    )
    panel = build_panel(universe, horizon=HORIZON)
    labeled = labeled_rows(panel)
    print(
        f"painel={panel.height}  rotulados={labeled.height}  "
        f"beat_rate={labeled['y_beat_cdi'].mean():.3f}",
        flush=True,
    )

    results: list[ArmResult] = []
    if "A" in wanted:
        results.append(_run_lowvol(labeled))
    if "B" in wanted:
        results.append(_run_lgbm_defaults(labeled))
        results.append(_run_sklearn_defaults(labeled))
    if "M" in wanted:
        results.append(_run_lgbm_status(labeled))
    if "C" in wanted:
        prices = panel.select(["code", "date", "close"]).unique(subset=["code", "date"])
        results.append(_run_chronos(labeled, prices))

    winner = _crown(results)
    print("\n======== COMPARE LEADERBOARD (by dBrier 2024+) ========", flush=True)
    ranked = sorted(
        [r for r in results if r.mean_brier_delta_2024plus is not None],
        key=lambda r: float(r.mean_brier_delta_2024plus or float("-inf")),
        reverse=True,
    )
    for i, r in enumerate(ranked, 1):
        print(
            f"{i:2d}. {r.arm:<22} dBrier={r.mean_brier_delta_2024plus:+.4f}  "
            f"spread={r.mean_spread_2024plus:+.3f}  "
            f"CS-IC={r.mean_cs_ic_2024plus:+.4f}  n={r.n_scored}",
            flush=True,
        )
    skipped = [r for r in results if r.mean_brier_delta_2024plus is None]
    for r in skipped:
        print(f"  - {r.arm}: {r.notes}", flush=True)

    if winner is None:
        print("vencedor: nenhum braco com score", flush=True)
    else:
        beat_null = (winner.mean_brier_delta_2024plus or 0) > 0
        print(
            f"vencedor: {winner.arm}  dBrier={winner.mean_brier_delta_2024plus:+.4f}  "
            f"bate_null={'sim' if beat_null else 'NAO'}",
            flush=True,
        )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "horizon": HORIZON,
        "selection_metric": "mean_brier_delta_2024plus",
        "secondary": ["mean_spread_2024plus", "mean_cs_ic_2024plus"],
        "winner": winner.arm if winner else None,
        "arms": [
            {
                **{k: v for k, v in asdict(r).items() if k != "cdi_report"},
                "cdi_report": r.cdi_report,
            }
            for r in results
        ],
    }
    LEADERBOARD_PATH.parent.mkdir(parents=True, exist_ok=True)
    LEADERBOARD_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"leaderboard: {LEADERBOARD_PATH}", flush=True)
    return results


def main() -> None:
    run_compare()


if __name__ == "__main__":
    main()
