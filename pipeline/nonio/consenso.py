"""Normaliza o consenso do Focus numa base única e comparável.

O Olinda entrega uma linha por (data de coleta, referência) com média, mediana,
desvio, mínimo, máximo e nº de respondentes. Cru, isso não é comparável entre
indicadores: IPCA em pontos percentuais e Câmbio em reais têm escalas
diferentes, e o mesmo desvio significa coisas distintas em cada um.

Aqui a base vira formato longo com o horizonte explícito e as estatísticas
normalizadas do formulário (seção 01 — Estatística do Consenso):

    cv           = desvio / |média|                  dispersão adimensional
    assimetria   = 3·(média − mediana) / desvio       assimetria de Pearson
    amplitude_dp = (máximo − mínimo) / desvio         peso das caudas
    desacordo    = desvio / média móvel de 52 semanas  >1 = mercado mais dividido

    uv run python -m nonio.consenso
"""
from __future__ import annotations

from pathlib import Path

import polars as pl

RAIZ = Path(__file__).resolve().parents[2]
ENTRADA = RAIZ / "data" / "raw"
SAIDA = ENTRADA

# Horizontes que o produto exibe. Os demais continuam na base — filtrar é
# barato, rebaixar não é.
HORIZONTES = [1, 3, 6, 9, 12]

RENOMEAR = {
    "Indicador": "indicador", "Data": "data", "Media": "media",
    "Mediana": "mediana", "DesvioPadrao": "desvio", "Minimo": "minimo",
    "Maximo": "maximo", "numeroRespondentes": "n",
}


def _renomear(df: pl.DataFrame) -> pl.DataFrame:
    """Renomeia só o que existe.

    O parquet da Selic por reunião não tem coluna `Indicador` — não faria
    sentido, é tudo Selic. O `rename` do polars é estrito e quebra com chave
    ausente, então filtramos pelo que está de fato no schema.
    """
    return df.rename({k: v for k, v in RENOMEAR.items() if k in df.columns})


def _derivadas(df: pl.DataFrame) -> pl.DataFrame:
    """Estatísticas comparáveis entre indicadores de escalas diferentes."""
    df = df.sort(["indicador", "horizonte_meses", "data"])
    return (
        df.with_columns(
            pl.when(pl.col("media").abs() > 1e-9)
              .then(pl.col("desvio") / pl.col("media").abs())
              .alias("cv"),
            pl.when(pl.col("desvio") > 1e-9)
              .then(3 * (pl.col("media") - pl.col("mediana")) / pl.col("desvio"))
              .alias("assimetria"),
            (pl.col("maximo") - pl.col("minimo")).alias("amplitude"),
        )
        .with_columns(
            pl.when(pl.col("desvio") > 1e-9)
              .then(pl.col("amplitude") / pl.col("desvio"))
              .alias("amplitude_dp"),
            # Desacordo normalizado: desvio de hoje contra o desvio típico do
            # último ano, no MESMO indicador e MESMO horizonte. Comparar
            # horizontes diferentes não faria sentido — 12 meses sempre dispersa
            # mais que 1 mês.
            pl.col("desvio")
              .rolling_mean_by("data", window_size="365d")
              .over(["indicador", "horizonte_meses"])
              .alias("desvio_medio_52s"),
        )
        .with_columns(
            pl.when(pl.col("desvio_medio_52s") > 1e-9)
              .then(pl.col("desvio") / pl.col("desvio_medio_52s"))
              .alias("desacordo"),
            # A nuvem de dispersão do design reconstrói ~n pontos de uma normal
            # truncada em [mínimo, máximo]. Sem `n`, sem mínimo ou sem máximo,
            # ela é IMPOSSÍVEL — e o Focus só publica `n` a partir de 2014.
            # Marcar aqui evita que a interface invente um n e desenhe uma nuvem
            # falsa em cima de dado histórico. Antes de 2014, mostrar a faixa
            # mínimo–máximo sem pontos, dizendo por quê.
            (pl.col("n").is_not_null()
             & pl.col("minimo").is_not_null()
             & pl.col("maximo").is_not_null()
             & (pl.col("desvio") > 1e-9)).alias("nuvem_reconstruivel"),
        )
    )


def mensais() -> pl.DataFrame:
    arquivos = sorted(ENTRADA.glob("focus_mensais_*.parquet"))
    if not arquivos:
        raise SystemExit("nenhum focus_mensais_*.parquet — rode `make dados` antes")
    partes = []
    for f in arquivos:
        d = _renomear(pl.read_parquet(f))
        partes.append(d.with_columns(
            # Horizonte em meses cheios entre a coleta e o mês de referência.
            ((pl.col("referencia").dt.year() - pl.col("data").dt.year()) * 12
             + (pl.col("referencia").dt.month() - pl.col("data").dt.month()))
            .cast(pl.Int32).alias("horizonte_meses"),
            pl.lit("mensal").alias("frequencia"),
        ).drop("DataReferencia"))
    return _derivadas(pl.concat(partes, how="vertical_relaxed"))


def anuais() -> pl.DataFrame:
    arquivos = sorted(ENTRADA.glob("focus_anuais_*.parquet"))
    if not arquivos:
        return pl.DataFrame()
    partes = []
    for f in arquivos:
        d = _renomear(pl.read_parquet(f))
        partes.append(d.with_columns(
            # Para o ano-calendário, o horizonte é a distância até 31/12 dele.
            ((pl.col("referencia").dt.year() - pl.col("data").dt.year()) * 12
             + (12 - pl.col("data").dt.month()))
            .cast(pl.Int32).alias("horizonte_meses"),
            pl.lit("anual").alias("frequencia"),
        ).drop("DataReferencia"))
    return _derivadas(pl.concat(partes, how="vertical_relaxed"))


def selic() -> pl.DataFrame:
    f = ENTRADA / "focus_selic_reuniao.parquet"
    if not f.exists():
        return pl.DataFrame()
    d = _renomear(pl.read_parquet(f))
    d = d.with_columns(
        pl.lit("Selic").alias("indicador"),
        pl.lit("reuniao").alias("frequencia"),
        (pl.col("reuniao_ano") * 100 + pl.col("reuniao_num")).alias("reuniao_ord"),
    )
    # Não temos o calendário do Copom, então o horizonte vem do próprio dado:
    # em cada data de coleta, a menor reunião publicada é a próxima. Suposição
    # explícita — se o Focus passar a publicar reuniões já ocorridas, quebra.
    return _derivadas(
        d.with_columns(
            (pl.col("reuniao_ord").rank("dense").over("data"))
            .cast(pl.Int32).alias("horizonte_meses")
        )
    )


def main() -> None:
    for nome, fn in (("consenso_mensal", mensais),
                     ("consenso_anual", anuais),
                     ("consenso_selic", selic)):
        d = fn()
        if d.is_empty():
            print(f"  {nome:<20} sem dado de origem — pulado")
            continue
        d.write_parquet(SAIDA / f"{nome}.parquet")
        alvo = d.filter(pl.col("horizonte_meses").is_in(HORIZONTES))
        print(f"  {nome:<20} {d.height:>7} linhas  "
              f"({alvo.height} nos horizontes {HORIZONTES})")
        print(f"  {'':<20} indicadores: {sorted(d['indicador'].unique().to_list())}")
    print(f"\n  escrito em {SAIDA}")


if __name__ == "__main__":
    main()
