from collections.abc import AsyncGenerator

from fastapi import Depends
from fastapi_users.db import (
    SQLAlchemyBaseOAuthAccountTableUUID,
    SQLAlchemyBaseUserTableUUID,
    SQLAlchemyUserDatabase,
)
from sqlalchemy import String, text
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
    # Plano da assinatura. NULO enquanto não houver cobrança — a tela mostra a
    # ausência em vez de inventar um nome de plano.
    #
    # Fora do UserUpdate de propósito: se entrasse lá, qualquer pessoa faria
    # PATCH /users/me e se promoveria para o plano que quisesse.
    plan: Mapped[str | None] = mapped_column(String(32), nullable=True)
    oauth_accounts: Mapped[list[OAuthAccount]] = relationship(
        "OAuthAccount", lazy="joined"
    )


engine = create_async_engine(settings.users_database_url)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


# Colunas acrescentadas depois que o banco já existia em alguma máquina.
#
# `create_all` só cria TABELA que falta; ele não mexe em tabela existente. Sem
# isto, quem já tinha users.sqlite continuaria sem a coluna e todo SELECT
# quebraria com "no such column" — em desenvolvimento, e só na máquina de quem
# já tinha rodado antes, que é o pior tipo de bug para reproduzir.
#
# Enquanto não houver Alembic, isto resolve, e é idempotente: SQLite recusa
# ADD COLUMN duplicado, e o erro é ignorado de propósito.
_COLUNAS_NOVAS = (("plan", "VARCHAR(32)"),)


async def create_auth_tables() -> None:
    settings.users_db_path.parent.mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(AuthBase.metadata.create_all)

        existentes = {
            linha[1]
            for linha in (await conn.execute(text("PRAGMA table_info(user)"))).fetchall()
        }
        for coluna, tipo in _COLUNAS_NOVAS:
            if coluna not in existentes:
                await conn.execute(text(f"ALTER TABLE user ADD COLUMN {coluna} {tipo}"))


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
):
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)
