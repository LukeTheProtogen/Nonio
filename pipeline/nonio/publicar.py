"""Publica o dado macro real que as telas consomem.

Substitui `web/src/mock/macro.ts`. Tudo aqui sai de `consenso_anual.parquet`
(Focus, 2000→hoje, base 0) e da série 13521 do BCB — nada é inventado.

A decisão que define este arquivo: o bloco `modelo` sai **null**.

Existe modelo de AÇÕES (`train/`, LightGBM sobre excedente), e não existe modelo
MACRO. Publicar os quantis implícitos do consenso rotulados como "modelo" seria
apresentar a leitura do Focus como previsão própria — exatamente a desonestidade
que este produto existe para não cometer. A tela mostra a ausência.

    uv run python -m nonio.publicar
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

import polars as pl

from . import avaliacao as A

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "data" / "raw"
SAIDA = RAIZ / "web" / "src" / "data"

# Banda do regime de metas. A meta vem da API (13521); a tolerância é do CMN.
TOLERANCIA_ATE_2016 = 2.0
TOLERANCIA_DE_2017 = 1.5

ANOS_ADIANTE = 4

# Ordem de PRODUTO, não alfabética. O IPCA é a manchete: as telas pegam o
# primeiro item da lista, e ordenar por nome punha o Câmbio na frente.
ORDEM = {"IPCA": 0, "Selic": 1, "Câmbio": 2, "PIB Total": 3}
UNIDADE = {"IPCA": "pct", "Selic": "pct", "Câmbio": "brl", "PIB Total": "pct"}


def _slug(nome: str, ano: int) -> str:
    base = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return f"{base.lower().replace(' ', '-')}-{ano}"


def _metas() -> tuple[dict[int, float], int]:
    """Meta por ano e o último ano efetivamente publicado.

    A série 13521 termina no ano corrente — o CMN não publica meta indefinida
    para o futuro. Para anos além disso, carregamos a última meta adiante, e o
    JSON diz que foi carregada. Sem essa marca, a tela apresentaria uma meta
    projetada como se fosse oficial.
    """
    m = pl.read_parquet(DADOS / "sgs_meta_inflacao.parquet")
    d = {r["data"].year: r["meta"] for r in m.to_dicts()}
    return d, max(d)


def main() -> None:
    d = pl.read_parquet(DADOS / "consenso_anual.parquet")
    coleta = d["data"].max()
    metas, ultimo_ano_meta = _metas()

    atual = (d.filter(pl.col("data") == coleta)
               .with_columns(pl.col("referencia").dt.year().alias("ano"))
               .filter(pl.col("ano") <= coleta.year + ANOS_ADIANTE)
               .sort(["indicador", "ano"]))

    atual = atual.with_columns(
        pl.col("indicador").replace_strict(ORDEM, default=99).alias("_ordem")
    ).sort(["_ordem", "ano"]).drop("_ordem")

    indicadores = []
    for r in atual.to_dicts():
        ind, ano = r["indicador"], r["ano"]
        dp = r["desvio"]

        # Evento binário só onde existe limiar defensável. Para o IPCA é o teto
        # do regime de metas, que vem de série oficial. Inventar um limiar para
        # Selic ou Câmbio produziria uma probabilidade sem significado.
        evento = None
        p_evento = None
        if ind == "IPCA":
            oficial = ano <= ultimo_ano_meta
            meta = metas.get(ano, metas[ultimo_ano_meta])
            tol = TOLERANCIA_DE_2017 if ano >= 2017 else TOLERANCIA_ATE_2016
            teto = meta + tol
            evento = {
                "tipo": "acimaTeto", "limiar": round(teto, 2),
                "rotulo": f"acima de {teto:.2f}%".replace(".", ","),
                "metaOficial": oficial,
                "fonte": ("BCB SGS 13521 (meta) + banda do CMN" if oficial else
                          f"meta de {ultimo_ano_meta} carregada adiante — o CMN "
                          f"ainda não publicou meta para {ano}"),
            }
            p_evento = float(A.prob_acima(teto, r["mediana"], dp)) if dp else None

        indicadores.append({
            "slug": _slug(ind, ano),
            "nome": f"{ind} {ano}",
            "indicador": ind,
            "ano": ano,
            "unidade": UNIDADE.get(ind, "pct"),
            "evento": evento,
            "pEvento": p_evento,
            "consenso": {
                "mediana": r["mediana"], "media": r["media"], "dp": dp,
                "min": r["minimo"], "max": r["maximo"], "n": r["n"],
                # Quantis da normal implícita na mediana e no desvio que o BC
                # publica. São leitura do CONSENSO, não previsão nossa.
                "quantis": A.quantis(r["mediana"], dp) if dp else None,
                "cv": r["cv"], "assimetria": r["assimetria"],
                "desacordo": r["desacordo"],
            },
            # Não há modelo macro. A tela mostra a ausência, não um número.
            "modelo": None,
            "modeloAusente": "Ainda não há modelo próprio para indicadores macro. "
                             "O modelo existente cobre ações.",
            "nuvemReconstruivel": bool(r["nuvem_reconstruivel"]),
        })

    saida = {
        # A verdade é a DATA. O horário existe só para evitar que "2026-08-28"
        # seja lido como meia-noite UTC e a tela mostre 27/08 em Brasília.
        "coletadoEm": f"{coleta}T12:00:00-03:00",
        "coletadoEmData": str(coleta),
        "baseCalculo": 0,
        "fonte": "BCB Olinda — Expectativas de Mercado (Focus), série anual",
        "indicadores": indicadores,
    }

    bt = SAIDA / "backtest.json"
    if bt.exists():
        saida["backtest"] = json.loads(bt.read_text(encoding="utf-8"))["por_horizonte"]

    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "macro.json").write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, default=float) + "\n",
        encoding="utf-8")

    print(f"  coleta {coleta} · {len(indicadores)} indicadores")
    for i in indicadores:
        ev = f"P({i['evento']['rotulo']})={i['pEvento']:.1%}" if i["pEvento"] is not None else "sem evento definido"
        print(f"    {i['slug']:<18} mediana={i['consenso']['mediana']:>7.2f}  "
              f"n={i['consenso']['n']:>4}  {ev}")
    print(f"\n  publicado: {SAIDA / 'macro.json'}")


if __name__ == "__main__":
    main()
