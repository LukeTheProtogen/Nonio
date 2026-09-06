from collections.abc import AsyncGenerator

from fastapi import Depends
from fastapi_users.db import (
    SQLAlchemyBaseOAuthAccountTableUUID,
    SQLAlchemyBaseUserTableUUID,
    SQLAlchemyUserDatabase,
)
from sqlalchemy import String, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.config import settings


class AuthBase(DeclarativeBase):
    pass


class OAuthAccount(SQLAlchemyBaseOAuthAccountTableUUID, AuthBase):
    pass


class User(SQLAlchemyBaseUserTableUUID, AuthBase):
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # "password" | "google" — um e-mail, um jeito de entrar. Não misturamos.
    auth_via: Mapped[str] = mapped_column(
        String(16), nullable=False, default="password", server_default="password"
    )
    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined"
    )


engine = create_async_engine(settings.users_database_url)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


def _ensure_auth_via_column(sync_conn) -> None:
    cols = {c["name"] for c in inspect(sync_conn).get_columns("user")}
    if "auth_via" in cols:
        return
    sync_conn.execute(
        text(
            "ALTER TABLE user ADD COLUMN auth_via VARCHAR(16) "
            "NOT NULL DEFAULT 'password'"
        )
    )


async def create_auth_tables() -> None:
    settings.users_db_path.parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(AuthBase.metadata.create_all)
        await conn.run_sync(_ensure_auth_via_column)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
):
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)
