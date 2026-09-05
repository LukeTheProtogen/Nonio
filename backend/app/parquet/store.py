from pathlib import Path

import polars as pl

from app.config import settings
from app.parquet.schema import empty_history, validate_history


class ParquetStore:
    """Armazena series por stock. write e merge idempotente por date."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root or settings.parquet_root)

    def stock_dir(self, code: str) -> Path:
        return self.root / "stocks" / code.strip().upper()

    def history_path(self, code: str) -> Path:
        return self.stock_dir(code) / "history.parquet"

    def has_history(self, code: str) -> bool:
        return self.history_path(code).exists()

    def write_history(self, code: str, df: pl.DataFrame, *, merge: bool = True) -> Path:
        path = self.history_path(code)
        path.parent.mkdir(parents=True, exist_ok=True)
        incoming = validate_history(df)
        if merge and path.exists():
            existing = validate_history(pl.read_parquet(path))
            incoming = (
                pl.concat([existing, incoming], how="vertical_relaxed")
                .unique(subset=["date"], keep="last")
                .sort("date")
            )
        incoming.write_parquet(path)
        return path

    def read_history(self, code: str) -> pl.DataFrame:
        path = self.history_path(code)
        if not path.exists():
            return empty_history()
        return validate_history(pl.read_parquet(path))

    def list_codes(self) -> list[str]:
        stocks = self.root / "stocks"
        if not stocks.exists():
            return []
        return sorted(p.name for p in stocks.iterdir() if p.is_dir())


store = ParquetStore()
