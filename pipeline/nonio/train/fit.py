"""LightGBM + walk-forward + export.

Embargo de ~365d no corte treino/teste: o rótulo em t usa retorno até t+252,
então treinar até a véspera do teste vaza o futuro do ano de teste.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import polars as pl
from sklearn.metrics import brier_score_loss, log_loss

from nonio.config import RAIZ
from nonio.probabilidade import MODELO as BASELINE_NAME
from nonio.probabilidade import prob_bater_cdi
from nonio.train import MODELO_VERSAO
from nonio.train.dataset import FEATURE_COLS, LEAN_FEATURE_COLS

ARTIFACT_DIR = RAIZ / "data" / "models"
PREDICTIONS_PATH = RAIZ / "data" / "parquet" / "models" / "previews_lgbm.parquet"

# (test_start, test_end) — train_end = test_start - EMBARGO
FOLDS = [
    (date(2023, 1, 1), date(2023, 12, 31)),
    (date(2024, 1, 1), date(2024, 12, 31)),
    (date(2025, 1, 1), date(2025, 12, 31)),
]
EMBARGO_DAYS = 365


@dataclass
class FoldScore:
    train_end: str
    test_start: str
    test_end: str
    n_train: int
    n_test: int
    brier_model: float
    brier_baseline: float
    logloss_model: float
    logloss_baseline: float
    accuracy_model: float
    accuracy_baseline: float
    positive_rate_test: float


@dataclass(frozen=True)
class TrainConfig:
    name: str
    feature_cols: tuple[str, ...]
    thin_every: int = 63
    n_estimators: int = 300
    learning_rate: float = 0.05
    num_leaves: int = 7
    min_child_samples: int = 50
    reg_lambda: float = 8.0
    reg_alpha: float = 1.0
    subsample: float = 0.8
    colsample_bytree: float = 0.7
    blend_baseline: float = 0.0  # 0 = só LGBM; 0.4 = 60% modelo + 40% baseline


CONFIGS: list[TrainConfig] = [
    TrainConfig(
        name="residual-lean",
        feature_cols=tuple(LEAN_FEATURE_COLS),
        thin_every=21,
        num_leaves=7,
        min_child_samples=60,
        reg_lambda=12.0,
        n_estimators=250,
    ),
    TrainConfig(
        name="residual-blend40",
        feature_cols=tuple(LEAN_FEATURE_COLS),
        thin_every=21,
        blend_baseline=0.4,
        num_leaves=7,
        reg_lambda=12.0,
    ),
    TrainConfig(
        name="residual-blend60",
        feature_cols=tuple(LEAN_FEATURE_COLS),
        thin_every=21,
        blend_baseline=0.6,
        num_leaves=5,
        reg_lambda=15.0,
        n_estimators=150,
    ),
    TrainConfig(
        name="price-macro-base",
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
        num_leaves=7,
        reg_lambda=10.0,
        blend_baseline=0.5,
    ),
    TrainConfig(
        name="full-soft",
        feature_cols=tuple(FEATURE_COLS),
        thin_every=21,
        num_leaves=7,
        min_child_samples=100,
        reg_lambda=20.0,
        n_estimators=200,
        blend_baseline=0.45,
    ),
]


def _brier(y: np.ndarray, p: np.ndarray) -> float:
    return float(brier_score_loss(y, p))


def _logloss(y: np.ndarray, p: np.ndarray) -> float:
    return float(log_loss(y, np.clip(p, 1e-7, 1 - 1e-7), labels=[0, 1]))


def _accuracy(y: np.ndarray, p: np.ndarray) -> float:
    return float(np.mean((p >= 0.5) == y))


def _baseline_probs(df: pl.DataFrame, *, anos: float = 1.0) -> np.ndarray:
    vols = df["vol_60"].fill_null(df["vol_20"]).fill_null(0.3).to_numpy()
    out = []
    for v in vols:
        vol = float(v) if v == v and float(v) > 1e-6 else 0.3
        out.append(prob_bater_cdi(vol, anos=anos))
    return np.array(out)


def _xy(df: pl.DataFrame, cols: list[str]) -> tuple[np.ndarray, np.ndarray]:
    x = df.select(cols).to_numpy()
    y = df["y_beat_cdi"].to_numpy().astype(np.float64)
    return x, y


def _thin(df: pl.DataFrame, every: int) -> pl.DataFrame:
    return (
        df.sort(["code", "date"])
        .with_columns(pl.arange(0, pl.len()).over("code").alias("_i"))
        .filter(pl.col("_i") % every == 0)
        .drop("_i")
    )


def make_lgbm(cfg: TrainConfig) -> lgb.LGBMClassifier:
    return lgb.LGBMClassifier(
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


def _blend(p: np.ndarray, p0: np.ndarray, w_baseline: float) -> np.ndarray:
    if w_baseline <= 0:
        return p
    if w_baseline >= 1:
        return p0
    return (1.0 - w_baseline) * p + w_baseline * p0


def _capped_residual(
    p: np.ndarray, p0: np.ndarray, cap: float = 0.12
) -> np.ndarray:
    """Só deixa o LGBM empurrar o prior até ±cap — evita explosões de calibração."""
    return np.clip(p0 + np.clip(p - p0, -cap, cap), 0.02, 0.98)


def walk_forward(
    labeled: pl.DataFrame,
    cfg: TrainConfig,
    *,
    horizon: int = 252,
    embargo_days: int | None = None,
    anos: float | None = None,
) -> list[FoldScore]:
    cols = _active_cols(labeled, cfg.feature_cols)
    base = labeled.drop_nulls(subset=cols)
    embargo = embargo_days if embargo_days is not None else max(30, int(horizon * 365 / 252))
    t_anos = anos if anos is not None else horizon / 252
    scores: list[FoldScore] = []
    min_train = 80 if horizon <= 126 else 120
    min_test = 20 if horizon <= 126 else 30
    for test_start, test_end in FOLDS:
        train_end = test_start - timedelta(days=embargo)
        train = _thin(
            base.filter(pl.col("date") < train_end),
            cfg.thin_every,
        )
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

        x_tr, y_tr = _xy(tr, cols)
        x_va, y_va = _xy(va, cols)
        x_te, y_te = _xy(test, cols)

        model = make_lgbm(cfg)
        model.fit(
            x_tr,
            y_tr,
            eval_set=[(x_va, y_va)],
            callbacks=[lgb.early_stopping(40, verbose=False)],
        )
        p_raw = model.predict_proba(x_te)[:, 1]
        p0 = _baseline_probs(test, anos=t_anos)
        p_va = model.predict_proba(x_va)[:, 1]
        p0_va = _baseline_probs(va, anos=t_anos)

        best_w = cfg.blend_baseline
        best_va = _brier(y_va, _blend(p_va, p0_va, best_w))
        for w in (0.0, 0.3, 0.5, 0.7, 0.85, 0.95):
            b = _brier(y_va, _blend(p_va, p0_va, w))
            if b < best_va:
                best_va, best_w = b, w

        p = _capped_residual(_blend(p_raw, p0, best_w), p0, cap=0.10)

        scores.append(
            FoldScore(
                train_end=str(train_end),
                test_start=str(test_start),
                test_end=str(test_end),
                n_train=train.height,
                n_test=test.height,
                brier_model=_brier(y_te, p),
                brier_baseline=_brier(y_te, p0),
                logloss_model=_logloss(y_te, p),
                logloss_baseline=_logloss(y_te, p0),
                accuracy_model=_accuracy(y_te, p),
                accuracy_baseline=_accuracy(y_te, p0),
                positive_rate_test=float(y_te.mean()),
            )
        )
        s = scores[-1]
        print(
            f"  [{cfg.name}] {s.test_start}..{s.test_end}: "
            f"brier {s.brier_model:.4f} vs {s.brier_baseline:.4f} "
            f"(Δ={s.brier_baseline - s.brier_model:+.4f}) "
            f"w*={best_w:.2f} n_tr={s.n_train} n_te={s.n_test}",
            flush=True,
        )
    return scores


def mean_brier_delta(scores: list[FoldScore]) -> float:
    # 2023 é ruidoso: maioria do universo só começa em 2021-09 + embargo.
    usable = [s for s in scores if s.test_start >= "2024-01-01"]
    if not usable:
        usable = scores
    if not usable:
        return float("-inf")
    return float(np.mean([s.brier_baseline - s.brier_model for s in usable]))


def pick_best(
    labeled: pl.DataFrame,
    configs: list[TrainConfig] | None = None,
    *,
    horizon: int = 252,
) -> tuple[TrainConfig, list[FoldScore]]:
    configs = configs or CONFIGS
    best_cfg: TrainConfig | None = None
    best_scores: list[FoldScore] = []
    best_delta = float("-inf")
    for cfg in configs:
        print(f"config: {cfg.name}", flush=True)
        scores = walk_forward(labeled, cfg, horizon=horizon)
        delta = mean_brier_delta(scores)
        wins = sum(1 for s in scores if s.brier_model < s.brier_baseline)
        print(
            f"  → mean Δbrier={delta:+.4f}  wins={wins}/{len(scores)}",
            flush=True,
        )
        if delta > best_delta:
            best_delta = delta
            best_cfg = cfg
            best_scores = scores
    assert best_cfg is not None
    print(
        f"melhor: {best_cfg.name} (mean Δbrier={best_delta:+.4f})",
        flush=True,
    )
    return best_cfg, best_scores


def fit_final(
    labeled: pl.DataFrame,
    cfg: TrainConfig,
    *,
    horizon: int = 252,
) -> tuple[lgb.LGBMClassifier, list[str], float]:
    cols = _active_cols(labeled, cfg.feature_cols)
    train = _thin(labeled.drop_nulls(subset=cols), cfg.thin_every)
    cut = train["date"].quantile(0.85, interpolation="nearest")
    tr = train.filter(pl.col("date") < cut)
    va = train.filter(pl.col("date") >= cut)
    if tr.height < 80:
        tr, va = train, train
    model = make_lgbm(cfg)
    model.fit(
        *_xy(tr, cols),
        eval_set=[_xy(va, cols)],
        callbacks=[lgb.early_stopping(40, verbose=False)],
    )
    anos = horizon / 252
    p_va = model.predict_proba(_xy(va, cols)[0])[:, 1]
    y_va = _xy(va, cols)[1]
    p0_va = _baseline_probs(va, anos=anos)
    best_w = cfg.blend_baseline
    best_va = _brier(y_va, _blend(p_va, p0_va, best_w))
    for w in (0.0, 0.3, 0.5, 0.7, 0.85, 0.95):
        b = _brier(y_va, _blend(p_va, p0_va, w))
        if b < best_va:
            best_va, best_w = b, w
    print(
        f"  fit final [{cfg.name}]: {train.height} thinned, "
        f"best_iter={getattr(model, 'best_iteration_', model.n_estimators)}, "
        f"blend_w={best_w:.2f}",
        flush=True,
    )
    return model, cols, best_w


def save_artifact(
    model: lgb.LGBMClassifier,
    cols: list[str],
    scores: list[FoldScore],
    *,
    n_labeled: int,
    universe: list[str],
    cfg: TrainConfig,
    blend_w: float,
) -> Path:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACT_DIR / f"{MODELO_VERSAO}.txt"
    model.booster_.save_model(str(model_path))
    meta = {
        "modelo_versao": MODELO_VERSAO,
        "baseline": BASELINE_NAME,
        "config": asdict(cfg),
        "blend_w": blend_w,
        "feature_cols": cols,
        "n_labeled": n_labeled,
        "universe": universe,
        "embargo_days": EMBARGO_DAYS,
        "mean_brier_delta_2024plus": mean_brier_delta(scores),
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


def predict_frame(
    model: lgb.LGBMClassifier,
    cols: list[str],
    rows: pl.DataFrame,
    *,
    blend_w: float = 0.0,
    horizon: int = 252,
) -> pl.DataFrame:
    x = rows.select(cols).to_numpy()
    p_raw = model.predict_proba(x)[:, 1]
    p0 = _baseline_probs(rows, anos=horizon / 252)
    p = _capped_residual(_blend(p_raw, p0, blend_w), p0, cap=0.10)
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    meses = max(1, round(horizon / 21))
    return rows.select(["code", "date", "close"]).with_columns(
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
