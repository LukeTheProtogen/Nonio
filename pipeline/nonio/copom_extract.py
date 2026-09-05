"""Extração estruturada das atas do Copom via Claude Sonnet.

Passo 1 (este módulo): JSON Schema / features para o LightGBM.
Passo 2 (depois): narrativa com citations — incompatível na mesma request.

Modelo fixo: claude-sonnet-5 (medido: Haiku inventou magnitude; Sonnet não).
"""

from __future__ import annotations

import base64
import json
import os
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import polars as pl
from pydantic import BaseModel

from nonio.config import RAIZ

PDF_DIR = RAIZ / "data" / "raw" / "copom"
OUT_DIR = RAIZ / "data" / "parquet" / "copom" / "extract"
FEATURES_PATH = RAIZ / "data" / "parquet" / "copom" / "features.parquet"
ATAS_INDEX = RAIZ / "data" / "parquet" / "copom" / "atas.parquet"

MODELO_PADRAO = "claude-sonnet-5"
PROMPT = """Extraia da ata do Copom anexa APENAS o que está escrito no documento.

Regras:
- Não invente a taxa Selic anterior nem a magnitude do corte/alta se a ata não disser.
- Números ausentes: use null.
- decisao: exatamente reduzir | manter | elevar | indefinido
- tons (tom_politica, tom_inflacao, tom_atividade): exatamente dovish | neutro | hawkish | indefinido
- Datas preferencialmente YYYY-MM-DD.
"""


class ExtratoCopom(BaseModel):
    """Features estruturadas — entrada do modelo no dia 2.

    Schema enxuto: a API rejeita schemas 'too complex' (enums/optionals demais).
    """

    nro_reuniao: int
    datas_reuniao: str
    data_referencia: str | None = None
    decisao: str  # reduzir|manter|elevar|indefinido
    selic_meta_aa: float | None = None
    delta_pp: float | None = None
    unanimidade: bool | None = None
    n_votantes: int | None = None
    tom_politica: str  # dovish|neutro|hawkish|indefinido
    tom_inflacao: str
    tom_atividade: str
    expectativas_acima_meta: bool | None = None
    risco_alta_dominante: bool | None = None
    menciona_geopolitica: bool
    menciona_fiscal: bool
    guidance_restritivo: bool | None = None
    focus_ipca_ano_corrente: float | None = None
    focus_ipca_ano_seguinte: float | None = None
    projecao_copom_horizonte: float | None = None
    resumo: str


def modelo_copom() -> str:
    return (
        os.getenv("COPOM_LLM_MODELO")
        or os.getenv("LLM_MODELO")
        or MODELO_PADRAO
    ).strip()


def _cliente():
    import anthropic

    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY ausente no .env")
    return anthropic.Anthropic()


def list_pdf_nros() -> list[int]:
    if not PDF_DIR.exists():
        return []
    out: list[int] = []
    for p in PDF_DIR.glob("Copom*.pdf"):
        try:
            out.append(int(p.stem.replace("Copom", "")))
        except ValueError:
            continue
    return sorted(out)


def pdf_path(nro: int) -> Path:
    return PDF_DIR / f"Copom{nro}.pdf"


def extract_path(nro: int) -> Path:
    return OUT_DIR / f"Copom{nro}.json"


def ja_extraido(nro: int) -> bool:
    p = extract_path(nro)
    if not p.exists():
        return False
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return bool(data.get("features")) and data.get("modelo") == modelo_copom()
    except Exception:
        return False


def extrair_um(nro: int, *, force: bool = False) -> dict[str, Any]:
    """Extrai features de uma ata. Idempotente se JSON já existe (mesmo modelo)."""
    if not force and ja_extraido(nro):
        return json.loads(extract_path(nro).read_text(encoding="utf-8"))

    path = pdf_path(nro)
    if not path.exists():
        raise FileNotFoundError(path)

    pdf_b64 = base64.standard_b64encode(path.read_bytes()).decode()
    extracted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    t0 = time.perf_counter()

    client = _cliente()
    parsed = client.messages.parse(
        model=modelo_copom(),
        max_tokens=2500,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                        "title": f"Ata Copom {nro}",
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
        output_format=ExtratoCopom,
    )
    feat: ExtratoCopom = parsed.parsed_output
    if feat is None:
        raise RuntimeError(f"Copom {nro}: parsed_output vazio (stop={parsed.stop_reason})")

    # Garante o número da reunião do arquivo se o modelo errar o id
    if feat.nro_reuniao != nro:
        feat = feat.model_copy(update={"nro_reuniao": nro})

    usage = {
        "input": getattr(parsed.usage, "input_tokens", None),
        "output": getattr(parsed.usage, "output_tokens", None),
    }
    payload = {
        "nro_reuniao": nro,
        "modelo": modelo_copom(),
        "extracted_at": extracted_at.isoformat(timespec="seconds"),
        "seconds": round(time.perf_counter() - t0, 2),
        "stop_reason": parsed.stop_reason,
        "usage": usage,
        "pdf": str(path),
        "features": feat.model_dump(mode="json"),
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    extract_path(nro).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return payload


def _row_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    f = payload["features"]
    decisao = f.get("decisao")
    signed = {"reduzir": -1, "manter": 0, "elevar": 1}.get(decisao, 0)
    tom_map = {"dovish": -1, "neutro": 0, "hawkish": 1, "indefinido": 0}

    def tom(k: str) -> int:
        return tom_map.get(f.get(k) or "indefinido", 0)

    return {
        "nro_reuniao": int(payload["nro_reuniao"]),
        "modelo": payload.get("modelo"),
        "extracted_at": datetime.fromisoformat(payload["extracted_at"]),
        "decisao": decisao,
        "decisao_signed": signed,
        "selic_meta_aa": f.get("selic_meta_aa"),
        "delta_pp": f.get("delta_pp"),
        "unanimidade": f.get("unanimidade"),
        "n_votantes": f.get("n_votantes"),
        "tom_politica": tom("tom_politica"),
        "tom_inflacao": tom("tom_inflacao"),
        "tom_atividade": tom("tom_atividade"),
        "expectativas_acima_meta": f.get("expectativas_acima_meta"),
        "risco_alta_dominante": f.get("risco_alta_dominante"),
        "menciona_geopolitica": bool(f.get("menciona_geopolitica")),
        "menciona_fiscal": bool(f.get("menciona_fiscal")),
        "guidance_restritivo": f.get("guidance_restritivo"),
        "focus_ipca_ano_corrente": f.get("focus_ipca_ano_corrente"),
        "focus_ipca_ano_seguinte": f.get("focus_ipca_ano_seguinte"),
        "projecao_copom_horizonte": f.get("projecao_copom_horizonte"),
        "resumo": f.get("resumo"),
        "datas_reuniao": f.get("datas_reuniao"),
        "data_referencia": f.get("data_referencia"),
        "input_tokens": (payload.get("usage") or {}).get("input"),
        "output_tokens": (payload.get("usage") or {}).get("output"),
        "seconds": payload.get("seconds"),
    }


def rebuild_features_parquet() -> Path:
    rows: list[dict[str, Any]] = []
    if OUT_DIR.exists():
        for p in sorted(OUT_DIR.glob("Copom*.json")):
            try:
                rows.append(_row_from_payload(json.loads(p.read_text(encoding="utf-8"))))
            except Exception as exc:  # noqa: BLE001
                print(f"  skip {p.name}: {exc}", flush=True)
    FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        pl.DataFrame().write_parquet(FEATURES_PATH)
    else:
        pl.DataFrame(rows).sort("nro_reuniao").write_parquet(FEATURES_PATH)
    return FEATURES_PATH


def sync(
    *,
    nros: list[int] | None = None,
    limit: int | None = None,
    force: bool = False,
    pause_sec: float | None = None,
) -> Path:
    """Extrai atas (Sonnet). Default: as mais recentes com PDF."""
    pause = pause_sec
    if pause is None:
        raw = os.getenv("COPOM_LLM_PAUSE_SEC", "1").strip()
        try:
            pause = max(0.0, float(raw))
        except ValueError:
            pause = 1.0

    if nros is None:
        nros = list_pdf_nros()
        # Preferir as mais recentes se limit
        nros = sorted(nros, reverse=True)
    if limit is not None:
        nros = nros[: max(0, limit)]

    print(
        f"copom-llm modelo={modelo_copom()} n={len(nros)} force={force}",
        flush=True,
    )
    ok = skip = fail = 0
    for i, nro in enumerate(nros, 1):
        if not force and ja_extraido(nro):
            skip += 1
            print(f"  [{i}/{len(nros)}] Copom{nro} skip", flush=True)
            continue
        try:
            payload = extrair_um(nro, force=force)
            f = payload["features"]
            ok += 1
            print(
                f"  [{i}/{len(nros)}] Copom{nro} "
                f"{f.get('decisao')} selic={f.get('selic_meta_aa')} "
                f"delta={f.get('delta_pp')} "
                f"{payload['seconds']}s "
                f"in={payload['usage'].get('input')} out={payload['usage'].get('output')}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            fail += 1
            print(f"  [{i}/{len(nros)}] Copom{nro} FALHOU: {exc}", flush=True)
        if pause and i < len(nros):
            time.sleep(pause)

    path = rebuild_features_parquet()
    print(f"copom-llm fim: ok={ok} skip={skip} fail={fail} -> {path}", flush=True)
    return path


def main() -> None:
    force = os.getenv("CRON_FORCE", "").strip().lower() in {"1", "true", "yes"}
    limit_raw = os.getenv("COPOM_LLM_LIMIT", "").strip()
    limit = int(limit_raw) if limit_raw else None
    nros_raw = os.getenv("COPOM_LLM_NROS", "").strip()
    nros = [int(x) for x in nros_raw.split(",") if x.strip()] or None
    sync(nros=nros, limit=limit, force=force)


if __name__ == "__main__":
    main()
