# Deploy da API na Vercel (Python Function)

Testado localmente em 06/09/2026 com as dependências enxutas: `/health` 200,
`/acoes` 401 sem token e 200 com token (20 papéis, cdi12m 14,62),
`/copom` 200 (81 reuniões com extração de ata).

## O que foi montado

| arquivo | papel |
|---|---|
| `app/vercel.py` | entrypoint da Vercel — sem `lifespan`, sem router `stocks` |
| `pyproject.toml` | `dependencies` enxutas + extra `local` + `[tool.vercel] entrypoint` |
| `vercel.json` | `excludeFiles` para o bundle |
| `dados/parquet/` | cópia versionada do `data/parquet` (7,1 MB) |
| `../scripts/preparar-deploy-api.sh` | ressincroniza essa cópia |

`app/main.py` continua intacto: é o caminho de desenvolvimento local e o que
EC2/EKS usariam (veja `HANDOFF-AWS.md` na raiz).

## Por que um entrypoint separado

Três coisas do `main.py` não sobrevivem no serverless:

1. **`lifespan` → `init_db()` → `create_all()`** escreve em disco a cada boot.
   Na Vercel o filesystem é somente-leitura fora de `/tmp`.
2. **Router `stocks`** é o único que usa SQLAlchemy + DuckDB. Nenhuma tela do
   front o chama, e as colunas que ele serviria (`company_name`, `niche`,
   `market_cap`) estão nulas em 275/275 linhas do `nonio.duckdb`.
3. **`parquet_root` default** é `parents[2]` do `config.py`, ou seja a raiz do
   repositório. Com Root Directory `backend/`, apontaria para fora do bundle.
   O `vercel.py` fixa `PARQUET_ROOT` a partir do próprio arquivo, então não
   depende de cwd nem de variável de ambiente.

Sem o `[tool.vercel] entrypoint`, a Vercel autodetectaria `app/main.py` — é um
nome de entrypoint reconhecido — e subiria justamente a versão que quebra.

## Dois `__init__.py` que precisaram mudar

`app/auth/__init__.py` e `app/schemas/__init__.py` importavam o mundo
ansiosamente. `from app.auth.nextauth_gate import …` arrastava fastapi-users;
`from app.schemas.acoes import …` arrastava SQLAlchemy. Nenhum dos dois é usado
pelas rotas que vão ao ar.

Agora carregam sob demanda (PEP 562 num caso, `from __future__ import
annotations` no outro). **A API pública não mudou** — `from app.auth import
User` e `from app.schemas import stock_to_out` seguem funcionando; foi
verificado.

## Peso

| | |
|---|---|
| deps enxutas (medido no macOS) | **215 MB** |
| deps completas | 430 MB |
| `dados/parquet` | 7,1 MB |
| teto do bundle | **500 MB** |

A folga existe mas não é grande, e a medição é do wheel de macOS — no Linux
pode variar. Se estourar, o primeiro corte é `dados/parquet/stocks/` (7,0 MB dos
7,1 MB): `/acoes` só lê o histórico dos 20 papéis do universo, não dos 301.

## Ambiente local do time

**Uma mudança de comando.** As dependências pesadas saíram de `dependencies`:

```bash
cd backend && uv sync --extra local     # antes era só `uv sync`
```

Sem o `--extra local`, `app.main` não importa (falta SQLAlchemy) e não há
uvicorn. O `scripts/publicar-api.sh` depende disso.

## Passos do deploy

1. **Novo projeto** na Vercel, mesmo repositório, **Root Directory `backend`**.
   Não reaproveite o `nonio-websetup`: o Root Directory dele é `web`.
2. Variável de ambiente, em **Production, Preview e Development**:

   ```
   AUTH_SECRET=<o mesmo valor do projeto web>
   ```

   Tem que ser idêntico nos dois lados — o Next assina o JWT, a API verifica.
   Se divergir, toda rota responde 401.
3. Deploy. Confira sem token (deve dar 401, e isso é sinal de saúde):

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' "https://<api>.vercel.app/acoes"
   curl -s "https://<api>.vercel.app/health"
   ```

4. No projeto **web**, em todos os ambientes:

   ```
   NONIO_API_URL=https://<api>.vercel.app
   NONIO_RECURSOS_BACKEND=acoes,copom
   ```

   `NONIO_API_URL` é lida em execução (não é `NEXT_PUBLIC_`), então basta
   redeployar — não precisa rebuildar por causa dela.

## Rollback

Apagar `NONIO_API_URL` e redeployar. O `local.ts` volta a servir
`web/src/data/acoes.json` e `copom.json`, com os mesmos números — só
congelados na data da última publicação. Vale testar esse caminho **antes** de
depender do backend numa demo.

## Quando o modelo for retreinado

```bash
./scripts/preparar-deploy-api.sh     # data/parquet → backend/dados/parquet
git add backend/dados && git commit && git push
```

O deploy da API sai automático no push. Diferente do fluxo por arquivos, o
`publicar-api.sh` deixa de ser necessário para o site ficar atualizado.
