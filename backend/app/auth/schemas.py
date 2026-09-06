import uuid

from fastapi_users import schemas
from pydantic import Field


class UserRead(schemas.BaseUser[uuid.UUID]):
    name: str
    avatar_url: str | None = None
    # Nulo enquanto não houver cobrança. O front mostra a ausência.
    plan: str | None = None


class UserCreate(schemas.BaseUserCreate):
    name: str = Field(min_length=1, max_length=255)
    avatar_url: str | None = None


class UserUpdate(schemas.BaseUserUpdate):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    avatar_url: str | None = None
