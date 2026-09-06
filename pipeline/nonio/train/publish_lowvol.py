"""Force lowvol spine into product surfaces.

Writes:
  - data/parquet/models/previews_lgbm.parquet  (backend model_signals)
  - web/src/data/previsoes.json                 (frontend local fallback)
  - DuckDB previews rows source=nonio           (product DB)

    cd pipeline && uv run python -m nonio.train.publish_lowvol
"""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path

import polars as pl

from nonio import probabilidade as prob
from nonio.config import RAIZ
from nonio.train import DEFAULT_UNIVERSE, MODELO_VERSAO
from nonio.train.dataset import build_panel, latest_feature_rows, resolve_universe
from nonio.train.fit import (
    export_previews,
    predict_frame_spine,
    save_spine_artifact,
)

HORIZON = 63
PUBLICO = RAIZ / "web" / "src" / "data"
HISTORICO = RAIZ / "data" / "snapshot" / "historico_previsoes.jsonl"


def _ensure_iso(ts: str) -> str:
    if ts.endswith("Z"):
        return ts[:-1] + "+00:00"
    if "+" in ts[10:] or ts.endswith("UTC"):
        return ts
    # naive UTC from train export
    if "T" in ts and "+" not in ts[10:]:
        return ts + "+00:00"
    return ts


def _write_previsoes_json(preds: pl.DataFrame, latest: pl.DataFrame) -> Path:
    vol_map = {
        r["code"]: float(r["vol_60"]) if r.get("vol_60") is not None else 0.3
        for r in latest.select(["code", "vol_60"]).to_dicts()
    }
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    previsoes = []
    for row in preds.sort("probabilidade", descending=True).to_dicts():
        code = row["code"]
        vol = max(0.05, float(vol_map.get(code, 0.3)))
        calc = _ensure_iso(str(row.get("calculado_em") or agora.isoformat()))
        previsoes.append(
            {
                "ticker": code,
                "probabilidade": round(float(row["probabilidade"]), 4),
                "horizonte_meses": int(row["horizonte_meses"]),
                "preco_referencia": round(float(row["preco_referencia"]), 4),
                "vol_anual": round(vol, 4),
                "limiar_recalculo": round(prob.limiar_recalculo(vol), 4),
                "calculado_em": calc,
                "modelo_versao": str(row["modelo_versao"]),
                "gatilho": "lowvol-spine",
            }
        )

    PUBLICO.mkdir(parents=True, exist_ok=True)
    path = PUBLICO / "previsoes.json"
    payload = {
        "geradoEm": agora.isoformat(),
        "modeloVersao": MODELO_VERSAO,
        "toleranciaPp": prob.TOLERANCIA_PP,
        "previsoes": previsoes,
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    HISTORICO.parent.mkdir(parents=True, exist_ok=True)
    with HISTORICO.open("a", encoding="utf-8") as f:
        for p in previsoes:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    return path


def _upsert_db(preds: pl.DataFrame) -> int:
    """Best-effort: write source=nonio into DuckDB previews."""
    try:
        from app.db.session import SessionLocal, init_db
        from app.db.writes import upsert_preview

        init_db()
        n = 0
        with SessionLocal() as db:
            for row in preds.to_dicts():
                as_of = row["date"]
                if isinstance(as_of, str):
                    as_of = date.fromisoformat(as_of[:10])
                extracted = datetime.now(timezone.utc).replace(tzinfo=None)
                calc = str(row.get("calculado_em") or "")
                try:
                    if calc:
                        extracted = datetime.fromisoformat(
                            _ensure_iso(calc).replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                except ValueError:
                    pass
                upsert_preview(
                    db,
                    source="nonio",
                    code=row["code"],
                    as_of=as_of,
                    extracted_at=extracted,
                    probabilidade=float(row["probabilidade"]),
                    horizonte_meses=int(row["horizonte_meses"]),
                    preco_referencia=float(row["preco_referencia"]),
                    modelo_versao=str(row["modelo_versao"]),
                    payload={
                        "excess_previsto": float(row["excess_previsto"]),
                        "probabilidade_baseline": float(row["probabilidade_baseline"]),
                        "spine": "lowvol",
                    },
                )
                n += 1
            db.commit()
        return n
    except Exception as exc:  # noqa: BLE001 — duckdb lock / missing auth env
        print(f"  db: skip ({type(exc).__name__}: {exc})", flush=True)
        return 0


def main() -> None:
    universe = resolve_universe()
    print(f"publish lowvol  n={len(universe)}  horizon={HORIZON}d", flush=True)
    panel = build_panel(universe, horizon=HORIZON)
    latest = latest_feature_rows(panel)
    if len(universe) > 40:
        latest = latest.filter(pl.col("code").is_in(list(DEFAULT_UNIVERSE)))

    preds = predict_frame_spine(
        latest, horizon=HORIZON, mode="lowvol", model=None, cols=None
    )
    export_previews(preds)
    save_spine_artifact(
        [],
        mode="lowvol",
        n_labeled=0,
        universe=universe,
        horizon=HORIZON,
        cfg=None,
        model=None,
        cols=None,
        cdi_report={"note": "publish_lowvol — no walk-forward in this path"},
    )

    json_path = _write_previsoes_json(preds, latest)
    print(f"  previsoes.json: {json_path} ({preds.height} tickers)", flush=True)

    n_db = _upsert_db(preds)
    print(f"  db previews source=nonio: {n_db} rows", flush=True)

    print("amostra (por p):", flush=True)
    for row in preds.sort("probabilidade", descending=True).head(8).to_dicts():
        print(
            f"  {row['code']:<6} p={row['probabilidade']:.3f}  "
            f"base={row['probabilidade_baseline']:.3f}  "
            f"excess={row['excess_previsto']:+.3f}",
            flush=True,
        )


if __name__ == "__main__":
    main()
