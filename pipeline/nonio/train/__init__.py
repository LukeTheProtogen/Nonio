"""Treino LightGBM — P(bater CDI em 12m).

    uv run python -m nonio.train
"""

MODELO_VERSAO = "lgbm-cdi-v4"

# README: 15–20 Ibovespa, incluindo os quatro da demo.
DEFAULT_UNIVERSE = [
    "PETR4",
    "VALE3",
    "ITUB4",
    "MGLU3",
    "BBDC4",
    "BBAS3",
    "ABEV3",
    "WEGE3",
    "B3SA3",
    "RENT3",
    "SUZB3",
    "GGBR4",
    "RDOR3",
    "PRIO3",
    "EQTL3",
    "RADL3",
    "VBBR3",
    "TOTS3",
    "LREN3",
    "HAPV3",
]

HORIZONTE_PREGOES = 252
PREGOES_ANO = 252
