"""Histórico OHLCV via Yahoo Finance (.SA) — medium/long term.

Cadência: pensado para cron a cada ~2 dias (não tick-a-tick).
Throttle: pausa entre lotes (docs OSS yfinance: ~2 req / 5s).
Sem proxy por padrão; backoff só se vier 429.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timezone
from typing import Any

import polars as pl

from nonio.config import (
    yahoo_batch_size,
    yahoo_history_period,
    yahoo_max_retries,
    yahoo_pause_sec,
)

SOURCE = "yahoo"


class YahooErro(RuntimeError):
    pass


def to_yahoo_symbol(code: str) -> str:
    code = code.strip().upper()
    if code.endswith(".SA"):
        return code
    return f"{code}.SA"


def chunked(symbols: list[str], size: int | None = None) -> list[list[str]]:
    n = size or yahoo_batch_size()
    return [symbols[i : i + n] for i in range(0, len(symbols), n)]


def _session():
    try:
        from curl_cffi import requests as curl_requests
    except ImportError as e:
        raise YahooErro('uv add "curl-cffi"') from e
    return curl_requests.Session(impersonate="chrome")


def empty_history() -> pl.DataFrame:
    return pl.DataFrame(
        schema={
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
    )


def _frame_from_ohlcv(code: str, df: Any, *, extracted_at: datetime) -> pl.DataFrame:
    if df is None or getattr(df, "empty", True):
        return empty_history()

    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        try:
            df = df.droplevel(0, axis=1)
        except Exception:
            pass

    need = {"Open", "High", "Low", "Close", "Volume"}
    if not need.issubset(set(df.columns)):
        return empty_history()

    rows: list[dict] = []
    for ts, row in df.iterrows():
        try:
            close = row["Close"]
            if close != close:  # NaN
                continue
            d = ts.date() if hasattr(ts, "date") else date.fromisoformat(str(ts)[:10])
            vol = row["Volume"]
            rows.append(
                {
                    "code": code,
                    "date": d,
                    "open": float(row["Open"]) if row["Open"] == row["Open"] else None,
                    "high": float(row["High"]) if row["High"] == row["High"] else None,
                    "low": float(row["Low"]) if row["Low"] == row["Low"] else None,
                    "close": float(close),
                    "volume": float(vol) if vol == vol else None,
                    "source": SOURCE,
                    "extracted_at": extracted_at,
                }
            )
        except Exception:
            continue
    if not rows:
        return empty_history()
    return pl.DataFrame(rows).with_columns(pl.col("date").cast(pl.Date))


def download_batch(
    codes: list[str],
    *,
    period: str | None = None,
    start: str | date | None = None,
    session=None,
) -> dict[str, pl.DataFrame]:
    """Uma chamada yf.download → {CODE: history_df}."""
    try:
        import yfinance as yf
    except ImportError as e:
        raise YahooErro("uv add yfinance") from e

    if not codes:
        return {}

    extracted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    codes_u = [c.strip().upper() for c in codes]
    syms = [to_yahoo_symbol(c) for c in codes_u]
    sess = session or _session()
    kwargs: dict[str, Any] = {
        "tickers": " ".join(syms) if len(syms) > 1 else syms[0],
        "interval": "1d",
        "auto_adjust": False,
        "group_by": "ticker",
        "threads": False,
        "progress": False,
        "session": sess,
    }
    if start is not None:
        kwargs["start"] = start.isoformat() if isinstance(start, date) else str(start)
    else:
        kwargs["period"] = period or yahoo_history_period()

    last_err: Exception | None = None
    data = None
    for attempt in range(1, yahoo_max_retries() + 1):
        try:
            data = yf.download(**kwargs)
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            name = type(exc).__name__
            msg = str(exc).lower()
            rate = (
                "rate" in msg
                or "too many" in msg
                or "429" in msg
                or "YFRateLimit" in name
            )
            if rate and attempt < yahoo_max_retries():
                wait = min(120, 15 * attempt)
                print(f"  yahoo 429/backoff {wait}s (tentativa {attempt})", flush=True)
                time.sleep(wait)
                continue
            raise YahooErro(f"yahoo download falhou: {exc}") from exc
    if data is None:
        raise YahooErro(f"yahoo download falhou: {last_err}")

    out: dict[str, pl.DataFrame] = {}
    if len(codes_u) == 1:
        out[codes_u[0]] = _frame_from_ohlcv(codes_u[0], data, extracted_at=extracted_at)
        return out

    if hasattr(data, "columns") and getattr(data.columns, "nlevels", 1) > 1:
        level0 = set(data.columns.get_level_values(0))
        for code in codes_u:
            sym = to_yahoo_symbol(code)
            if sym in level0:
                sub = data[sym]
            elif code in level0:
                sub = data[code]
            else:
                out[code] = empty_history()
                continue
            out[code] = _frame_from_ohlcv(code, sub, extracted_at=extracted_at)
        return out

    for code in codes_u:
        out[code] = empty_history()
    out[codes_u[0]] = _frame_from_ohlcv(codes_u[0], data, extracted_at=extracted_at)
    return out


def fetch_histories(
    codes: list[str],
    *,
    period: str | None = None,
    start: str | date | None = None,
    pause_sec: float | None = None,
) -> dict[str, pl.DataFrame]:
    """Baixa vários tickers em lotes, com pausa entre lotes."""
    pause = yahoo_pause_sec() if pause_sec is None else pause_sec
    session = _session()
    results: dict[str, pl.DataFrame] = {}
    batches = chunked(codes)
    for i, batch in enumerate(batches, 1):
        label = f"start={start}" if start is not None else f"period={period or yahoo_history_period()}"
        print(f"  yahoo lote {i}/{len(batches)} n={len(batch)} {label}", flush=True)
        results.update(
            download_batch(batch, period=period, start=start, session=session)
        )
        if i < len(batches) and pause > 0:
            time.sleep(pause)
    return results
