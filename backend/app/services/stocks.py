from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Stock
from app.parquet.store import store
from app.schemas import stock_to_out
from app.schemas.stocks import HistoryBar, StockDetailOut, StockOut, StockPage
from app.services.model_signals import return_above_cdi_12m

PREFERRED_HISTORY_SOURCE = "yahoo"


def list_stocks(
    db: Session,
    *,
    q: str | None,
    niche: str | None,
    page: int,
    page_size: int,
) -> StockPage:
    stmt = select(Stock)

    if q:
        like = f"%{q.strip().upper()}%"
        stmt = stmt.where(
            (func.upper(Stock.code).like(like))
            | (func.upper(func.coalesce(Stock.company_name, "")).like(like))
        )
    if niche:
        stmt = stmt.where(func.lower(Stock.niche) == niche.strip().lower())

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Stock.market_cap.desc().nullslast(), Stock.code.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = [stock_to_out(row, return_above_cdi_12m(row.code)) for row in rows]
    return StockPage(items=items, page=page, page_size=page_size, total=total)


def _history_bars(code: str) -> list[HistoryBar]:
    df = store.read_history(code)
    if df.is_empty():
        return []
    preferred = df.filter(df["source"] == PREFERRED_HISTORY_SOURCE)
    if not preferred.is_empty():
        df = preferred
    else:
        # Sem yahoo: uma barra por data (última escrita).
        df = df.sort(["date", "extracted_at"]).unique(subset=["date"], keep="last")
    df = df.sort("date")
    return [
        HistoryBar(
            date=row["date"],
            open=row.get("open"),
            high=row.get("high"),
            low=row.get("low"),
            close=row.get("close"),
            volume=row.get("volume"),
            source=row.get("source"),
            extracted_at=row.get("extracted_at"),
        )
        for row in df.to_dicts()
    ]


def get_stock(db: Session, code: str) -> StockDetailOut | None:
    row = db.scalar(
        select(Stock).where(func.upper(Stock.code) == code.strip().upper()).limit(1)
    )
    if row is None:
        return None
    base: StockOut = stock_to_out(row, return_above_cdi_12m(row.code))
    return StockDetailOut(**base.model_dump(), history=_history_bars(row.code))
