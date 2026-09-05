"""Cron unificado: sgs | brapi | yahoo | b3 | copom.

    uv run python -m nonio.cron
    CRON_SOURCES=yahoo uv run python -m nonio.cron
    CRON_SOURCES=sgs,b3,copom uv run python -m nonio.cron   # sem brapi
    B3_DETAIL_LIMIT=100 uv run python -m nonio.cron
"""

from __future__ import annotations

import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

import polars as pl
from sqlalchemy import select

from app.db.models import Stock
from app.db.session import SessionLocal, init_db
from app.db.writes import append_log, upsert_preview, upsert_stock
from app.parquet.store import store

from nonio.config import (
    brapi_batch_size,
    cron_force,
    cron_skip_fresh,
    history_range,
    stock_universe,
    universe_size,
    yahoo_history_period,
    yahoo_refresh_hours,
)
from nonio.services import b3, brapi, brapi_cache, copom, sgs, yahoo
from nonio.services.http import FonteIndisponivel


def _sources() -> set[str]:
    raw = os.getenv("CRON_SOURCES", "sgs,brapi,yahoo,b3,copom")
    return {s.strip().lower() for s in raw.split(",") if s.strip()}


def _b3_detail_limit() -> int | None:
    raw = os.getenv("B3_DETAIL_LIMIT", "").strip()
    if not raw:
        return None
    try:
        return max(0, int(raw))
    except ValueError:
        return None


def _resolve_codes() -> list[str]:
    fixed = stock_universe()
    if fixed:
        return fixed
    listed = brapi.list_top_stocks(limit=universe_size())
    print(f"universo brapi: {len(listed)} empresas", flush=True)
    return [item.code for item in listed]


def _is_fresh(db, code: str) -> bool:
    if not cron_skip_fresh() or cron_force():
        return False
    row = db.scalar(select(Stock).where(Stock.code == code))
    if row is None or not store.has_history(code):
        return False
    ttl = brapi_cache.cache_ttl_seconds()
    if ttl <= 0:
        return True
    age = datetime.now(timezone.utc).replace(tzinfo=None) - row.extracted_at
    return age <= timedelta(seconds=ttl)


def _persist_quote(db, quote: brapi.BrapiQuote, history) -> bool:
    upsert_stock(
        db,
        source="brapi",
        code=quote.code,
        extracted_at=quote.extracted_at,
        date_=quote.market_date,
        niche=quote.niche,
        company_name=quote.company_name,
        quote=quote.quote,
        pct_change=quote.pct_change,
        currency=quote.currency,
        market_cap=quote.market_cap,
        volume=quote.volume,
        previous_close=quote.previous_close,
        fifty_two_week_low=quote.fifty_two_week_low,
        fifty_two_week_high=quote.fifty_two_week_high,
        logo_url=quote.logo_url,
        pe=quote.pe,
        eps=quote.eps,
    )
    if history.height:
        store.write_history(quote.code, history, merge=True)
    has_target = any(
        v is not None
        for v in (
            quote.target_mean,
            quote.target_median,
            quote.target_high,
            quote.target_low,
        )
    )
    upsert_preview(
        db,
        source="brapi",
        code=quote.code,
        as_of=quote.market_date,
        extracted_at=quote.extracted_at,
        target_mean=quote.target_mean,
        target_median=quote.target_median,
        target_high=quote.target_high,
        target_low=quote.target_low,
        recommendation_key=quote.recommendation_key,
        recommendation_mean=quote.recommendation_mean,
        n_opinions=quote.n_opinions,
        preco_referencia=quote.quote,
        payload={
            "targetMeanPrice": quote.target_mean,
            "targetMedianPrice": quote.target_median,
            "targetHighPrice": quote.target_high,
            "targetLowPrice": quote.target_low,
            "recommendationKey": quote.recommendation_key,
            "recommendationMean": quote.recommendation_mean,
            "numberOfAnalystOpinions": quote.n_opinions,
        },
    )
    return has_target


def run_sgs(*, force: bool) -> None:
    print("== sgs ==", flush=True)
    sgs.sync_all(force=force)


def run_b3(*, force: bool) -> None:
    print("== b3 ==", flush=True)
    b3.sync(detail_limit=_b3_detail_limit(), force=force)


def run_copom(*, force: bool) -> None:
    print("== copom ==", flush=True)
    qty = int(os.getenv("COPOM_QUANTIDADE", "500"))
    copom.sync(quantidade=qty, download=True, force=force)
    # Extração LLM opcional (cara): COPOM_LLM=1
    if os.getenv("COPOM_LLM", "").strip().lower() in {"1", "true", "yes"}:
        from nonio import copom_extract

        limit_raw = os.getenv("COPOM_LLM_LIMIT", "").strip()
        limit = int(limit_raw) if limit_raw else None
        copom_extract.sync(limit=limit, force=force)


def _yahoo_last_date(code: str) -> date | None:
    if not store.has_history(code):
        return None
    hist = store.read_history(code)
    if hist.height == 0:
        return None
    return hist["date"].max()


def _needs_yahoo_backfill(code: str) -> bool:
    """Backfill 5y se não há série Yahoo longa (brapi 3mo não conta)."""
    if not store.has_history(code):
        return True
    hist = store.read_history(code)
    if hist.height == 0 or "source" not in hist.columns:
        return True
    yahoo_rows = hist.filter(pl.col("source") == "yahoo")
    if yahoo_rows.height < 200:
        return True
    span = (yahoo_rows["date"].max() - yahoo_rows["date"].min()).days
    return span < 4 * 365


def _yahoo_is_fresh(db, code: str) -> bool:
    """Pula se já baixamos Yahoo há menos de YAHOO_REFRESH_HOURS (~2 dias)."""
    if not cron_skip_fresh() or cron_force():
        return False
    if not store.has_history(code):
        return False
    row = db.scalar(select(Stock).where(Stock.code == code))
    if row is not None and row.source == "yahoo":
        ttl_h = yahoo_refresh_hours()
        if ttl_h <= 0:
            return True
        age = datetime.now(timezone.utc).replace(tzinfo=None) - row.extracted_at
        return age <= timedelta(hours=ttl_h)

    # Sem snapshot yahoo no DuckDB: usa extracted_at das barras source=yahoo
    hist = store.read_history(code)
    if hist.height == 0 or "source" not in hist.columns:
        return False
    yahoo_rows = hist.filter(pl.col("source") == "yahoo")
    if yahoo_rows.height == 0:
        return False
    last_ext = yahoo_rows["extracted_at"].max()
    if last_ext is None:
        return False
    age = datetime.now(timezone.utc).replace(tzinfo=None) - last_ext
    return age <= timedelta(hours=yahoo_refresh_hours())


def _persist_yahoo_history(db, code: str, history) -> None:
    if history.height == 0:
        return
    store.write_history(code, history, merge=True)
    last = history.sort("date").tail(1)
    last_date = last["date"][0]
    last_close = last["close"][0]
    last_vol = last["volume"][0]
    extracted_at = last["extracted_at"][0]
    upsert_stock(
        db,
        source="yahoo",
        code=code,
        extracted_at=extracted_at,
        date_=last_date,
        quote=float(last_close) if last_close is not None else None,
        volume=float(last_vol) if last_vol is not None else None,
        currency="BRL",
    )


def run_yahoo(*, force: bool) -> None:
    """Backfill 5y (se vazio) + append a cada ~2 dias. Throttle entre lotes."""
    print("== yahoo ==", flush=True)
    init_db(reset=False)
    codes = _resolve_codes()
    period = yahoo_history_period()
    print(
        f"  n={len(codes)} backfill={period} refresh_h={yahoo_refresh_hours()} force={force}",
        flush=True,
    )
    db = SessionLocal()
    ok = skip = fail = empty = 0
    try:
        pending = [c for c in codes if not _yahoo_is_fresh(db, c)]
        skip = len(codes) - len(pending)
        if skip:
            print(f"  skip fresh: {skip}", flush=True)

        backfill = [c for c in pending if force or _needs_yahoo_backfill(c)]
        refresh = [c for c in pending if c not in set(backfill)]

        if backfill:
            print(f"  backfill {len(backfill)} tickers ({period})", flush=True)
            try:
                got = yahoo.fetch_histories(backfill, period=period)
                for code, history in got.items():
                    if history.height == 0:
                        empty += 1
                        print(f"  {code} vazio", flush=True)
                        continue
                    _persist_yahoo_history(db, code, history)
                    append_log(
                        db,
                        action="cron.yahoo.history",
                        message=f"{code} hist={history.height} backfill",
                        entity_type="stock",
                        entity_id=code,
                    )
                    ok += 1
                    print(f"  [{ok + skip}/{len(codes)}] {code} hist={history.height}", flush=True)
                db.commit()
            except yahoo.YahooErro as exc:
                db.rollback()
                fail += len(backfill)
                append_log(db, action="cron.yahoo.error", message=str(exc))
                db.commit()
                print(f"  backfill FALHOU: {exc}", flush=True)

        if refresh:
            # Uma janela comum: 10 dias antes do min(last) — cobre o gap de 2 dias
            lasts = [_yahoo_last_date(c) for c in refresh]
            starts = [d for d in lasts if d is not None]
            start = min(starts) - timedelta(days=10) if starts else None
            print(f"  refresh {len(refresh)} tickers start={start}", flush=True)
            try:
                got = yahoo.fetch_histories(refresh, start=start)
                for code, history in got.items():
                    if history.height == 0:
                        empty += 1
                        print(f"  {code} vazio", flush=True)
                        continue
                    _persist_yahoo_history(db, code, history)
                    append_log(
                        db,
                        action="cron.yahoo.history",
                        message=f"{code} hist={history.height} refresh",
                        entity_type="stock",
                        entity_id=code,
                    )
                    ok += 1
                    print(f"  [{ok + skip}/{len(codes)}] {code} hist={history.height}", flush=True)
                db.commit()
            except yahoo.YahooErro as exc:
                db.rollback()
                fail += len(refresh)
                append_log(db, action="cron.yahoo.error", message=str(exc))
                db.commit()
                print(f"  refresh FALHOU: {exc}", flush=True)

        append_log(
            db,
            action="cron.yahoo.done",
            message=f"ok={ok} skip={skip} fail={fail} empty={empty}",
        )
        db.commit()
    finally:
        db.close()
    print(
        f"  yahoo fim: ok={ok} skip={skip} fail={fail} empty={empty}",
        flush=True,
    )


def run_brapi(*, force: bool) -> None:
    print("== brapi ==", flush=True)
    init_db(reset=False)
    codes = _resolve_codes()
    range_ = history_range()
    print(
        f"  n={len(codes)} range={range_} batch={brapi_batch_size()} force={force}",
        flush=True,
    )
    db = SessionLocal()
    ok = skip = fail = 0
    previews_with_target = 0
    try:
        pending = [c for c in codes if not _is_fresh(db, c)]
        skip = len(codes) - len(pending)
        if skip:
            print(f"  skip fresh: {skip}", flush=True)
        chunks = brapi.chunked(pending, brapi_batch_size())
        for ci, chunk in enumerate(chunks, 1):
            try:
                items = brapi.fetch_quotes(chunk, range_=range_, force=force)
                for quote, history in items:
                    if _persist_quote(db, quote, history):
                        previews_with_target += 1
                    append_log(
                        db,
                        action="cron.brapi.quote",
                        message=f"{quote.code} hist={history.height}",
                        entity_type="stock",
                        entity_id=quote.code,
                    )
                    ok += 1
                    print(
                        f"  [{ok + skip}/{len(codes)}] {quote.code} hist={history.height}",
                        flush=True,
                    )
                db.commit()
            except FonteIndisponivel as exc:
                db.rollback()
                print(f"  chunk {ci} falhou ({exc}); 1x1", flush=True)
                for code in chunk:
                    try:
                        quote, history = brapi.fetch_quote(
                            code, range_=range_, force=force
                        )
                        if _persist_quote(db, quote, history):
                            previews_with_target += 1
                        db.commit()
                        ok += 1
                        print(
                            f"  [{ok + skip}/{len(codes)}] {quote.code} hist={history.height}",
                            flush=True,
                        )
                    except FonteIndisponivel as one_exc:
                        db.rollback()
                        fail += 1
                        append_log(
                            db,
                            action="cron.brapi.error",
                            message=str(one_exc),
                            entity_type="stock",
                            entity_id=code,
                        )
                        db.commit()
                        print(f"  {code} FALHOU: {one_exc}", flush=True)
            time.sleep(0.2)
        append_log(
            db,
            action="cron.brapi.done",
            message=f"ok={ok} skip={skip} fail={fail} targets={previews_with_target}",
        )
        db.commit()
    finally:
        db.close()
    print(
        f"  brapi fim: ok={ok} skip={skip} fail={fail} targets={previews_with_target}",
        flush=True,
    )


def run() -> None:
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

    reset = os.getenv("NONIO_RESET_DB", "").strip().lower() in {"1", "true", "yes"}
    init_db(reset=reset)
    force = cron_force()
    wanted = _sources()
    print(f"cron sources={sorted(wanted)} force={force}", flush=True)

    db = SessionLocal()
    try:
        if "sgs" in wanted:
            try:
                run_sgs(force=force)
                append_log(db, action="cron.sgs.done", message="ok")
                db.commit()
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                append_log(db, action="cron.sgs.error", message=str(exc))
                db.commit()
                print(f"  sgs FALHOU: {exc}", flush=True)

        if "brapi" in wanted:
            try:
                run_brapi(force=force)
            except Exception as exc:  # noqa: BLE001
                append_log(db, action="cron.brapi.error", message=str(exc))
                db.commit()
                print(f"  brapi FALHOU: {exc}", flush=True)

        if "yahoo" in wanted:
            try:
                run_yahoo(force=force)
            except Exception as exc:  # noqa: BLE001
                append_log(db, action="cron.yahoo.error", message=str(exc))
                db.commit()
                print(f"  yahoo FALHOU: {exc}", flush=True)

        if "b3" in wanted:
            try:
                run_b3(force=force)
                append_log(db, action="cron.b3.done", message="ok")
                db.commit()
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                append_log(db, action="cron.b3.error", message=str(exc))
                db.commit()
                print(f"  b3 FALHOU: {exc}", flush=True)

        if "copom" in wanted:
            try:
                run_copom(force=force)
                append_log(db, action="cron.copom.done", message="ok")
                db.commit()
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                append_log(db, action="cron.copom.error", message=str(exc))
                db.commit()
                print(f"  copom FALHOU: {exc}", flush=True)

        append_log(db, action="cron.done", message=f"sources={sorted(wanted)}")
        db.commit()
    finally:
        db.close()
    print("cron fim", flush=True)


if __name__ == "__main__":
    run()
