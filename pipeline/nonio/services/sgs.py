"""SGS (BCB) — series macro para treino.

Idempotente: merge por data no parquet. Cache HTTP em data/cache/sgs/.
Series diarias longas vao em janelas de 8 anos (armadilha 406).
"""

from __future__ import annotations

import time
from datetime import date
from pathlib import Path

import polars as pl

from nonio.config import RAIZ
from nonio.services import cache
from nonio.services.http import get_json

SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"
MACRO_DIR = RAIZ / "data" / "parquet" / "macro"

# Catalogo minimo util para modelos (expandivel via env depois).
SERIES: dict[str, dict] = {
    "cdi": {"serie": 12, "freq": "daily", "inicio": 2000},
    "selic_meta": {"serie": 432, "freq": "daily", "inicio": 2000},
    "ipca_mensal": {"serie": 433, "freq": "monthly", "inicio": None},
    "selic_mensal": {"serie": 4390, "freq": "monthly", "inicio": None},
}


def fetch_serie(
    serie: int,
    *,
    inicio: date | None = None,
    fim: date | None = None,
    force: bool = False,
) -> pl.DataFrame:
    params: dict[str, str] = {"formato": "json"}
    if inicio:
        params["dataInicial"] = inicio.strftime("%d/%m/%Y")
    if fim:
        params["dataFinal"] = fim.strftime("%d/%m/%Y")
    url = SGS.format(serie=serie)
    payload = None if force else cache.read("sgs", url, params)
    if payload is None:
        payload = get_json(url, params=params)
        cache.write("sgs", url, params, payload)
    if not isinstance(payload, list):
        raise RuntimeError(f"SGS {serie}: esperado list, veio {type(payload)}")
    if not payload:
        return pl.DataFrame(schema={"data": pl.Date, "value": pl.Float64})
    return (
        pl.DataFrame(payload)
        .with_columns(
            pl.col("data").str.to_date("%d/%m/%Y"),
            pl.col("valor").cast(pl.Float64),
        )
        .rename({"valor": "value"})
        .unique(subset="data", keep="first")
        .sort("data")
    )


def fetch_serie_diaria(serie: int, *, inicio_ano: int = 2000, force: bool = False) -> pl.DataFrame:
    """Janelas de 8 anos — SGS devolve 406 acima de ~10 anos em diaria."""
    linhas: list[pl.DataFrame] = []
    fim_total = date.today().year
    ini = inicio_ano
    while ini <= fim_total:
        fim = min(ini + 8, fim_total)
        print(f"    sgs serie={serie} {ini}-{fim}", flush=True)
        df = fetch_serie(
            serie,
            inicio=date(ini, 1, 1),
            fim=date(fim, 12, 31),
            force=force,
        )
        if df.height:
            linhas.append(df)
        ini = fim + 1
        time.sleep(0.25)
    if not linhas:
        return pl.DataFrame(schema={"data": pl.Date, "value": pl.Float64})
    return (
        pl.concat(linhas, how="vertical")
        .unique(subset="data", keep="first")
        .sort("data")
    )


def fetch_named(nome: str, *, force: bool = False) -> pl.DataFrame:
    meta = SERIES[nome]
    if meta["freq"] == "daily":
        df = fetch_serie_diaria(meta["serie"], inicio_ano=meta["inicio"] or 2000, force=force)
    else:
        df = fetch_serie(meta["serie"], force=force)
    return df.rename({"value": nome})


def write_macro(nome: str, df: pl.DataFrame, *, merge: bool = True) -> Path:
    MACRO_DIR.mkdir(parents=True, exist_ok=True)
    path = MACRO_DIR / f"{nome}.parquet"
    if merge and path.exists() and df.height:
        old = pl.read_parquet(path)
        # alinha nome da coluna de valor
        val_cols = [c for c in df.columns if c != "data"]
        if val_cols:
            col = val_cols[0]
            if col not in old.columns and "value" in old.columns:
                old = old.rename({"value": col})
            if "cdi" in old.columns and col == "cdi":
                pass
        df = (
            pl.concat([old, df], how="diagonal_relaxed")
            .unique(subset=["data"], keep="last")
            .sort("data")
        )
    df.write_parquet(path)
    return path


def sync_all(*, force: bool = False) -> dict[str, Path]:
    out: dict[str, Path] = {}
    for nome in SERIES:
        df = fetch_named(nome, force=force)
        out[nome] = write_macro(nome, df, merge=True)
        print(f"  sgs {nome}: {df.height} linhas -> {out[nome]}", flush=True)
    return out


# compat
def fetch_cdi(*, inicio: date | None = None, force: bool = False) -> pl.DataFrame:
    if inicio:
        return fetch_serie(12, inicio=inicio, force=force).rename({"value": "cdi"})
    return fetch_named("cdi", force=force)


def write_cdi_parquet(df: pl.DataFrame, path: Path | None = None) -> Path:
    if path is not None:
        path.parent.mkdir(parents=True, exist_ok=True)
        df.write_parquet(path)
        return path
    return write_macro("cdi", df, merge=True)
