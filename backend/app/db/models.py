from datetime import date, datetime

from sqlalchemy import Date, DateTime, Double, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Stock(Base):
    """Lookup sempre atual — uma linha por code (não é histórico).

    Histórico fica no Parquet. `niche` = industry da brapi. Sem CNPJ.
    """

    __tablename__ = "stocks"
    __table_args__ = (UniqueConstraint("code", name="uq_stocks_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    extracted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    niche: Mapped[str | None] = mapped_column(String(256), nullable=True, index=True)
    company_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    quote: Mapped[float | None] = mapped_column(Double, nullable=True)
    pct_change: Mapped[float | None] = mapped_column(Double, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Double, nullable=True)
    volume: Mapped[float | None] = mapped_column(Double, nullable=True)
    previous_close: Mapped[float | None] = mapped_column(Double, nullable=True)
    fifty_two_week_low: Mapped[float | None] = mapped_column(Double, nullable=True)
    fifty_two_week_high: Mapped[float | None] = mapped_column(Double, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pe: Mapped[float | None] = mapped_column(Double, nullable=True)
    eps: Mapped[float | None] = mapped_column(Double, nullable=True)


class Preview(Base):
    """Preview externa (brapi analyst targets) e, depois, a nossa.

    Comparável no app: source=brapi vs source=nonio para o mesmo code.
    """

    __tablename__ = "previews"
    __table_args__ = (
        UniqueConstraint("source", "code", "as_of", name="uq_previews_source_code_as_of"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    as_of: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    extracted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    target_mean: Mapped[float | None] = mapped_column(Double, nullable=True)
    target_median: Mapped[float | None] = mapped_column(Double, nullable=True)
    target_high: Mapped[float | None] = mapped_column(Double, nullable=True)
    target_low: Mapped[float | None] = mapped_column(Double, nullable=True)
    recommendation_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    recommendation_mean: Mapped[float | None] = mapped_column(Double, nullable=True)
    n_opinions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Nosso modelo (quando houver): probabilidade de bater o CDI etc.
    probabilidade: Mapped[float | None] = mapped_column(Double, nullable=True)
    horizonte_meses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preco_referencia: Mapped[float | None] = mapped_column(Double, nullable=True)
    modelo_versao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)


class Log(Base):
    """Auditoria — base do endpoint de history."""

    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True)
