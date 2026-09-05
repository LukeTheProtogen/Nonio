"""Config compartilhada do pipeline (raiz do monorepo + .env)."""

from pathlib import Path

from dotenv import load_dotenv
import os

RAIZ = Path(__file__).resolve().parents[2]
load_dotenv(RAIZ / ".env")


def stock_universe() -> list[str] | None:
    raw = os.getenv("STOCK_UNIVERSE", "")
    codes = [c.strip().upper() for c in raw.split(",") if c.strip()]
    return codes or None


def universe_size() -> int:
    raw = os.getenv("STOCK_UNIVERSE_SIZE", "600").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 600


def brapi_token() -> str | None:
    token = (os.getenv("BRAPI_TOKEN") or "").strip()
    return token or None


def history_range() -> str:
    # Plano free: so 1d,5d,1mo,3mo. Sandbox (PETR4/VALE3/ITUB4/MGLU3) aceita max.
    # 5y/max exigem Pro — ver erro INVALID_RANGE da brapi.
    return (os.getenv("BRAPI_HISTORY_RANGE", "3mo") or "3mo").strip()


def brapi_batch_size() -> int:
    """Medido: 4 ok com modules+range=max; 5+ retorna 400 neste token."""
    raw = os.getenv("BRAPI_BATCH_SIZE", "4").strip()
    try:
        return max(1, min(4, int(raw)))
    except ValueError:
        return 4


def cron_force() -> bool:
    return os.getenv("CRON_FORCE", "").strip().lower() in {"1", "true", "yes"}


def cron_skip_fresh() -> bool:
    """Pula ticker se stocks+parquet ainda frescos (TTL do cache). Default on."""
    return os.getenv("CRON_SKIP_FRESH", "1").strip().lower() not in {
        "0",
        "false",
        "no",
        "off",
    }


def yahoo_history_period() -> str:
    """Janela de backfill Yahoo (daily bars). Default 5y."""
    return (os.getenv("YAHOO_HISTORY_PERIOD", "5y") or "5y").strip()


def yahoo_batch_size() -> int:
    """Símbolos por chamada yf.download. Menor = mais educado com o throttle."""
    raw = os.getenv("YAHOO_BATCH_SIZE", "20").strip()
    try:
        return max(1, min(50, int(raw)))
    except ValueError:
        return 20


def yahoo_pause_sec() -> float:
    """Pausa entre lotes. Default 5s ≈ ritmo OSS yfinance (2 req / 5s)."""
    raw = os.getenv("YAHOO_PAUSE_SEC", "5").strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 5.0


def yahoo_refresh_hours() -> float:
    """Não re-baixa se o snapshot Yahoo ainda está fresco. Default 48h (2 dias)."""
    raw = os.getenv(
        "YAHOO_REFRESH_HOURS",
        os.getenv("BRAPI_CACHE_TTL_HOURS", "48"),
    ).strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 48.0


def yahoo_max_retries() -> int:
    raw = os.getenv("YAHOO_MAX_RETRIES", "4").strip()
    try:
        return max(1, min(8, int(raw)))
    except ValueError:
        return 4
