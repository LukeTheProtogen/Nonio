.PHONY: dados consenso prever dev

dados:
	cd pipeline && uv run python -m nonio.ingest
	cd pipeline && uv run python -m nonio.consenso

consenso:
	cd pipeline && uv run python -m nonio.consenso

prever:
	cd pipeline && uv run python -m nonio.prever

dev:
	cd web && npm run dev
