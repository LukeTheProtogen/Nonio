from datetime import date, datetime, timezone
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Log, Preview, Stock


def upsert_stock(
    db: Session,
    *,
    source: str,
    code: str,
    extracted_at: datetime,
    date_: date,
    niche: str | None = None,
    company_name: str | None = None,
    quote: float | None = None,
    pct_change: float | None = None,
    currency: str | None = None,
    market_cap: float | None = None,
    volume: float | None = None,
    previous_close: float | None = None,
    fifty_two_week_low: float | None = None,
    fifty_two_week_high: float | None = None,
    logo_url: str | None = None,
    pe: float | None = None,
    eps: float | None = None,
) -> Stock:
    """Lookup: uma linha por code — sobrescreve o snapshot."""
    code = code.strip().upper()
    existing = db.scalar(select(Stock).where(Stock.code == code))
    if existing is None:
        existing = Stock(
            source=source,
            code=code,
            extracted_at=extracted_at,
            date=date_,
        )
        db.add(existing)

    existing.source = source
    existing.extracted_at = extracted_at
    existing.date = date_
    existing.niche = niche
    existing.company_name = company_name
    existing.quote = quote
    existing.pct_change = pct_change
    existing.currency = currency
    existing.market_cap = market_cap
    existing.volume = volume
    existing.previous_close = previous_close
    existing.fifty_two_week_low = fifty_two_week_low
    existing.fifty_two_week_high = fifty_two_week_high
    existing.logo_url = logo_url
    existing.pe = pe
    existing.eps = eps
    return existing


def upsert_preview(
    db: Session,
    *,
    source: str,
    code: str,
    as_of: date,
    extracted_at: datetime,
    target_mean: float | None = None,
    target_median: float | None = None,
    target_high: float | None = None,
    target_low: float | None = None,
    recommendation_key: str | None = None,
    recommendation_mean: float | None = None,
    n_opinions: int | None = None,
    probabilidade: float | None = None,
    horizonte_meses: int | None = None,
    preco_referencia: float | None = None,
    modelo_versao: str | None = None,
    payload: dict | None = None,
) -> Preview:
    code = code.strip().upper()
    existing = db.scalar(
        select(Preview).where(
            Preview.source == source,
            Preview.code == code,
            Preview.as_of == as_of,
        )
    )
    if existing is None:
        existing = Preview(source=source, code=code, as_of=as_of, extracted_at=extracted_at)
        db.add(existing)

    existing.extracted_at = extracted_at
    existing.target_mean = target_mean
    existing.target_median = target_median
    existing.target_high = target_high
    existing.target_low = target_low
    existing.recommendation_key = recommendation_key
    existing.recommendation_mean = recommendation_mean
    existing.n_opinions = n_opinions
    existing.probabilidade = probabilidade
    existing.horizonte_meses = horizonte_meses
    existing.preco_referencia = preco_referencia
    existing.modelo_versao = modelo_versao
    existing.payload = json.dumps(payload, ensure_ascii=False) if payload is not None else None
    return existing


def append_log(
    db: Session,
    *,
    action: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: str | None = None,
    created_at: datetime | None = None,
) -> Log:
    row = Log(
        created_at=created_at or datetime.now(timezone.utc).replace(tzinfo=None),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        message=message,
        payload=payload,
    )
    db.add(row)
    return row
