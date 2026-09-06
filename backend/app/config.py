from pathlib import Path

from pydantic import Field
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

    # Contas (fastapi-users) — SQLite separado do DuckDB analítico.
    users_db_path: Path = RAIZ / "data" / "users.sqlite"
    auth_secret: str = Field(
        default="CHANGE-ME-dev-only-use-openssl-rand-hex-32",
        description="Segredo JWT / tokens de reset e verify",
    )
    jwt_lifetime_seconds: int = 60 * 60 * 24 * 7  # 7 dias
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    # Dev local sem HTTPS: cookie CSRF do OAuth precisa viajar.
    oauth_csrf_cookie_secure: bool = False

    @property
    def users_database_url(self) -> str:
        path = self.users_db_path.resolve().as_posix()
        return f"sqlite+aiosqlite:///{path}"


settings = Settings()
