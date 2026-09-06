from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.auth import (
    auth_backend,
    create_auth_tables,
    fastapi_users,
    google_oauth_client,
)
from app.auth.schemas import UserCreate, UserRead, UserUpdate
from app.config import settings
from app.db.session import init_db
from app.routers import copom, health, stocks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    await create_auth_tables()
    yield


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(stocks.router)
app.include_router(copom.router)

app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix="/auth/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix="/auth",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)
app.include_router(
    fastapi_users.get_oauth_router(
        google_oauth_client,
        auth_backend,
        settings.auth_secret,
        associate_by_email=True,
        is_verified_by_default=True,
        csrf_token_cookie_secure=settings.oauth_csrf_cookie_secure,
    ),
    prefix="/auth/google",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_oauth_associate_router(
        google_oauth_client,
        UserRead,
        settings.auth_secret,
        csrf_token_cookie_secure=settings.oauth_csrf_cookie_secure,
    ),
    prefix="/auth/associate/google",
    tags=["auth"],
)
