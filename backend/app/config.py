from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(RAIZ / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = f"duckdb:///{(RAIZ / 'data' / 'nonio.duckdb').as_posix()}"
    parquet_root: Path = RAIZ / "data" / "parquet"
    api_title: str = "Nônio API"
    api_version: str = "0.1.0"


settings = Settings()
