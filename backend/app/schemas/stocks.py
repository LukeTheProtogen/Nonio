from datetime import date as Date
from datetime import datetime as DateTime

from pydantic import BaseModel, ConfigDict, Field


class StockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticker: str = Field(description="Código do ativo (ex.: PETR4)")
    company_name: str | None = Field(default=None, description="Nome social / razão")
    niche: str | None = Field(
        default=None,
        description="Industry da brapi (não o sector genérico)",
    )
    quote: float | None = None
    pct_change: float | None = Field(
        default=None,
        description="Variação percentual da fonte; null quando a fonte não manda",
    )
    return_above_cdi_12m: float | None = Field(
        default=None,
        description="Retorno 12m acima do CDI — vem do serviço do modelo (null no MVP)",
    )
    currency: str | None = None
    market_cap: float | None = None
    volume: float | None = None
    previous_close: float | None = None
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None
    logo_url: str | None = None
    pe: float | None = None
    eps: float | None = None
    date: Date | None = None
    source: str | None = None
    extracted_at: DateTime | None = None


class StockPage(BaseModel):
    items: list[StockOut]
    page: int
    page_size: int
    total: int


class HistoryBar(BaseModel):
    date: Date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
    source: str | None = None
    extracted_at: DateTime | None = None


class StockDetailOut(StockOut):
    """Lookup + série histórica completa (Parquet). Preferência: source=yahoo."""

    history: list[HistoryBar] = Field(default_factory=list)
