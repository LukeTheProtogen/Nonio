"""LightGBM regressor on excess return (stock − CDI).

Training skill ≠ CDI product metric:
  - train / pick_best → IC + RMSE vs predict-zero
  - CDI Brier / portfolio → `cdi_eval.py` after the fact
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import polars as pl
from scipy.stats import spearmanr

from nonio.config import RAIZ
from nonio.probabilidade import MODELO as BASELINE_NAME
from nonio.probabilidade import prob_bater_cdi
from nonio.train import MODELO_VERSAO
from nonio.train.dataset import DAMPED_FEATURE_COLS, FEATURE_COLS, LEAN_FEATURE_COLS

ARTIFACT_DIR = RAIZ / "data" / "models"
PREDICTIONS_PATH = RAIZ / "data" / "parquet" / "models" / "previews_lgbm.parquet"

# map cross-sectional lowvol z-score → modest excess for P(beat CDI)
LOWVOL_EXCESS_SCALE = 0.05
LOWVOL_EXCESS_CLIP = 0.15

FOLDS = [
    (date(2023, 1, 1), date(2023, 12, 31)),
    (date(2024, 1, 1), date(2024, 12, 31)),
    (date(2025, 1, 1), date(2025, 12, 31)),
]


@dataclass
class FoldScore:
    train_end: str
    test_start: str
    test_end: str
    n_train: int
    n_test: int
    ic_spearman: float
    rmse_model: float
    rmse_zero: float
    rmse_skill: float
    cs_ic_spearman: float = float("nan")
    used_residual: bool = False


@dataclass(frozen=True)
class TrainConfig:
    name: str
    feature_cols: tuple[str, ...]
    thin_every: int = 21
    n_estimators: int = 300
    learning_rate: float = 0.05
    num_leaves: int = 7
    min_child_samples: int = 50
    reg_lambda: float = 10.0
    reg_alpha: float = 1.0
    subsample: float = 0.8
    colsample_bytree: float = 0.7


DAMPED_RESIDUAL_CFG = TrainConfig(
    name="damped-residual",
    feature_cols=tuple(DAMPED_FEATURE_COLS),
    thin_every=5,
    n_estimators=200,
    learning_rate=0.05,
    num_leaves=7,
    min_child_samples=50,
    reg_lambda=12.0,
)

CONFIGS: list[TrainConfig] = [
    TrainConfig(name="lean", feature_cols=tuple(LEAN_FEATURE_COLS), thin_every=21),
    TrainConfig(
        name="price-macro",
        feature_cols=(
            "vol_60",
            "vol_120",
            "mom_3m",
            "mom_6m",
            "mom_12m",
            "dd_52w",
            "cdi_pct",
            "selic_meta_aa",
            "taxa_real_aprox",
            "p_baseline",
        ),
        thin_every=21,
        reg_lambda=12.0,
    ),
    TrainConfig(
        name="full",
        feature_cols=tuple(FEATURE_COLS),
        thin_every=21,
        num_leaves=7,
        min_child_samples=80,
        reg_lambda=15.0,
        n_estimators=250,
    ),
]


def _rmse(y: np.ndarray, yhat: np.ndarray) -> float:
    d = y - yhat
    return float(np.sqrt(np.mean(d * d)))


def _ic(y: np.ndarray, yhat: np.ndarray) -> float:
    if y.size < 5 or np.std(y) < 1e-12 or np.std(yhat) < 1e-12:
        return 0.0
    corr, _ = spearmanr(yhat, y)
    return float(corr) if corr == corr else 0.0


def _mean_cs_ic(
    df: pl.DataFrame,
    pred_col: str,
    y_col: str = "y_excess",
    *,
    min_names: int = 8,
) -> float:
    vals: list[float] = []
    for _, g in df.group_by("date"):
        if g.height < min_names:
            continue
        r = _ic(g[y_col].to_numpy(), g[pred_col].to_numpy())
        if r == r:  # not NaN
            vals.append(r)
    return float(np.mean(vals)) if vals else float("nan")


def lowvol_to_excess(df: pl.DataFrame) -> np.ndarray:
    """Cross-sectional z of lowvol_score → clipped excess proxy."""
    score = df["lowvol_score"].to_numpy().astype(np.float64)
    if "date" in df.columns and df["date"].n_unique() > 1:
        out = (
            df.with_columns(
                (
                    (
                        pl.col("lowvol_score")
                        - pl.col("lowvol_score").mean().over("date")
                    )
                    / pl.col("lowvol_score")
                    .std()
                    .over("date")
                    .clip(1e-6, None)
                    * LOWVOL_EXCESS_SCALE
                )
                .clip(-LOWVOL_EXCESS_CLIP, LOWVOL_EXCESS_CLIP)
                .alias("_ex")
            )["_ex"]
            .to_numpy()
            .astype(np.float64)
        )
        return np.nan_to_num(out, nan=0.0)
    mu = float(np.nanmean(score))
    sd = float(np.nanstd(score))
    if sd < 1e-12:
        return np.zeros(len(score))
    z = (score - mu) / sd
    return np.clip(LOWVOL_EXCESS_SCALE * z, -LOWVOL_EXCESS_CLIP, LOWVOL_EXCESS_CLIP)

def _xy_excess(df: pl.DataFrame, cols: list[str]) -> tuple[np.ndarray, np.ndarray]:
    x = df.select(cols).to_numpy()
    y = df["y_excess"].to_numpy().astype(np.float64)
    return x, y


def _thin(df: pl.DataFrame, every: int) -> pl.DataFrame:
    return (
        df.sort(["code", "date"])
        .with_columns(pl.arange(0, pl.len()).over("code").alias("_i"))
        .filter(pl.col("_i") % every == 0)
        .drop("_i")
    )


def make_lgbm(cfg: TrainConfig) -> lgb.LGBMRegressor:
    return lgb.LGBMRegressor(
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


def _active_cols(labeled: pl.DataFrame, wanted: tuple[str, ...]) -> list[str]:
    return [c for c in wanted if c in labeled.columns]


def walk_forward(
    labeled: pl.DataFrame,
    cfg: TrainConfig,
    *,
    horizon: int = 252,
) -> list[FoldScore]:
    cols = _active_cols(labeled, cfg.feature_cols)
    base = labeled.drop_nulls(subset=[*cols, "y_excess"])
    embargo = max(30, int(horizon * 365 / 252))
    scores: list[FoldScore] = []
    min_train = 80 if horizon <= 126 else 120
    min_test = 20 if horizon <= 126 else 30

    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), cfg.thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            cfg.thin_every,
        )
        if train.height < min_train or test.height < min_test:
            print(
                f"  [{cfg.name}] fold {test_start}..{test_end}: "
                f"train={train.height} test={test.height} — pulado",
                flush=True,
            )
            continue

        cut = train["date"].quantile(0.85, interpolation="nearest")
        tr = train.filter(pl.col("date") < cut)
        va = train.filter(pl.col("date") >= cut)
        if tr.height < 60 or va.height < 15:
            tr, va = train, train

        x_tr, y_tr = _xy_excess(tr, cols)
        x_va, y_va = _xy_excess(va, cols)
        x_te, y_te = _xy_excess(test, cols)

        model = make_lgbm(cfg)
        model.fit(
            x_tr,
            y_tr,
            eval_set=[(x_va, y_va)],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        yhat = model.predict(x_te)
        rmse_m = _rmse(y_te, yhat)
        rmse_0 = _rmse(y_te, np.zeros_like(y_te))
        ic = _ic(y_te, yhat)
        skill = 1.0 - rmse_m / rmse_0 if rmse_0 > 1e-12 else float("nan")
        te_scored = test.with_columns(pl.Series("pred", yhat))
        cs = _mean_cs_ic(te_scored, "pred", min_names=8 if test["code"].n_unique() < 30 else 15)

        scores.append(
            FoldScore(
                train_end=str(train_end),
                test_start=str(test_start),
                test_end=str(test_end),
                n_train=train.height,
                n_test=test.height,
                ic_spearman=ic,
                rmse_model=rmse_m,
                rmse_zero=rmse_0,
                rmse_skill=float(skill),
                cs_ic_spearman=cs,
            )
        )
        s = scores[-1]
        print(
            f"  [{cfg.name}] {s.test_start}..{s.test_end}: "
            f"IC={s.ic_spearman:+.3f}  CS={s.cs_ic_spearman:+.3f}  "
            f"RMSE={s.rmse_model:.3f} vs0={s.rmse_zero:.3f}  "
            f"skill={s.rmse_skill:+.3f}  n_tr={s.n_train} n_te={s.n_test}",
            flush=True,
        )
    return scores


def mean_ic(scores: list[FoldScore]) -> float:
    usable = [s for s in scores if s.test_start >= "2024-01-01"]
    if not usable:
        usable = scores
    if not usable:
        return float("-inf")
    return float(np.mean([s.ic_spearman for s in usable]))


def mean_cs_ic(scores: list[FoldScore]) -> float:
    usable = [s for s in scores if s.test_start >= "2024-01-01"]
    if not usable:
        usable = scores
    vals = [s.cs_ic_spearman for s in usable if s.cs_ic_spearman == s.cs_ic_spearman]
    if not vals:
        return float("-inf")
    return float(np.mean(vals))


def pick_best(
    labeled: pl.DataFrame,
    configs: list[TrainConfig] | None = None,
    *,
    horizon: int = 252,
) -> tuple[TrainConfig, list[FoldScore]]:
    configs = configs or CONFIGS
    best_cfg: TrainConfig | None = None
    best_scores: list[FoldScore] = []
    best_ic = float("-inf")
    for cfg in configs:
        print(f"config: {cfg.name}", flush=True)
        scores = walk_forward(labeled, cfg, horizon=horizon)
        ic = mean_ic(scores)
        print(f"  → mean IC(2024+)={ic:+.4f}  folds={len(scores)}", flush=True)
        if ic > best_ic:
            best_ic = ic
            best_cfg = cfg
            best_scores = scores
    assert best_cfg is not None
    print(f"melhor: {best_cfg.name} (mean IC={best_ic:+.4f})", flush=True)
    return best_cfg, best_scores


def fit_final(
    labeled: pl.DataFrame,
    cfg: TrainConfig,
    *,
    horizon: int = 252,
) -> tuple[lgb.LGBMRegressor, list[str]]:
    del horizon  # API parity with callers
    cols = _active_cols(labeled, cfg.feature_cols)
    train = _thin(labeled.drop_nulls(subset=[*cols, "y_excess"]), cfg.thin_every)
    cut = train["date"].quantile(0.85, interpolation="nearest")
    tr = train.filter(pl.col("date") < cut)
    va = train.filter(pl.col("date") >= cut)
    if tr.height < 80:
        tr, va = train, train
    model = make_lgbm(cfg)
    model.fit(
        *_xy_excess(tr, cols),
        eval_set=[_xy_excess(va, cols)],
        callbacks=[lgb.early_stopping(40, verbose=False)],
    )
    print(
        f"  fit final [{cfg.name}]: {train.height} thinned, "
        f"best_iter={getattr(model, 'best_iteration_', model.n_estimators)}",
        flush=True,
    )
    return model, cols


def save_artifact(
    model: lgb.LGBMRegressor,
    cols: list[str],
    scores: list[FoldScore],
    *,
    n_labeled: int,
    universe: list[str],
    cfg: TrainConfig,
    cdi_report: dict | None = None,
) -> Path:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACT_DIR / f"{MODELO_VERSAO}.txt"
    model.booster_.save_model(str(model_path))
    meta = {
        "modelo_versao": MODELO_VERSAO,
        "train_target": "y_excess (ret_stock - ret_cdi)",
        "train_metric": "spearman_ic",
        "baseline_train": "predict excess=0",
        "product_baseline": BASELINE_NAME,
        "config": asdict(cfg),
        "feature_cols": cols,
        "n_labeled": n_labeled,
        "universe": universe,
        "mean_ic_2024plus": mean_ic(scores),
        "cdi_eval": cdi_report,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "folds": [asdict(s) for s in scores],
    }
    meta_path = ARTIFACT_DIR / f"{MODELO_VERSAO}.json"
    meta_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  artifact: {model_path}", flush=True)
    print(f"  meta:     {meta_path}", flush=True)
    return model_path


def predict_excess(
    model: lgb.LGBMRegressor, cols: list[str], rows: pl.DataFrame
) -> np.ndarray:
    return model.predict(rows.select(cols).to_numpy())


def excess_to_prob(
    rows: pl.DataFrame, excess: np.ndarray, *, horizon: int
) -> tuple[np.ndarray, np.ndarray]:
    """Map predicted excess → P(beat CDI) via lognormal; baseline = excess 0."""
    anos = horizon / 252
    vols = rows["vol_60"].fill_null(rows["vol_20"]).fill_null(0.3).to_numpy()
    p = []
    p0 = []
    for vol, ex in zip(vols, excess, strict=True):
        v = float(vol) if vol == vol and float(vol) > 1e-6 else 0.3
        e = float(np.clip(ex, -0.5, 0.5))
        p.append(prob_bater_cdi(v, excesso=e, anos=anos))
        p0.append(prob_bater_cdi(v, excesso=0.0, anos=anos))
    return np.array(p), np.array(p0)


def predict_frame(
    model: lgb.LGBMRegressor,
    cols: list[str],
    rows: pl.DataFrame,
    *,
    horizon: int = 252,
) -> pl.DataFrame:
    excess = predict_excess(model, cols, rows)
    p, p0 = excess_to_prob(rows, excess, horizon=horizon)
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    meses = max(1, round(horizon / 21))
    return rows.select(["code", "date", "close"]).with_columns(
        pl.Series("excess_previsto", excess),
        pl.Series("probabilidade", p),
        pl.Series("probabilidade_baseline", p0),
        pl.lit(meses).alias("horizonte_meses"),
        pl.col("close").alias("preco_referencia"),
        pl.lit(MODELO_VERSAO).alias("modelo_versao"),
        pl.lit(agora.isoformat()).alias("calculado_em"),
    )


def export_previews(preds: pl.DataFrame) -> Path:
    path = PREDICTIONS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    preds.write_parquet(path)
    print(f"  previews: {path} ({preds.height} linhas)", flush=True)
    return path


def scored_fold_frame(
    _model: lgb.LGBMRegressor,
    cols: list[str],
    labeled: pl.DataFrame,
    cfg: TrainConfig,
    *,
    horizon: int,
) -> pl.DataFrame:
    """Walk-forward test rows with OOS predictions — for CDI eval / backtest."""
    base = labeled.drop_nulls(subset=[*cols, "y_excess", "y_beat_cdi"])
    embargo = max(30, int(horizon * 365 / 252))
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
        m = make_lgbm(cfg)
        m.fit(
            *_xy_excess(tr, cols),
            eval_set=[_xy_excess(va, cols)],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        excess = m.predict(test.select(cols).to_numpy())
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


def walk_forward_lowvol(
    labeled: pl.DataFrame,
    *,
    horizon: int = 63,
    thin_every: int = 5,
) -> list[FoldScore]:
    """Pure low-vol spine — no LGBM."""
    base = labeled.drop_nulls(subset=["lowvol_score", "y_excess"])
    embargo = max(30, int(horizon * 365 / 252))
    min_names = 8 if base["code"].n_unique() < 30 else 15
    scores: list[FoldScore] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(base.filter(pl.col("date") < train_end), thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            thin_every,
        )
        if test.height < 20:
            continue
        yhat = lowvol_to_excess(test)
        y_te = test["y_excess"].to_numpy()
        te = test.with_columns(pl.Series("pred", yhat))
        cs = _mean_cs_ic(te, "pred", min_names=min_names)
        ic = _ic(y_te, yhat)
        rmse_m = _rmse(y_te, yhat)
        rmse_0 = _rmse(y_te, np.zeros_like(y_te))
        skill = 1.0 - rmse_m / rmse_0 if rmse_0 > 1e-12 else float("nan")
        s = FoldScore(
            train_end=str(train_end),
            test_start=str(test_start),
            test_end=str(test_end),
            n_train=train.height,
            n_test=test.height,
            ic_spearman=ic,
            rmse_model=rmse_m,
            rmse_zero=rmse_0,
            rmse_skill=float(skill),
            cs_ic_spearman=cs,
            used_residual=False,
        )
        scores.append(s)
        print(
            f"  [lowvol] {s.test_start}..{s.test_end}: "
            f"IC={s.ic_spearman:+.3f}  CS={s.cs_ic_spearman:+.3f}  "
            f"n_te={s.n_test}",
            flush=True,
        )
    return scores


def walk_forward_lowvol_gated(
    labeled: pl.DataFrame,
    *,
    horizon: int = 63,
    cfg: TrainConfig | None = None,
) -> tuple[list[FoldScore], TrainConfig]:
    """Low-vol spine + dampened residual LGBM only if val CS-IC improves."""
    cfg = cfg or DAMPED_RESIDUAL_CFG
    cols = _active_cols(labeled, cfg.feature_cols)
    need = [*cols, "lowvol_score", "y_excess"]
    base = labeled.drop_nulls(subset=need)
    embargo = max(30, int(horizon * 365 / 252))
    min_names = 8 if base["code"].n_unique() < 30 else 15
    scores: list[FoldScore] = []

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
        if tr.height < 60 or va.height < 15:
            tr, va = train, train

        lv_tr = lowvol_to_excess(tr)
        lv_va = lowvol_to_excess(va)
        lv_te = lowvol_to_excess(test)
        y_tr = tr["y_excess"].to_numpy() - lv_tr
        y_va = va["y_excess"].to_numpy() - lv_va

        model = make_lgbm(cfg)
        model.fit(
            tr.select(cols).to_numpy(),
            y_tr,
            eval_set=[(va.select(cols).to_numpy(), y_va)],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        resid_va = model.predict(va.select(cols).to_numpy())
        resid_te = model.predict(test.select(cols).to_numpy())
        pred_lv_va = va.with_columns(pl.Series("pred", lv_va))
        pred_mix_va = va.with_columns(pl.Series("pred", lv_va + resid_va))
        cs_lv = _mean_cs_ic(pred_lv_va, "pred", min_names=max(5, min_names // 2))
        cs_mix = _mean_cs_ic(pred_mix_va, "pred", min_names=max(5, min_names // 2))
        use_resid = (
            np.isfinite(cs_mix)
            and np.isfinite(cs_lv)
            and cs_mix > cs_lv + 0.01
        )
        yhat = lv_te + resid_te if use_resid else lv_te
        y_te = test["y_excess"].to_numpy()
        te = test.with_columns(pl.Series("pred", yhat))
        cs = _mean_cs_ic(te, "pred", min_names=min_names)
        ic = _ic(y_te, yhat)
        rmse_m = _rmse(y_te, yhat)
        rmse_0 = _rmse(y_te, np.zeros_like(y_te))
        skill = 1.0 - rmse_m / rmse_0 if rmse_0 > 1e-12 else float("nan")
        s = FoldScore(
            train_end=str(train_end),
            test_start=str(test_start),
            test_end=str(test_end),
            n_train=train.height,
            n_test=test.height,
            ic_spearman=ic,
            rmse_model=rmse_m,
            rmse_zero=rmse_0,
            rmse_skill=float(skill),
            cs_ic_spearman=cs,
            used_residual=use_resid,
        )
        scores.append(s)
        gate = "residual" if use_resid else "lowvol-only"
        print(
            f"  [gated] {s.test_start}..{s.test_end}: "
            f"IC={s.ic_spearman:+.3f}  CS={s.cs_ic_spearman:+.3f}  "
            f"val_cs lv={cs_lv:+.3f} mix={cs_mix:+.3f} → {gate}  "
            f"n_te={s.n_test}",
            flush=True,
        )
    return scores, cfg


def scored_fold_frame_spine(
    labeled: pl.DataFrame,
    *,
    horizon: int,
    mode: str,
    cfg: TrainConfig | None = None,
) -> pl.DataFrame:
    """OOS rows for CDI eval — mode in {lowvol, gated}."""
    cfg = cfg or DAMPED_RESIDUAL_CFG
    cols = _active_cols(labeled, cfg.feature_cols) if mode == "gated" else []
    need = ["lowvol_score", "y_excess", "y_beat_cdi"]
    if mode == "gated":
        need = [*cols, *need]
    base = labeled.drop_nulls(subset=need)
    embargo = max(30, int(horizon * 365 / 252))
    pieces: list[pl.DataFrame] = []
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        thin_every = cfg.thin_every if mode == "gated" else 5
        train = _thin(base.filter(pl.col("date") < train_end), thin_every)
        test = _thin(
            base.filter(
                (pl.col("date") >= test_start) & (pl.col("date") <= test_end)
            ),
            thin_every,
        )
        if test.height < 20:
            continue
        lv_te = lowvol_to_excess(test)
        use_resid = False
        resid_te = np.zeros(test.height)
        if mode == "gated" and train.height >= 80:
            cut = train["date"].quantile(0.85, interpolation="nearest")
            tr = train.filter(pl.col("date") < cut)
            va = train.filter(pl.col("date") >= cut)
            if tr.height < 60 or va.height < 15:
                tr, va = train, train
            lv_tr = lowvol_to_excess(tr)
            lv_va = lowvol_to_excess(va)
            m = make_lgbm(cfg)
            m.fit(
                tr.select(cols).to_numpy(),
                tr["y_excess"].to_numpy() - lv_tr,
                eval_set=[
                    (va.select(cols).to_numpy(), va["y_excess"].to_numpy() - lv_va)
                ],
                callbacks=[lgb.early_stopping(40, verbose=False)],
            )
            resid_va = m.predict(va.select(cols).to_numpy())
            cs_lv = _mean_cs_ic(
                va.with_columns(pl.Series("pred", lv_va)), "pred", min_names=5
            )
            cs_mix = _mean_cs_ic(
                va.with_columns(pl.Series("pred", lv_va + resid_va)),
                "pred",
                min_names=5,
            )
            use_resid = (
                np.isfinite(cs_mix)
                and np.isfinite(cs_lv)
                and cs_mix > cs_lv + 0.01
            )
            if use_resid:
                resid_te = m.predict(test.select(cols).to_numpy())
        excess = lv_te + resid_te if use_resid else lv_te
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


def predict_frame_spine(
    rows: pl.DataFrame,
    *,
    horizon: int,
    mode: str,
    model: lgb.LGBMRegressor | None = None,
    cols: list[str] | None = None,
) -> pl.DataFrame:
    """Latest-row predictions from lowvol or lowvol+residual."""
    excess = lowvol_to_excess(rows)
    if mode == "gated" and model is not None and cols:
        excess = excess + model.predict(rows.select(cols).to_numpy())
    p, p0 = excess_to_prob(rows, excess, horizon=horizon)
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    meses = max(1, round(horizon / 21))
    return rows.select(["code", "date", "close"]).with_columns(
        pl.Series("excess_previsto", excess),
        pl.Series("probabilidade", p),
        pl.Series("probabilidade_baseline", p0),
        pl.lit(meses).alias("horizonte_meses"),
        pl.col("close").alias("preco_referencia"),
        pl.lit(MODELO_VERSAO).alias("modelo_versao"),
        pl.lit(agora.isoformat()).alias("calculado_em"),
    )


def fit_residual_final(
    labeled: pl.DataFrame,
    cfg: TrainConfig | None = None,
) -> tuple[lgb.LGBMRegressor, list[str]]:
    """Fit dampened residual on full sample (for export when gated wins)."""
    cfg = cfg or DAMPED_RESIDUAL_CFG
    cols = _active_cols(labeled, cfg.feature_cols)
    train = _thin(
        labeled.drop_nulls(subset=[*cols, "lowvol_score", "y_excess"]),
        cfg.thin_every,
    )
    cut = train["date"].quantile(0.85, interpolation="nearest")
    tr = train.filter(pl.col("date") < cut)
    va = train.filter(pl.col("date") >= cut)
    if tr.height < 80:
        tr, va = train, train
    lv_tr = lowvol_to_excess(tr)
    lv_va = lowvol_to_excess(va)
    model = make_lgbm(cfg)
    model.fit(
        tr.select(cols).to_numpy(),
        tr["y_excess"].to_numpy() - lv_tr,
        eval_set=[(va.select(cols).to_numpy(), va["y_excess"].to_numpy() - lv_va)],
        callbacks=[lgb.early_stopping(40, verbose=False)],
    )
    print(
        f"  fit residual [{cfg.name}]: best_iter="
        f"{getattr(model, 'best_iteration_', model.n_estimators)}",
        flush=True,
    )
    return model, cols


def save_spine_artifact(
    scores: list[FoldScore],
    *,
    mode: str,
    n_labeled: int,
    universe: list[str],
    horizon: int,
    cfg: TrainConfig | None = None,
    model: lgb.LGBMRegressor | None = None,
    cols: list[str] | None = None,
    cdi_report: dict | None = None,
) -> Path:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    if model is not None:
        model_path = ARTIFACT_DIR / f"{MODELO_VERSAO}.txt"
        model.booster_.save_model(str(model_path))
        print(f"  artifact: {model_path}", flush=True)
    meta = {
        "modelo_versao": MODELO_VERSAO,
        "spine": "lowvol",
        "mode": mode,
        "train_target": "y_excess (ret_stock - ret_cdi)",
        "train_metric": "cross_sectional_spearman_ic",
        "horizon_pregões": horizon,
        "baseline_train": "lowvol_score cross-section z → excess",
        "product_baseline": BASELINE_NAME,
        "config": asdict(cfg) if cfg is not None else None,
        "feature_cols": cols or ["lowvol_score"],
        "n_labeled": n_labeled,
        "universe": universe,
        "mean_ic_2024plus": mean_ic(scores),
        "mean_cs_ic_2024plus": mean_cs_ic(scores),
        "cdi_eval": cdi_report,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "folds": [asdict(s) for s in scores],
    }
    meta_path = ARTIFACT_DIR / f"{MODELO_VERSAO}.json"
    meta_path.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  meta:     {meta_path}", flush=True)
    return meta_path
