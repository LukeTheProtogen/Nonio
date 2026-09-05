"""Cotação + histórico + listagem brapi.

Plano free (medido):
- 1 ticker/request (sandbox PETR4/VALE3/ITUB4/MGLU3 pode batch)
- range ate 3mo (sandbox aceita max)
- modules: so summaryProfile (financialData/keyStats = Pro)

Otimiza: range=3mo + summaryProfile + cache + batch sandbox.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone

import polars as pl

from nonio.config import brapi_batch_size, brapi_token, history_range
from nonio.services import brapi_cache
from nonio.services.http import FonteIndisponivel, get_json

QUOTE_URL = "https://brapi.dev/api/quote/{symbol}"
LIST_URL = "https://brapi.dev/api/quote/list"
LIVRES = frozenset({"PETR4", "VALE3", "ITUB4", "MGLU3"})
MODULES_FULL = "summaryProfile,defaultKeyStatistics,financialData"
MODULES_FREE = "summaryProfile"
_ROOT_RE = re.compile(r"^([A-Z]+)")


@dataclass(frozen=True)
class BrapiQuote:
    code: str
    company_name: str | None
    niche: str | None
    quote: float | None
    pct_change: float | None
    currency: str | None
    market_cap: float | None
    volume: float | None
    previous_close: float | None
    fifty_two_week_low: float | None
    fifty_two_week_high: float | None
    logo_url: str | None
    pe: float | None
    eps: float | None
    market_date: date
    extracted_at: datetime
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    target_mean: float | None
    target_median: float | None
    target_high: float | None
    target_low: float | None
    recommendation_key: str | None
    recommendation_mean: float | None
    n_opinions: int | None


@dataclass(frozen=True)
class ListedStock:
    code: str
    name: str | None
    market_cap: float | None
    volume: float | None
    sector: str | None


def _headers() -> dict[str, str]:
    token = brapi_token()
    if not token:
        raise FonteIndisponivel("BRAPI_TOKEN ausente no .env")
    return {"Authorization": f"Bearer {token}"}


def _parse_market_time(raw: str | None) -> tuple[date, datetime]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not raw:
        return now.date(), now
    dt = datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    return dt.replace(tzinfo=None).date(), dt.replace(tzinfo=None)


def company_root(code: str) -> str:
    code = code.strip().upper()
    if code.endswith("F") and len(code) > 1:
        code = code[:-1]
    m = _ROOT_RE.match(code)
    return m.group(1) if m else code


def _all_sandbox(symbols: list[str]) -> bool:
    return bool(symbols) and all(s.upper() in LIVRES for s in symbols)


def _modules_for(symbols: list[str]) -> str:
    return MODULES_FULL if _all_sandbox(symbols) else MODULES_FREE


def _range_for(symbols: list[str], requested: str | None) -> str:
    req = (requested or history_range()).strip()
    if _all_sandbox(symbols):
        return req  # sandbox: max/5y ok
    # free: so estes ranges
    allowed = {"1d", "5d", "1mo", "3mo"}
    return req if req in allowed else "3mo"


def list_top_stocks(*, limit: int = 600, force: bool = False) -> list[ListedStock]:
    params = {
        "type": "stock",
        "sortBy": "market_cap_basic",
        "sortOrder": "desc",
        "limit": 1000,
        "page": 1,
    }
    payload = None if force else brapi_cache.read(LIST_URL, params)
    if payload is None:
        payload = get_json(LIST_URL, params=params, headers=_headers())
        brapi_cache.write(LIST_URL, params, payload)

    picked: list[ListedStock] = []
    seen: set[str] = set()
    for row in payload.get("stocks") or []:
        code = (row.get("stock") or "").strip().upper()
        if not code or code.endswith("F"):
            continue
        if (row.get("type") or "stock") != "stock":
            continue
        root = company_root(code)
        if root in seen:
            continue
        seen.add(root)
        cap = row.get("market_cap")
        picked.append(
            ListedStock(
                code=code,
                name=row.get("name"),
                market_cap=float(cap) if cap is not None else None,
                volume=float(row["volume"]) if row.get("volume") is not None else None,
                sector=row.get("sector"),
            )
        )
        if len(picked) >= limit:
            break
    if not picked:
        raise FonteIndisponivel("brapi list nao devolveu stocks")
    return picked


def _row_to_quote(row: dict, fallback_symbol: str) -> BrapiQuote:
    profile = row.get("summaryProfile") or {}
    fin = row.get("financialData") or {}
    market_date, extracted_at = _parse_market_time(row.get("regularMarketTime"))
    return BrapiQuote(
        code=row.get("symbol") or fallback_symbol,
        company_name=row.get("longName") or row.get("shortName") or profile.get("name"),
        niche=profile.get("industry"),
        quote=row.get("regularMarketPrice"),
        pct_change=row.get("regularMarketChangePercent"),
        currency=row.get("currency"),
        market_cap=row.get("marketCap"),
        volume=row.get("regularMarketVolume"),
        previous_close=row.get("regularMarketPreviousClose"),
        fifty_two_week_low=row.get("fiftyTwoWeekLow"),
        fifty_two_week_high=row.get("fiftyTwoWeekHigh"),
        logo_url=row.get("logourl") or profile.get("logoUrl"),
        pe=row.get("priceEarnings"),
        eps=row.get("earningsPerShare"),
        market_date=market_date,
        extracted_at=extracted_at,
        open=row.get("regularMarketOpen"),
        high=row.get("regularMarketDayHigh"),
        low=row.get("regularMarketDayLow"),
        close=row.get("regularMarketPrice"),
        target_mean=fin.get("targetMeanPrice"),
        target_median=fin.get("targetMedianPrice"),
        target_high=fin.get("targetHighPrice"),
        target_low=fin.get("targetLowPrice"),
        recommendation_key=fin.get("recommendationKey"),
        recommendation_mean=fin.get("recommendationMean"),
        n_opinions=fin.get("numberOfAnalystOpinions"),
    )


def fetch_quotes(
    symbols: list[str],
    *,
    range_: str | None = None,
    force: bool = False,
) -> list[tuple[BrapiQuote, pl.DataFrame]]:
    symbols = [s.strip().upper() for s in symbols if s.strip()]
    if not symbols:
        return []
    if not _all_sandbox(symbols) and len(symbols) > 1:
        # free: 1 por request
        out: list[tuple[BrapiQuote, pl.DataFrame]] = []
        for sym in symbols:
            out.extend(fetch_quotes([sym], range_=range_, force=force))
        return out

    range_eff = _range_for(symbols, range_)
    modules = _modules_for(symbols)
    url = QUOTE_URL.format(symbol=",".join(symbols))
    params = {"modules": modules, "range": range_eff, "interval": "1d"}

    payload = None if force else brapi_cache.read(url, params)
    if payload is None:
        payload = get_json(url, params=params, headers=_headers())
        brapi_cache.write(url, params, payload)

    results = payload.get("results") or []
    if not results:
        raise FonteIndisponivel(f"brapi sem results para {symbols}")

    by_symbol = {(r.get("symbol") or "").upper(): r for r in results}
    out = []
    for sym in symbols:
        row = by_symbol.get(sym)
        if row is None:
            raise FonteIndisponivel(f"brapi nao trouxe {sym} no batch {symbols}")
        quote = _row_to_quote(row, sym)
        history = _history_frame(
            quote.code, row.get("historicalDataPrice") or [], quote.extracted_at
        )
        out.append((quote, history))
    return out


def fetch_quote(
    symbol: str,
    *,
    range_: str | None = None,
    force: bool = False,
) -> tuple[BrapiQuote, pl.DataFrame]:
    return fetch_quotes([symbol], range_=range_, force=force)[0]


def chunked(symbols: list[str], size: int | None = None) -> list[list[str]]:
    """Sandbox pode ir em lotes; o resto em 1 (limite free)."""
    size = size or brapi_batch_size()
    livres = [s for s in symbols if s in LIVRES]
    outros = [s for s in symbols if s not in LIVRES]
    chunks: list[list[str]] = []
    sandbox_size = min(4, size)
    for i in range(0, len(livres), sandbox_size):
        chunks.append(livres[i : i + sandbox_size])
    for s in outros:
        chunks.append([s])
    return chunks


def _history_frame(code: str, bars: list[dict], extracted_at: datetime) -> pl.DataFrame:
    schema = {
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
    if not bars:
        return pl.DataFrame(schema=schema)
    rows = []
    for bar in bars:
        ts = bar.get("date")
        if ts is None:
            continue
        d = datetime.fromtimestamp(int(ts), tz=timezone.utc).date()
        rows.append(
            {
                "code": code,
                "date": d,
                "open": bar.get("open"),
                "high": bar.get("high"),
                "low": bar.get("low"),
                "close": bar.get("close"),
                "volume": float(bar["volume"]) if bar.get("volume") is not None else None,
                "source": "brapi",
                "extracted_at": extracted_at,
            }
        )
    return pl.DataFrame(rows, schema=schema)
