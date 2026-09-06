from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl

from app.config import settings
from app.schemas.copom import CopomDetailOut, CopomMeetingOut, CopomPage

TOM_LABEL = {-1: "dovish", 0: "neutro", 1: "hawkish"}


def _copom_dir() -> Path:
    return settings.parquet_root / "copom"


def _atas_path() -> Path:
    return _copom_dir() / "atas.parquet"


def _features_path() -> Path:
    return _copom_dir() / "features.parquet"


def _tom_label(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return TOM_LABEL.get(int(value), "indefinido")
    except (TypeError, ValueError):
        return str(value)


def _as_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str) and value.strip():
        return date.fromisoformat(value[:10])
    return None


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        return datetime.fromisoformat(value)
    return None


def _read_atas() -> pl.DataFrame:
    path = _atas_path()
    if not path.exists():
        return pl.DataFrame(
            schema={
                "nro_reuniao": pl.Int64,
                "data_referencia": pl.Date,
                "data_publicacao": pl.Date,
                "titulo": pl.Utf8,
                "pdf_url": pl.Utf8,
                "pdf_path": pl.Utf8,
                "bytes": pl.Int64,
            }
        )
    return pl.read_parquet(path)


def _read_features() -> pl.DataFrame:
    path = _features_path()
    if not path.exists():
        return pl.DataFrame(schema={"nro_reuniao": pl.Int64})
    return pl.read_parquet(path)


def _feature_map() -> dict[int, dict[str, Any]]:
    df = _read_features()
    if df.is_empty():
        return {}
    out: dict[int, dict[str, Any]] = {}
    for row in df.to_dicts():
        nro = int(row["nro_reuniao"])
        out[nro] = row
    return out


def _meeting_from_rows(
    ata: dict[str, Any], feat: dict[str, Any] | None
) -> CopomMeetingOut:
    return CopomMeetingOut(
        nro_reuniao=int(ata["nro_reuniao"]),
        data_referencia=_as_date(ata.get("data_referencia")),
        data_publicacao=_as_date(ata.get("data_publicacao")),
        titulo=ata.get("titulo"),
        pdf_url=ata.get("pdf_url"),
        has_features=feat is not None,
        decisao=(feat or {}).get("decisao"),
        selic_meta_aa=(feat or {}).get("selic_meta_aa"),
        delta_pp=(feat or {}).get("delta_pp"),
        datas_reuniao=(feat or {}).get("datas_reuniao") or None,
        tom_politica=_tom_label((feat or {}).get("tom_politica")),
        tom_inflacao=_tom_label((feat or {}).get("tom_inflacao")),
        tom_atividade=_tom_label((feat or {}).get("tom_atividade")),
        resumo=(feat or {}).get("resumo"),
    )


def _detail_from_rows(
    ata: dict[str, Any], feat: dict[str, Any] | None
) -> CopomDetailOut:
    base = _meeting_from_rows(ata, feat)
    payload = base.model_dump()
    payload.update(
        {
            "pdf_path": ata.get("pdf_path"),
            "bytes": ata.get("bytes"),
            "modelo": (feat or {}).get("modelo"),
            "extracted_at": _as_datetime((feat or {}).get("extracted_at")),
            "decisao_signed": (feat or {}).get("decisao_signed"),
            "unanimidade": (feat or {}).get("unanimidade"),
            "n_votantes": (feat or {}).get("n_votantes"),
            "expectativas_acima_meta": (feat or {}).get("expectativas_acima_meta"),
            "risco_alta_dominante": (feat or {}).get("risco_alta_dominante"),
            "menciona_geopolitica": (feat or {}).get("menciona_geopolitica"),
            "menciona_fiscal": (feat or {}).get("menciona_fiscal"),
            "guidance_restritivo": (feat or {}).get("guidance_restritivo"),
            "focus_ipca_ano_corrente": (feat or {}).get("focus_ipca_ano_corrente"),
            "focus_ipca_ano_seguinte": (feat or {}).get("focus_ipca_ano_seguinte"),
            "projecao_copom_horizonte": (feat or {}).get(
                "projecao_copom_horizonte"
            ),
        }
    )
    return CopomDetailOut(**payload)


def list_meetings(
    *,
    page: int = 1,
    page_size: int = 20,
    with_features_only: bool = False,
) -> CopomPage:
    atas = _read_atas().sort("nro_reuniao", descending=True)
    feats = _feature_map()
    rows = atas.to_dicts()
    if with_features_only:
        rows = [r for r in rows if int(r["nro_reuniao"]) in feats]
    total = len(rows)
    start = (page - 1) * page_size
    chunk = rows[start : start + page_size]
    items = [
        _meeting_from_rows(r, feats.get(int(r["nro_reuniao"]))) for r in chunk
    ]
    return CopomPage(items=items, page=page, page_size=page_size, total=total)


def get_meeting(nro: int) -> CopomDetailOut | None:
    atas = _read_atas().filter(pl.col("nro_reuniao") == nro)
    if atas.is_empty():
        return None
    ata = atas.to_dicts()[0]
    return _detail_from_rows(ata, _feature_map().get(nro))


def latest_meeting() -> CopomDetailOut | None:
    atas = _read_atas()
    if atas.is_empty():
        return None
    nro = int(atas.select(pl.col("nro_reuniao").max()).item())
    return get_meeting(nro)
