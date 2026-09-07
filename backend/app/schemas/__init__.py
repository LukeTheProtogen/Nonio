"""Helpers de schema.

`Stock` é modelo SQLAlchemy e só serve ao caminho /stocks. Importá-lo aqui
fazia com que qualquer `from app.schemas.acoes import …` exigisse SQLAlchemy —
inclusive no bundle da Vercel, que não leva /stocks. Com
`from __future__ import annotations` a anotação vira string e não é avaliada
no import; o modelo só carrega para o type checker.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.schemas.stocks import StockOut

if TYPE_CHECKING:  # pragma: no cover
    from app.db.models import Stock


def stock_to_out(row: Stock, return_above_cdi_12m: float | None = None) -> StockOut:
    return StockOut(
        ticker=row.code,
        company_name=row.company_name,
        niche=row.niche,
        quote=row.quote,
        pct_change=row.pct_change,
        return_above_cdi_12m=return_above_cdi_12m,
        currency=row.currency,
        market_cap=row.market_cap,
        volume=row.volume,
        previous_close=row.previous_close,
        fifty_two_week_low=row.fifty_two_week_low,
        fifty_two_week_high=row.fifty_two_week_high,
        logo_url=row.logo_url,
        pe=row.pe,
        eps=row.eps,
        date=row.date,
        source=row.source,
        extracted_at=row.extracted_at,
    )
