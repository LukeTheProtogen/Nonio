"""Entrypoint da Vercel — variante enxuta do `app.main`.

Três diferenças em relação ao `main.py`, todas obrigatórias no serverless:

1. **Sem `lifespan`.** O `init_db()` do `main.py` chama `create_all()`, que
   escreve em disco a cada boot. Na Vercel o filesystem é somente-leitura fora
   de `/tmp` — a função morreria na subida.

2. **Sem o router `stocks`.** É o único que usa SQLAlchemy + DuckDB, e nenhuma
   tela do front o chama. Cortá-lo tira ~230 MB de dependências do bundle, que
   tem teto de 500 MB.

3. **`PARQUET_ROOT` fixado a partir do próprio arquivo.** O default do
   `config.py` é `parents[2]`, relativo à raiz do repositório; aqui o Root
   Directory é `backend/`, então aquele caminho apontaria para fora do bundle.

O `main.py` segue intacto para o desenvolvimento local e para EC2/EKS.
"""

from __future__ import annotations

import os
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent

# Antes de importar app.config: settings é instanciado no import do módulo.
# setdefault, não sobrescrita — uma env na Vercel ainda tem a palavra final.
os.environ.setdefault("PARQUET_ROOT", str(_BACKEND / "dados" / "parquet"))

from fastapi import FastAPI  # noqa: E402

from app.config import settings  # noqa: E402
from app.routers import acoes, copom, health  # noqa: E402

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
)

app.include_router(health.router)
app.include_router(acoes.router)
app.include_router(copom.router)
