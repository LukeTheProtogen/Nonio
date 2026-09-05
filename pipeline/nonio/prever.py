"""Publica as previsões e mantém o registro append-only.

Não contém modelo: o baseline vive em `probabilidade.py` e as cotações em
`cotacoes.py`. Aqui só orquestra e escreve.

    uv run python -m nonio.prever
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

from . import cotacoes
from . import probabilidade as prob

RAIZ = Path(__file__).resolve().parents[2]
# A Vercel só sobe o Root Directory (web/). Dentro de src/ o JSON entra no
# bundle em tempo de build — e como cada rodada do pipeline dispara um deploy,
# o dado servido está sempre casado com a versão publicada.
PUBLICO = RAIZ / "web" / "src" / "data"
# O registro auditável fica na raiz, versionado pelo git — nunca reescrito.
HISTORICO = RAIZ / "data" / "snapshot" / "historico_previsoes.jsonl"

HORIZONTE_MESES = 12


def universo() -> list[str]:
    bruto = os.environ.get("NONIO_UNIVERSO", "")
    return [t.strip().upper() for t in bruto.split(",") if t.strip()] or cotacoes.LIVRES


def main() -> None:
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    tickers = universo()

    hist = cotacoes.historico(tickers)
    atual = {r["ticker"]: r for r in cotacoes.atual(tickers).to_dicts()}

    previsoes = []
    for t in tickers:
        fech = hist.filter(pl.col("ticker") == t)["fechamento"]
        c = atual.get(t)
        if len(fech) < 60 or not c or c.get("preco") is None:
            print(f"  {t:<8} histórico ou cotação insuficiente — pulado")
            continue

        vol = prob.volatilidade(fech)
        previsoes.append({
            "ticker": t,
            "probabilidade": round(prob.prob_bater_cdi(vol), 4),
            "horizonte_meses": HORIZONTE_MESES,
            # Sem este campo não existe delta: é o preço no instante do cálculo.
            "preco_referencia": c["preco"],
            "vol_anual": round(vol, 4),
            # Limiar POR ATIVO, publicado junto. Assim a interface não recalcula
            # nada — compara com o número que o pipeline decidiu, e as duas
            # pontas não podem discordar.
            "limiar_recalculo": round(prob.limiar_recalculo(vol), 4),
            "calculado_em": agora.isoformat(),
            "modelo_versao": prob.MODELO,
            "gatilho": os.environ.get("NONIO_GATILHO", "agendado"),
        })
        p = previsoes[-1]
        print(f"  {t:<8} p={p['probabilidade']:.3f}  vol={vol:.1%}  "
              f"limiar={p['limiar_recalculo']:.2%}  ref=R$ {c['preco']:.2f}")

    if not previsoes:
        raise SystemExit("nenhuma previsão gerada — abortando sem escrever nada")

    PUBLICO.mkdir(parents=True, exist_ok=True)
    (PUBLICO / "previsoes.json").write_text(
        json.dumps({"geradoEm": agora.isoformat(),
                    "modeloVersao": prob.MODELO,
                    "toleranciaPp": prob.TOLERANCIA_PP,
                    "previsoes": previsoes}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")

    HISTORICO.parent.mkdir(parents=True, exist_ok=True)
    with HISTORICO.open("a", encoding="utf-8") as f:
        for p in previsoes:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    print(f"\n  publicado : {PUBLICO / 'previsoes.json'}")
    print(f"  histórico : {HISTORICO} (+{len(previsoes)} linhas)")


if __name__ == "__main__":
    main()
