"""Contrato Parquet por stock — o cron escreve; o treino lê.

Layout local (S3-ready: trocar a raiz por s3://bucket/prefix):

    {PARQUET_ROOT}/stocks/{CODE}/history.parquet

Uma partição por ticker mantém o treino simples (ler um código = um arquivo)
e o cron rápido (overwrite/append por ativo).
"""

import polars as pl

# Schema explícito — mesmo espírito do Focus no pipeline: contrato, não inferência.
HISTORY_SCHEMA: dict[str, pl.DataType] = {
    "code": pl.String,
    "date": pl.Date,
    "open": pl.Float64,
    "high": pl.Float64,
    "low": pl.Float64,
    "close": pl.Float64,
    "volume": pl.Float64,
    "source": pl.String,
    "extracted_at": pl.Datetime("us"),
}

HISTORY_COLUMNS = list(HISTORY_SCHEMA.keys())


def empty_history() -> pl.DataFrame:
    return pl.DataFrame(schema=HISTORY_SCHEMA)


def validate_history(df: pl.DataFrame) -> pl.DataFrame:
    missing = [c for c in HISTORY_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Parquet history sem colunas: {missing}")
    return df.select(HISTORY_COLUMNS).cast(HISTORY_SCHEMA, strict=False)
