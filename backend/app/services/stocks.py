from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Stock
from app.schemas.stocks import StockOut, StockPage
from app.schemas import stock_to_out
from app.services.model_signals import return_above_cdi_12m


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


def get_stock(db: Session, code: str) -> StockOut | None:
    row = db.scalar(
        select(Stock).where(func.upper(Stock.code) == code.strip().upper()).limit(1)
    )
    if row is None:
        return None
    return stock_to_out(row, return_above_cdi_12m(row.code))
