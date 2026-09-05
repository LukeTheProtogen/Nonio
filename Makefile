.PHONY: dados consenso backtest prever conformidade cron api dev copom-llm treino experimentos

dados:
	cd pipeline && uv run python -m nonio.ingest
	cd pipeline && uv run python -m nonio.consenso

consenso:
	cd pipeline && uv run python -m nonio.consenso

backtest:
	cd pipeline && uv run python -m nonio.backtest

prever:
	cd pipeline && uv run python -m nonio.prever

conformidade:
	cd web && node scripts/conformidade.mjs

# Extração Copom (Sonnet, structured). Ex.: COPOM_LLM_LIMIT=3 make copom-llm
copom-llm:
	cd pipeline && uv run python -m nonio.copom_extract

# Fontes: CRON_SOURCES=sgs,brapi,yahoo,b3,copom (default todas)
# Histórico 5y: CRON_SOURCES=yahoo make cron
cron:
	cd pipeline && uv run python -m nonio.cron

# LightGBM P(bater CDI) — lê parquet, grava data/models + previews
treino:
	cd pipeline && uv run python -m nonio.train

# Varredura horizonte × features × universo (~1–2 min)
experimentos:
	cd pipeline && uv run python -m nonio.train.experiments

api:
	cd backend && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

dev:
	cd web && npm run dev
