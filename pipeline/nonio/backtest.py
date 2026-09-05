"""Alinha previsão × realizado e roda as métricas. É a prova do produto.

O que sai daqui é o número que abre o pitch: quanto o consenso de mais de cem
instituições erra, por horizonte, em 26 anos.

    uv run python -m nonio.backtest
"""
from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

import numpy as np
import polars as pl

from . import avaliacao as A

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "data" / "raw"
PUBLICO = RAIZ / "web" / "src" / "data"

HORIZONTES = [1, 3, 6, 9, 12, 18, 24]

# Banda de tolerância do regime de metas. Não achei série no SGS — a meta (13521)
# vem da API, a tolerância é do CMN e está aqui explícita. Verificar antes de
# publicar número histórico como definitivo.
TOLERANCIA_ATE_2016 = 2.0
TOLERANCIA_DE_2017 = 1.5

# O IPCA de um mês é divulgado por volta do dia 10 do mês seguinte. Usar o dado
# antes disso seria look-ahead: a previsão "saberia" o que ainda não fora
# publicado. 45 dias é folgado de propósito.
ATRASO_PUBLICACAO = timedelta(days=45)


def teto(ano: int, meta: float) -> float:
    return meta + (TOLERANCIA_DE_2017 if ano >= 2017 else TOLERANCIA_ATE_2016)


def montar() -> pl.DataFrame:
    """Uma linha por (data de coleta, ano de referência) com previsão e realizado."""
    consenso = (pl.read_parquet(DADOS / "consenso_anual.parquet")
                  .filter(pl.col("indicador") == "IPCA")
                  .select("data", "referencia", "horizonte_meses",
                          "media", "mediana", "desvio", "minimo", "maximo", "n"))

    ipca12 = pl.read_parquet(DADOS / "sgs_ipca_12m.parquet")

    # Realizado do ano = IPCA acumulado em 12 meses medido em dezembro.
    realizado = (ipca12.filter(pl.col("data").dt.month() == 12)
                       .select(pl.col("data").dt.year().alias("ano"),
                               pl.col("ipca_12m").alias("realizado")))

    meta = (pl.read_parquet(DADOS / "sgs_meta_inflacao.parquet")
              .select(pl.col("data").dt.year().alias("ano"),
                      pl.col("meta")))

    # Baseline ingênuo: último IPCA 12m JÁ PUBLICADO na data da coleta.
    disponivel = (ipca12.select(pl.col("data").alias("ref_mes"),
                                pl.col("ipca_12m").alias("ingenuo"))
                        .with_columns((pl.col("ref_mes") + ATRASO_PUBLICACAO)
                                      .alias("publicado_em"))
                        .sort("publicado_em"))

    d = (consenso
         .with_columns(pl.col("referencia").dt.year().alias("ano"))
         .join(realizado, on="ano", how="inner")
         .join(meta, on="ano", how="inner")
         .sort("data")
         .join_asof(disponivel, left_on="data", right_on="publicado_em",
                    strategy="backward")
         .drop_nulls(["mediana", "realizado", "ingenuo"]))

    return d.with_columns(
        pl.struct(["ano", "meta"])
          .map_elements(lambda r: teto(r["ano"], r["meta"]), return_dtype=pl.Float64)
          .alias("teto"),
    ).with_columns(
        (pl.col("realizado") > pl.col("teto")).cast(pl.Int8).alias("estourou"),
    )


def por_horizonte(d: pl.DataFrame) -> list[dict]:
    linhas = []
    for h in HORIZONTES:
        x = d.filter(pl.col("horizonte_meses") == h)
        if x.height < 30:
            continue
        y = x["realizado"].to_numpy()
        c = x["mediana"].to_numpy()          # consenso
        ing = x["ingenuo"].to_numpy()        # baseline ingênuo
        met = x["meta"].to_numpy()           # baseline "acredita na meta"

        mz = A.mincer_zarnowitz(y, c)
        p = A.prob_acima(0.0, c - x["teto"].to_numpy(), x["desvio"].to_numpy())
        o = x["estourou"].to_numpy().astype(float)
        bs = A.brier(p, o)
        clima = float(o.mean())

        linhas.append({
            "horizonte_meses": h, "n": int(x.height),
            "periodo": [str(x["data"].min()), str(x["data"].max())],
            "consenso": {"me": A.me(y, c), "mae": A.mae(y, c), "rmse": A.rmse(y, c)},
            "ingenuo": {"mae": A.mae(y, ing), "rmse": A.rmse(y, ing)},
            "meta": {"mae": A.mae(y, met), "rmse": A.rmse(y, met)},
            "skill_consenso_vs_ingenuo": A.skill_score(A.rmse(y, c), A.rmse(y, ing)),
            "skill_consenso_vs_meta": A.skill_score(A.rmse(y, c), A.rmse(y, met)),
            "mincer_zarnowitz": {
                "alfa": mz.alfa, "beta": mz.beta,
                "ep_alfa": mz.ep_alfa, "ep_beta": mz.ep_beta,
                "t_beta_igual_1": mz.t_beta_igual_1,
                "lags_hac": mz.lags_hac, "leitura": mz.leitura,
            },
            "evento_acima_teto": {
                "brier": bs,
                "brier_climatologia": A.brier(np.full_like(o, clima), o),
                "brier_skill": A.brier_skill(bs, A.brier(np.full_like(o, clima), o)),
                "frequencia_base": clima,
                "confiabilidade": A.confiabilidade(p, o, n_faixas=5),
            },
        })
    return linhas


def foto_atual(d: pl.DataFrame) -> dict:
    """Último retrato: quantis e probabilidade implícitos no consenso."""
    ultimo = d.filter(pl.col("data") == d["data"].max()).sort("horizonte_meses")
    saida = []
    for r in ultimo.to_dicts():
        q = A.quantis(r["mediana"], r["desvio"])
        saida.append({
            "ano": r["ano"], "horizonte_meses": r["horizonte_meses"],
            "consenso": {"mediana": r["mediana"], "media": r["media"],
                         "dp": r["desvio"], "min": r["minimo"],
                         "max": r["maximo"], "n": r["n"]},
            "quantis_implicitos": q,
            "teto": r["teto"], "meta": r["meta"],
            "p_acima_teto": float(A.prob_acima(r["teto"], r["mediana"], r["desvio"])),
            "nuvem_reconstruivel": bool(r["n"] and r["desvio"] and r["minimo"] is not None),
        })
    return {"data": str(ultimo["data"].max()), "linhas": saida}


def main() -> None:
    d = montar()
    print(f"pares previsão × realizado: {d.height}  "
          f"({d['data'].min()} → {d['data'].max()}, anos {d['ano'].min()}–{d['ano'].max()})\n")

    tabela = por_horizonte(d)
    print(f"{'h':>3} {'n':>6} {'MAE_cons':>9} {'RMSE_cons':>10} {'RMSE_ing':>9} "
          f"{'RMSE_meta':>10} {'S vs ing':>9} {'viés':>7} {'β MZ':>6} {'Brier':>7}")
    print("-" * 92)
    for l in tabela:
        print(f"{l['horizonte_meses']:>3} {l['n']:>6} "
              f"{l['consenso']['mae']:>9.3f} {l['consenso']['rmse']:>10.3f} "
              f"{l['ingenuo']['rmse']:>9.3f} {l['meta']['rmse']:>10.3f} "
              f"{l['skill_consenso_vs_ingenuo']:>+9.3f} {l['consenso']['me']:>+7.3f} "
              f"{l['mincer_zarnowitz']['beta']:>6.2f} "
              f"{l['evento_acima_teto']['brier']:>7.3f}")

    foto = foto_atual(d)
    PUBLICO.mkdir(parents=True, exist_ok=True)
    saida = {"gerado_em": str(d["data"].max()), "indicador": "IPCA",
             "base_calculo": 0, "por_horizonte": tabela, "foto_atual": foto}
    (PUBLICO / "backtest.json").write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, default=float) + "\n",
        encoding="utf-8")
    print(f"\n  publicado: {PUBLICO / 'backtest.json'}")


if __name__ == "__main__":
    main()
