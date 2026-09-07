#!/usr/bin/env bash
# Captura as respostas do FastAPI e as publica como arquivo estático.
#
# Por que existe: /acoes e /copom leem parquet e devolvem JSON. Nada ali é
# calculado por requisição — o modelo é retreinado no pipeline, o Copom se reúne
# oito vezes por ano. Manter um servidor de pé para servir arquivo estático
# custa hospedagem e adiciona um ponto de falha no palco.
#
# Este script sobe o backend, captura a resposta REAL (mesmo formato, mesmo
# contrato) e grava em web/src/data/. O Next empacota, a Vercel publica, e
# `NONIO_API_URL` fica vazia — o servico.ts então usa o caminho local.
#
#   ./scripts/publicar-api.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORTA=${PORTA:-8071}
SAIDA=web/src/data
export AUTH_SECRET="publicacao-$(openssl rand -hex 24)"

echo "▸ subindo o backend em :$PORTA"
( cd backend && uv run uvicorn app.main:app --port "$PORTA" --host 127.0.0.1 ) > /tmp/publicar-api.log 2>&1 &
API=$!
trap 'kill $API 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:$PORTA/health" && break || sleep 1
done
curl -sf -o /dev/null "http://127.0.0.1:$PORTA/health" || { echo "✗ backend não subiu"; tail -20 /tmp/publicar-api.log; exit 1; }

TOKEN=$(cd backend && uv run python -c "
import jwt, time, os
print(jwt.encode({'sub':'publicador','email':'pipeline@nonio','name':'Publicador',
                  'iss':'nonio-web','aud':'nonio-api',
                  'iat':int(time.time()),'exp':int(time.time())+900},
                 os.environ['AUTH_SECRET'], algorithm='HS256'))")

pega() { curl -sf --max-time 120 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORTA$1"; }

echo "▸ /acoes"
pega /acoes > "$SAIDA/acoes.json"

echo "▸ /copom (todas as páginas)"
python3 - "$SAIDA/copom.json" <<PY
import json, subprocess, sys
def busca(pagina):
    r = subprocess.run(["curl","-sf","--max-time","120","-H","Authorization: Bearer $TOKEN",
                        f"http://127.0.0.1:$PORTA/copom?page={pagina}&page_size=100"],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)
primeira = busca(1)
itens = list(primeira.get("items", []))
total = primeira.get("total", len(itens))
p = 2
while len(itens) < total:
    lote = busca(p).get("items", [])
    if not lote: break
    itens += lote; p += 1
primeira["items"] = itens
primeira["page"] = 1
primeira["page_size"] = len(itens)
json.dump(primeira, open(sys.argv[1], "w"), ensure_ascii=False, indent=2, default=str)
print(f"  {len(itens)} de {total} reuniões")
PY

echo
for f in "$SAIDA/acoes.json" "$SAIDA/copom.json"; do
  echo "  $(basename "$f")  $(du -h "$f" | cut -f1)"
done
echo "▸ pronto — NONIO_API_URL pode ficar vazia"
