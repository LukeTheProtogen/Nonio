"""Cotações da B3 via brapi.

PETR4, VALE3, ITUB4 e MGLU3 respondem sem token e sem consumir cota — são o
universo da demo. Com BRAPI_TOKEN o universo abre, sem mudar nada aqui.
"""
import os

import polars as pl

from .ingest import _get_json

BASE = "https://brapi.dev/api/quote"
LIVRES = ["PETR4", "VALE3", "ITUB4", "MGLU3"]


def historico(tickers: list[str], intervalo: str = "2y") -> pl.DataFrame:
    """Fechamentos diários. Uma chamada para todos os tickers."""
    params = {"range": intervalo, "interval": "1d"}
    if token := os.environ.get("BRAPI_TOKEN"):
        params["token"] = token

    dados = _get_json(f"{BASE}/{','.join(tickers)}", params)
    if dados.get("error"):
        raise RuntimeError(f"brapi: {dados.get('message')}")

    linhas = []
    for ativo in dados.get("results") or []:
        for p in ativo.get("historicalDataPrice") or []:
            if p.get("close") is None:
                continue
            linhas.append({
                "ticker": ativo["symbol"],
                "epoch": p["date"],
                "fechamento": float(p["close"]),
            })
    if not linhas:
        raise RuntimeError("brapi não devolveu histórico")

    return (pl.DataFrame(linhas)
              .with_columns(pl.from_epoch("epoch", time_unit="s").dt.date().alias("data"))
              .drop("epoch")
              .unique(subset=["ticker", "data"], keep="last")
              .sort(["ticker", "data"]))


def atual(tickers: list[str]) -> pl.DataFrame:
    params = {}
    if token := os.environ.get("BRAPI_TOKEN"):
        params["token"] = token
    dados = _get_json(f"{BASE}/{','.join(tickers)}", params)
    return pl.DataFrame([{
        "ticker": r["symbol"],
        "preco": r.get("regularMarketPrice"),
        "em": r.get("regularMarketTime"),
    } for r in dados.get("results") or []])
