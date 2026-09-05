.PHONY: dados consenso backtest prever dev

dados:
	cd pipeline && uv run python -m nonio.ingest
	cd pipeline && uv run python -m nonio.consenso

consenso:
	cd pipeline && uv run python -m nonio.consenso

backtest:
	cd pipeline && uv run python -m nonio.backtest

prever:
	cd pipeline && uv run python -m nonio.prever

dev:
	cd web && npm run dev
