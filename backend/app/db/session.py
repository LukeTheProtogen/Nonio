from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db.models import Base

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db(*, reset: bool = False) -> None:
    settings.parquet_root.mkdir(parents=True, exist_ok=True)
    db_path = settings.database_url.removeprefix("duckdb:///")
    if db_path and db_path != ":memory:":
        path = Path(db_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if reset and path.exists():
            engine.dispose()
            path.unlink(missing_ok=True)
            wal = Path(str(path) + ".wal")
            wal.unlink(missing_ok=True)
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
