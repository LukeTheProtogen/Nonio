from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.db.session import init_db
from app.routers import copom, health, stocks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(copom.router)

# Contas: Supabase Auth no Next. A API só verifica o JWT curto (AUTH_SECRET).
