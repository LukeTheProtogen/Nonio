from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

RAIZ = Path(__file__).resolve().parents[2]

_AUTH_SECRET_FRACO = "CHANGE-ME-dev-only-use-openssl-rand-hex-32"


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

    # Contas: Supabase Auth no Next (não SQLite / não DuckDB).
    # AUTH_SECRET assina o JWT curto que a FastAPI verifica.
    users_db_path: Path = RAIZ / "data" / "users.sqlite"  # legado; não usado pelo login
    auth_secret: str = Field(
        ...,
        min_length=32,
        description="Segredo compartilhado com Next (API access JWT). Sem default fraco.",
    )
    jwt_lifetime_seconds: int = 60 * 60 * 24 * 7  # 7 dias
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    # Dev local sem HTTPS: cookie CSRF do OAuth precisa viajar.
    oauth_csrf_cookie_secure: bool = False

    @field_validator("auth_secret")
    @classmethod
    def auth_secret_nao_fraco(cls, value: str) -> str:
        secret = value.strip()
        if not secret or secret == _AUTH_SECRET_FRACO:
            raise ValueError(
                "AUTH_SECRET ausente ou ainda é o placeholder de desenvolvimento. "
                "Gere um valor forte (ex.: openssl rand -base64 32) e coloque no .env."
            )
        return secret

    @property
    def users_database_url(self) -> str:
        path = self.users_db_path.resolve().as_posix()
        return f"sqlite+aiosqlite:///{path}"


settings = Settings()
