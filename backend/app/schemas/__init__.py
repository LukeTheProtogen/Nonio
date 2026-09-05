from app.db.models import Stock
from app.schemas.stocks import StockOut


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
