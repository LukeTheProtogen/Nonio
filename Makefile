.PHONY: dados dev

dados:
	cd pipeline && uv run python -m nonio.ingest

dev:
	cd web && npm run dev
