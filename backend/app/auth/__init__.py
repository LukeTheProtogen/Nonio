"""Reexports do auth legado (fastapi-users + OAuth do Google).

Carregamento preguiçoso (PEP 562). O `__init__` antes importava `app.auth.db`
e `app.auth.users` na hora, então qualquer `from app.auth.nextauth_gate import …`
— que é o auth de verdade, HS256 com o Next — arrastava fastapi-users,
SQLAlchemy e aiosqlite junto. No bundle da Vercel isso é peso morto: nada em
`app.auth.nextauth_gate` depende deles.

A API pública não mudou: `from app.auth import User` continua funcionando,
só que resolve na primeira leitura do atributo.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - só para o type checker
    from app.auth.db import User, create_auth_tables
    from app.auth.users import (
        auth_backend,
        current_active_user,
        fastapi_users,
        google_oauth_client,
    )

_ORIGEM = {
    "User": "app.auth.db",
    "create_auth_tables": "app.auth.db",
    "auth_backend": "app.auth.users",
    "current_active_user": "app.auth.users",
    "fastapi_users": "app.auth.users",
    "google_oauth_client": "app.auth.users",
}

__all__ = sorted(_ORIGEM)


def __getattr__(nome: str) -> Any:
    modulo = _ORIGEM.get(nome)
    if modulo is None:
        raise AttributeError(f"module {__name__!r} has no attribute {nome!r}")
    from importlib import import_module

    return getattr(import_module(modulo), nome)


def __dir__() -> list[str]:
    return __all__
