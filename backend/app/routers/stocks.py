from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.stocks import StockOut, StockPage
from app.services import stocks as stocks_service

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("", response_model=StockPage)
def search_stocks(
    q: str | None = Query(default=None, description="Busca por ticker ou empresa"),
    niche: str | None = Query(default=None, description="Filtro por setor/niche"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> StockPage:
    return stocks_service.list_stocks(
        db, q=q, niche=niche, page=page, page_size=page_size
    )


@router.get("/{code}", response_model=StockOut)
def get_stock(code: str, db: Session = Depends(get_db)) -> StockOut:
    item = stocks_service.get_stock(db, code)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Stock {code!r} não encontrado")
    return item
