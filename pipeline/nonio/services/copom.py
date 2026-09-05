"""Atas do Copom (BCB) — metadados + PDF.

API: /api/servico/sitebcb/copom/atas
PDF: /content/copom/atascopom/Copom{N}-not{YYYYMMDD}{N}.pdf
     (dataReferencia, nao dataPublicacao — medido via reconhecimento.md)

Idempotente: nao re-baixa PDF se ja existe. Index parquet merge por nro_reuniao.
LLM/extracao fica para depois (llm.py).
"""

from __future__ import annotations

import time
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path

import polars as pl
import requests

from nonio.config import RAIZ
from nonio.services import cache

LIST_URL = "https://www.bcb.gov.br/api/servico/sitebcb/copom/atas"
PDF_BASE = "https://www.bcb.gov.br/content/copom/atascopom"
COPOM_DIR = RAIZ / "data" / "parquet" / "copom"
PDF_DIR = RAIZ / "data" / "raw" / "copom"


@dataclass(frozen=True)
class AtaCopom:
    nro_reuniao: int
    data_referencia: date
    data_publicacao: date | None
    titulo: str | None
    pdf_url: str
    pdf_path: str | None
    bytes: int | None


def _parse_day(raw: str | None) -> date | None:
    if not raw:
        return None
    return datetime.strptime(raw[:10], "%Y-%m-%d").date()


def pdf_url_for(nro: int, data_referencia: date) -> str:
    stamp = data_referencia.strftime("%Y%m%d")
    return f"{PDF_BASE}/Copom{nro}-not{stamp}{nro}.pdf"


def list_atas(*, quantidade: int = 500, force: bool = False) -> list[dict]:
    params = {"quantidade": str(quantidade)}
    payload = None if force else cache.read("copom", LIST_URL, params)
    if payload is None:
        r = requests.get(LIST_URL, params=params, timeout=60)
        r.raise_for_status()
        payload = r.json()
        cache.write("copom", LIST_URL, params, payload)
    return list(payload.get("conteudo") or [])


def download_pdf(url: str, dest: Path, *, force: bool = False) -> tuple[Path, int]:
    if dest.exists() and not force:
        return dest, dest.stat().st_size
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)
    return dest, len(r.content)


def sync(*, quantidade: int = 500, download: bool = True, force: bool = False) -> Path:
    rows_meta = list_atas(quantidade=quantidade, force=force)
    atas: list[AtaCopom] = []
    for row in rows_meta:
        nro = int(row["nroReuniao"])
        ref = _parse_day(row.get("dataReferencia"))
        if ref is None:
            continue
        url = pdf_url_for(nro, ref)
        pdf_path: str | None = None
        nbytes: int | None = None
        if download:
            dest = PDF_DIR / f"Copom{nro}.pdf"
            try:
                path, nbytes = download_pdf(url, dest, force=force)
                pdf_path = str(path)
                print(f"  copom {nro}: {nbytes} bytes", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"  copom {nro} PDF FALHOU: {exc}", flush=True)
            time.sleep(0.3)
        atas.append(
            AtaCopom(
                nro_reuniao=nro,
                data_referencia=ref,
                data_publicacao=_parse_day(row.get("dataPublicacao")),
                titulo=row.get("titulo"),
                pdf_url=url,
                pdf_path=pdf_path,
                bytes=nbytes,
            )
        )

    COPOM_DIR.mkdir(parents=True, exist_ok=True)
    path = COPOM_DIR / "atas.parquet"
    df = pl.DataFrame([asdict(a) for a in atas])
    if path.exists() and df.height:
        old = pl.read_parquet(path)
        df = (
            pl.concat([old, df], how="diagonal_relaxed")
            .unique(subset=["nro_reuniao"], keep="last")
            .sort("nro_reuniao")
        )
    df.write_parquet(path)
    print(f"  copom index: {df.height} atas -> {path}", flush=True)
    return path
