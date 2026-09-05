.PHONY: dados prever dev

dados:
	cd pipeline && uv run python -m nonio.ingest

prever:
	cd pipeline && uv run python -m nonio.prever

dev:
	cd web && npm run dev
