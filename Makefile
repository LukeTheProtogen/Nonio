.PHONY: dados consenso backtest prever conformidade dev

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

dev:
	cd web && npm run dev
