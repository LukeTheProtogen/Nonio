"""Auth: JWT mintado pelo Next depois do Supabase Auth (BFF / Pattern A).

O browser nunca fala com a API. O Next valida a sessão Supabase, assina um JWT
curto (HS256) e manda `Authorization: Bearer …`. Sem esse token → 401.
"""

from __future__ import annotations

from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import settings

_bearer = HTTPBearer(auto_error=False)

ISSUER = "nonio-web"
AUDIENCE = "nonio-api"


class ApiUser(BaseModel):
    sub: str
    email: str | None = None
    name: str | None = None


def require_nextauth_user(
    creds: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ] = None,
) -> ApiUser:
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload: dict[str, Any] = jwt.decode(
            creds.credentials,
            settings.auth_secret,
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("email")
    name = payload.get("name")
    return ApiUser(
        sub=sub,
        email=email if isinstance(email, str) else None,
        name=name if isinstance(name, str) else None,
    )
