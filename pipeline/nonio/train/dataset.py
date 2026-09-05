"""Monta o painel (code, date) com label e features — sem leakage."""

from __future__ import annotations

import os
from math import erf, sqrt
from pathlib import Path

import numpy as np
import polars as pl

from nonio.config import RAIZ
from nonio.train import DEFAULT_UNIVERSE, HORIZONTE_PREGOES, PREGOES_ANO

PARQUET = RAIZ / "data" / "parquet"


def resolve_universe() -> list[str]:
    raw = os.getenv("TRAIN_UNIVERSE", os.getenv("STOCK_UNIVERSE", "")).strip()
    stocks = PARQUET / "stocks"
    if raw.upper() == "ALL":
        codes = sorted(
            d.name
            for d in stocks.iterdir()
            if d.is_dir() and (d / "history.parquet").exists()
        )
        # precisa de histórico p/ mom_12m + label 12m
        kept: list[str] = []
        for code in codes:
            n = pl.scan_parquet(stocks / code / "history.parquet").select(pl.len()).collect().item()
            if n >= 500:
                kept.append(code)
        print(f"  universo ALL: {len(kept)} tickers com ≥500 barras", flush=True)
        return kept

    codes = [c.strip().upper() for c in raw.split(",") if c.strip()]
    wanted = codes or list(DEFAULT_UNIVERSE)
    out: list[str] = []
    for code in wanted:
        path = stocks / code / "history.parquet"
        if path.exists():
            out.append(code)
        else:
            print(f"  universo: {code} sem history — pulado", flush=True)
    if not out:
        raise SystemExit("nenhum ticker com history no universo")
    return out


def _load_prices(codes: list[str]) -> pl.DataFrame:
    frames: list[pl.DataFrame] = []
    for code in codes:
        df = (
            pl.read_parquet(PARQUET / "stocks" / code / "history.parquet")
            .select(["code", "date", "open", "high", "low", "close", "volume"])
            .sort("date")
        )
        frames.append(df)
    return pl.concat(frames, how="vertical").sort(["code", "date"])


def _load_macro() -> pl.DataFrame:
    cdi = pl.read_parquet(PARQUET / "macro" / "cdi.parquet").rename(
        {"data": "date", "cdi": "cdi_pct"}
    )
    selic = pl.read_parquet(PARQUET / "macro" / "selic_meta.parquet").rename(
        {"data": "date", "selic_meta": "selic_meta_aa"}
    )
    ipca = (
        pl.read_parquet(PARQUET / "macro" / "ipca_mensal.parquet")
        .rename({"data": "date", "ipca_mensal": "ipca_mensal_pct"})
        .sort("date")
    )
    # CDI % a.d. (série 12) — medido: ~0.05 com Selic ~14% a.a.
    return (
        cdi.join(selic, on="date", how="full", coalesce=True)
        .sort("date")
        .join_asof(ipca, on="date", strategy="backward")
        .with_columns(
            (pl.col("selic_meta_aa") - pl.col("ipca_mensal_pct") * 12).alias(
                "taxa_real_aprox"
            )
        )
    )


def _load_copom() -> pl.DataFrame:
    feat = pl.read_parquet(PARQUET / "copom" / "features.parquet")
    atas = pl.read_parquet(PARQUET / "copom" / "atas.parquet").select(
        ["nro_reuniao", "data_publicacao"]
    )
    cols = [
        "decisao_signed",
        "delta_pp",
        "unanimidade",
        "tom_politica",
        "tom_inflacao",
        "tom_atividade",
        "expectativas_acima_meta",
        "risco_alta_dominante",
        "menciona_geopolitica",
        "menciona_fiscal",
        "guidance_restritivo",
        "focus_ipca_ano_corrente",
        "focus_ipca_ano_seguinte",
        "projecao_copom_horizonte",
        "selic_meta_aa",
    ]
    present = [c for c in cols if c in feat.columns]
    return (
        feat.select(["nro_reuniao", *present])
        .join(atas, on="nro_reuniao", how="left")
        .drop_nulls("data_publicacao")
        .sort("data_publicacao")
        .rename({"data_publicacao": "date", "selic_meta_aa": "copom_selic_meta_aa"})
    )


def _add_labels(
    prices: pl.DataFrame, macro: pl.DataFrame, *, horizon: int
) -> pl.DataFrame:
    """y = 1 se retorno em `horizon` pregões > CDI composto no mesmo intervalo."""
    h = horizon
    cdi = macro.select(["date", "cdi_pct"]).drop_nulls("cdi_pct").sort("date")
    cdi = cdi.with_columns((1 + pl.col("cdi_pct") / 100).log().alias("log_cdi"))

    df = (
        prices.sort(["code", "date"])
        .join(cdi.select(["date", "log_cdi"]), on="date", how="left")
        .with_columns(pl.col("log_cdi").forward_fill().over("code"))
        .with_columns(
            pl.col("close").shift(-h).over("code").alias("close_fwd"),
            pl.col("log_cdi")
            .rolling_sum(window_size=h)
            .shift(-h + 1)
            .over("code")
            .alias("log_cdi_fwd_sum"),
        )
        .with_columns(
            (pl.col("close_fwd") / pl.col("close") - 1).alias("ret_stock"),
            (pl.col("log_cdi_fwd_sum").exp() - 1).alias("ret_cdi"),
        )
        .with_columns(
            (pl.col("ret_stock") > pl.col("ret_cdi")).cast(pl.Int8).alias("y_beat_cdi")
        )
    )
    return df


def _add_price_features(df: pl.DataFrame) -> pl.DataFrame:
    return df.with_columns(
        (pl.col("close").log() - pl.col("close").log().shift(1).over("code")).alias(
            "log_ret_1d"
        )
    ).with_columns(
        (
            pl.col("log_ret_1d").rolling_std(20).over("code") * (PREGOES_ANO**0.5)
        ).alias("vol_20"),
        (
            pl.col("log_ret_1d").rolling_std(60).over("code") * (PREGOES_ANO**0.5)
        ).alias("vol_60"),
        (
            pl.col("log_ret_1d").rolling_std(120).over("code") * (PREGOES_ANO**0.5)
        ).alias("vol_120"),
        (pl.col("close") / pl.col("close").shift(21).over("code") - 1).alias("mom_1m"),
        (pl.col("close") / pl.col("close").shift(63).over("code") - 1).alias("mom_3m"),
        (pl.col("close") / pl.col("close").shift(126).over("code") - 1).alias("mom_6m"),
        (pl.col("close") / pl.col("close").shift(252).over("code") - 1).alias("mom_12m"),
        (pl.col("close") / pl.col("close").rolling_max(252).over("code") - 1).alias(
            "dd_52w"
        ),
        (
            (pl.col("volume") - pl.col("volume").rolling_mean(20).over("code"))
            / pl.col("volume").rolling_std(20).over("code")
        ).alias("vol_z_20"),
    )


PRICE_FEATURE_COLS = [
    "vol_20",
    "vol_60",
    "vol_120",
    "mom_1m",
    "mom_3m",
    "mom_6m",
    "mom_12m",
    "dd_52w",
    "vol_z_20",
    "p_baseline",
]

PRICE_MACRO_FEATURE_COLS = [
    *PRICE_FEATURE_COLS,
    "cdi_pct",
    "selic_meta_aa",
    "ipca_mensal_pct",
    "taxa_real_aprox",
]

FEATURE_COLS = [
    *PRICE_MACRO_FEATURE_COLS,
    "decisao_signed",
    "delta_pp",
    "unanimidade",
    "tom_politica",
    "tom_inflacao",
    "tom_atividade",
    "expectativas_acima_meta",
    "risco_alta_dominante",
    "menciona_geopolitica",
    "menciona_fiscal",
    "guidance_restritivo",
    "focus_ipca_ano_corrente",
    "focus_ipca_ano_seguinte",
    "projecao_copom_horizonte",
    "copom_selic_meta_aa",
]

LEAN_FEATURE_COLS = [
    "vol_60",
    "vol_120",
    "mom_3m",
    "mom_6m",
    "mom_12m",
    "dd_52w",
    "cdi_pct",
    "selic_meta_aa",
    "taxa_real_aprox",
    "delta_pp",
    "decisao_signed",
    "guidance_restritivo",
    "p_baseline",
]

FEATURE_PACKS: dict[str, list[str]] = {
    "price": PRICE_FEATURE_COLS,
    "price_macro": PRICE_MACRO_FEATURE_COLS,
    "lean": LEAN_FEATURE_COLS,
    "full": FEATURE_COLS,
}


def build_panel(
    codes: list[str] | None = None,
    *,
    horizon: int = HORIZONTE_PREGOES,
) -> pl.DataFrame:
    codes = codes or resolve_universe()
    print(f"  painel: {len(codes)} tickers  horizon={horizon}d", flush=True)
    prices = _load_prices(codes)
    macro = _load_macro()
    copom = _load_copom()

    labeled = _add_labels(prices, macro, horizon=horizon)
    feat = _add_price_features(labeled)

    feat = feat.join(
        macro.select(
            [
                "date",
                "cdi_pct",
                "selic_meta_aa",
                "ipca_mensal_pct",
                "taxa_real_aprox",
            ]
        ),
        on="date",
        how="left",
    )
    feat = feat.sort("date").join_asof(
        copom.sort("date"),
        on="date",
        strategy="backward",
    )

    boolish = [
        c
        for c in FEATURE_COLS
        if c in feat.columns and feat[c].dtype == pl.Boolean
    ]
    if boolish:
        feat = feat.with_columns([pl.col(c).cast(pl.Int8) for c in boolish])

    # Φ(-0.5 σ √T) com T = horizon/252
    anos = horizon / PREGOES_ANO
    vols = (
        feat["vol_60"]
        .fill_null(feat["vol_20"])
        .fill_null(0.3)
        .clip(0.05, 2.0)
        .to_numpy()
    )
    z = -0.5 * vols * np.sqrt(anos)
    p_base = 0.5 * (1.0 + np.vectorize(erf)(z / sqrt(2.0)))
    feat = feat.with_columns(pl.Series("p_baseline", p_base))

    return feat.sort(["code", "date"])


def labeled_rows(panel: pl.DataFrame) -> pl.DataFrame:
    copom_fill = [
        "decisao_signed",
        "delta_pp",
        "unanimidade",
        "tom_politica",
        "tom_inflacao",
        "tom_atividade",
        "expectativas_acima_meta",
        "risco_alta_dominante",
        "menciona_geopolitica",
        "menciona_fiscal",
        "guidance_restritivo",
        "focus_ipca_ano_corrente",
        "focus_ipca_ano_seguinte",
        "projecao_copom_horizonte",
        "copom_selic_meta_aa",
    ]
    present = [c for c in copom_fill if c in panel.columns]
    out = panel.with_columns([pl.col(c).fill_null(0) for c in present])
    return out.drop_nulls(subset=["y_beat_cdi", "vol_60", "mom_3m", "mom_12m", "cdi_pct"])


def latest_feature_rows(panel: pl.DataFrame) -> pl.DataFrame:
    """Última data por ticker com features suficientes para inferência."""
    return (
        panel.drop_nulls(subset=["vol_60", "mom_3m"])
        .sort(["code", "date"])
        .group_by("code", maintain_order=True)
        .tail(1)
    )


def feature_matrix(df: pl.DataFrame) -> tuple[list[str], pl.DataFrame]:
    cols = [c for c in FEATURE_COLS if c in df.columns]
    return cols, df.select(cols)
