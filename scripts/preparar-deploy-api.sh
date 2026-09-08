#!/usr/bin/env bash
# Copia os parquets que a API lê para dentro de backend/, que é o Root Directory
# do projeto Python na Vercel.
#
# Por que a cópia existe: data/parquet/ é a fonte (o pipeline escreve lá, veja
# pipeline/nonio/train/publish_lowvol.py) e está no .gitignore. A Vercel só
# empacota o que está sob o Root Directory e vem do git — então backend/dados/
# é versionado. Rode isto sempre que o modelo for retreinado, antes do deploy.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEM="$RAIZ/data/parquet"
DESTINO="$RAIZ/backend/dados/parquet"

[ -d "$ORIGEM" ] || { echo "erro: $ORIGEM não existe — instale o handoff de dados primeiro." >&2; exit 1; }

mkdir -p "$DESTINO"
rsync -a --delete \
  --include='*/' \
  --include='*.parquet' \
  --exclude='*' \
  "$ORIGEM/" "$DESTINO/"

echo "  origem : $(du -sh "$ORIGEM" | cut -f1)"
echo "  destino: $(du -sh "$DESTINO" | cut -f1)  ($(find "$DESTINO" -name '*.parquet' | wc -l | tr -d ' ') arquivos)"
echo
echo "  falta commitar backend/dados/ e fazer o deploy."
