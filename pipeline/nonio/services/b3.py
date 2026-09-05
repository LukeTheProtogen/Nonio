"""B3 listados — cadastro de empresas (proxy publico listados).

GetInitialCompanies (paginado) + GetDetail (por codeCVM).
Sem autenticação oficial; User-Agent de browser. Cache + parquet idempotente.
"""

from __future__ import annotations

import base64
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import polars as pl
import requests

from nonio.config import RAIZ
from nonio.services import cache

BASE = (
    "https://sistemaswebb3-listados.b3.com.br/"
    "listedCompaniesProxy/CompanyCall"
)
B3_DIR = RAIZ / "data" / "parquet" / "b3"
PAGE_SIZE = 120


@dataclass(frozen=True)
class B3Company:
    code_cvm: str
    issuing_company: str | None
    company_name: str | None
    trading_name: str | None
    cnpj: str | None
    segment: str | None
    status: str | None
    market_indicator: str | None
    industry_classification: str | None
    activity: str | None
    website: str | None


class B3Error(RuntimeError):
    pass


def _b64(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    return base64.b64encode(raw).decode("ascii")


def _get(path: str, payload: dict, *, force: bool = False) -> dict | list | str:
    token = _b64(payload)
    url = f"{BASE}/{path}/{token}"
    # cache key sem o token gigante — usa path+payload
    key_url = f"{BASE}/{path}"
    params = {"q": json.dumps(payload, sort_keys=True)}
    hit = None if force else cache.read("b3", key_url, params)
    if hit is not None:
        return hit
    r = requests.get(
        url,
        headers={
            "Accept": "application/json, text/plain, */*",
            "User-Agent": (
                "Mozilla/5.0 (compatible; NonioBot/0.1; +https://github.com/nonio)"
            ),
        },
        timeout=90,
    )
    if not r.ok:
        raise B3Error(f"B3 {path} HTTP {r.status_code}: {r.text[:200]}")
    text = r.text.strip()
    if not text:
        data: dict | list | str = {}
    else:
        try:
            data = r.json()
        except ValueError:
            data = text
    cache.write("b3", key_url, params, data)
    return data


def fetch_listings(*, force: bool = False) -> list[dict]:
    """Todas as empresas do GetInitialCompanies (paginado)."""
    page = 1
    rows: list[dict] = []
    total_pages = 1
    while page <= total_pages:
        data = _get(
            "GetInitialCompanies",
            {"language": "pt-br", "pageNumber": page, "pageSize": PAGE_SIZE},
            force=force,
        )
        if not isinstance(data, dict):
            raise B3Error(f"listagens: esperado dict, veio {type(data)}")
        batch = data.get("results") or []
        rows.extend(batch)
        meta = data.get("page") or {}
        total_pages = int(meta.get("totalPages") or 1)
        print(f"  b3 list page {page}/{total_pages} (+{len(batch)})", flush=True)
        page += 1
        time.sleep(0.25)
    return rows


def fetch_detail(code_cvm: str, *, force: bool = False) -> dict:
    data = _get(
        "GetDetail",
        {"codeCVM": str(code_cvm), "language": "pt-br"},
        force=force,
    )
    if isinstance(data, str):
        data = json.loads(data) if data else {}
    if not isinstance(data, dict):
        raise B3Error(f"detail {code_cvm}: esperado dict")
    return data


def enrich_active(
    listings: list[dict],
    *,
    limit: int | None = None,
    force: bool = False,
) -> list[B3Company]:
    """Detalhe para empresas status=A (ativas). limit=None = todas."""
    active = [r for r in listings if (r.get("status") or "").upper() == "A"]
    if limit is not None:
        active = active[:limit]
    out: list[B3Company] = []
    for i, row in enumerate(active, 1):
        code = str(row.get("codeCVM") or "")
        detail: dict = {}
        try:
            detail = fetch_detail(code, force=force)
        except Exception as exc:  # noqa: BLE001
            print(f"  b3 detail {code} skip: {exc}", flush=True)
        out.append(
            B3Company(
                code_cvm=code,
                issuing_company=row.get("issuingCompany") or detail.get("issuingCompany"),
                company_name=row.get("companyName") or detail.get("companyName"),
                trading_name=row.get("tradingName") or detail.get("tradingName"),
                cnpj=row.get("cnpj") or detail.get("cnpj"),
                segment=row.get("segment"),
                status=row.get("status"),
                market_indicator=row.get("marketIndicator"),
                industry_classification=detail.get("industryClassification"),
                activity=detail.get("activity"),
                website=detail.get("website"),
            )
        )
        if i % 50 == 0:
            print(f"  b3 detail {i}/{len(active)}", flush=True)
        time.sleep(0.15)
    return out


def write_companies(companies: list[B3Company], *, merge: bool = True) -> Path:
    B3_DIR.mkdir(parents=True, exist_ok=True)
    path = B3_DIR / "companies.parquet"
    df = pl.DataFrame([asdict(c) for c in companies])
    if merge and path.exists() and df.height:
        old = pl.read_parquet(path)
        df = (
            pl.concat([old, df], how="diagonal_relaxed")
            .unique(subset=["code_cvm"], keep="last")
            .sort("code_cvm")
        )
    df.write_parquet(path)
    return path


def sync(*, detail_limit: int | None = None, force: bool = False) -> Path:
    """Lista completa + detalhes (limitaveis)."""
    listings = fetch_listings(force=force)
    raw_path = B3_DIR / "listings_raw.parquet"
    B3_DIR.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(listings).write_parquet(raw_path)
    print(f"  b3 listings_raw: {len(listings)} -> {raw_path}", flush=True)
    companies = enrich_active(listings, limit=detail_limit, force=force)
    path = write_companies(companies, merge=True)
    print(f"  b3 companies: {len(companies)} -> {path}", flush=True)
    return path
