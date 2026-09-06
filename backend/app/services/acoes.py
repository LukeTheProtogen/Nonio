"""Monta GET /acoes a partir de previews (lowvol) + history parquet — sem DuckDB."""

from __future__ import annotations

import math
from datetime import datetime, timezone

import polars as pl

from app.parquet.store import store
from app.schemas.acoes import (
    AcaoDetalheDados,
    AcaoDetalheEnvelope,
    AcaoOut,
    AcoesDados,
    AcoesEnvelope,
    MetaOut,
    ProbabilidadeOut,
)
from app.services.model_signals import PreviewSignal, all_preview_signals, preview_for

AVISO = (
    "Ferramenta de pesquisa e probabilidade sobre dados públicos. "
    "Não é recomendação de investimento, análise ou consultoria de valores "
    "mobiliários — Resoluções CVM 19 e 20."
)

CDI_12M_FALLBACK = 10.5

# Nomes amigáveis quando a tabela Stock não está disponível.
_NOMES = {
    "PETR4": ("Petrobras", "Petroleo e gas"),
    "VALE3": ("Vale", "Mineracao"),
    "ITUB4": ("Itau Unibanco", "Bancos"),
    "MGLU3": ("Magazine Luiza", "Varejo"),
    "BBDC4": ("Bradesco", "Bancos"),
    "BBAS3": ("Banco do Brasil", "Bancos"),
    "ABEV3": ("Ambev", "Bebidas"),
    "WEGE3": ("WEG", "Bens de capital"),
    "B3SA3": ("B3", "Servicos financeiros"),
    "RENT3": ("Localiza", "Aluguel de veiculos"),
    "SUZB3": ("Suzano", "Papel e celulose"),
    "GGBR4": ("Gerdau", "Siderurgia"),
    "RDOR3": ("Rede D'Or", "Saude"),
    "PRIO3": ("PRIO", "Petroleo e gas"),
    "EQTL3": ("Equatorial", "Energia eletrica"),
    "RADL3": ("Raia Drogasil", "Varejo de saude"),
    "VBBR3": ("Vibra", "Petroleo e gas"),
    "TOTS3": ("Totvs", "Tecnologia"),
    "LREN3": ("Lojas Renner", "Varejo"),
    "HAPV3": ("Hapvida", "Saude"),
}


def _cdi_12m() -> float:
    path = store.root / "macro" / "cdi.parquet"
    if not path.exists():
        return CDI_12M_FALLBACK
    try:
        df = pl.read_parquet(path)
        date_col = "data" if "data" in df.columns else "date"
        cdi_col = "cdi" if "cdi" in df.columns else "cdi_pct"
        df = df.sort(date_col).drop_nulls(subset=[cdi_col]).tail(252)
        if df.height < 60:
            return CDI_12M_FALLBACK
        log_sum = float(df.select((1 + pl.col(cdi_col) / 100).log().sum()).item())
        return float((math.exp(log_sum) - 1.0) * 100.0)
    except Exception:  # noqa: BLE001
        return CDI_12M_FALLBACK


def _metrics_from_history(code: str, cdi12m: float) -> dict:
    df = store.read_history(code)
    defaults = {
        "retorno12m": 0.0,
        "acimaDoCdi": -cdi12m,
        "vol12m": 30.0,
        "piorQueda": 0.0,
        "diasAteOPico": 0,
        "beta": 1.0,
        "sensJuros100bp": 0.0,
        "sensDolar1pct": 0.0,
        "sensBrent10pct": 0.0,
        "fatos30d": 0,
        "serie": [],
        "preco": None,
        "variacaoDiaPct": None,
    }
    if df.is_empty():
        return defaults
    if "source" in df.columns:
        pref = df.filter(pl.col("source") == "yahoo")
        if not pref.is_empty():
            df = pref
    df = df.drop_nulls("close").sort("date")
    if df.height < 30:
        return defaults

    closes = [float(c) for c in df["close"].to_list()]
    dates = [str(d)[:10] for d in df["date"].to_list()]
    serie = [{"data": d, "fechamento": c} for d, c in zip(dates, closes)]

    window = closes[-252:] if len(closes) >= 252 else closes
    ret = float(window[-1] / window[0] - 1.0) * 100.0
    rets = [
        math.log(window[i] / window[i - 1])
        for i in range(1, len(window))
        if window[i - 1] > 0 and window[i] > 0
    ]
    if len(rets) > 5:
        mean = sum(rets) / len(rets)
        var = sum((r - mean) ** 2 for r in rets) / len(rets)
        vol = math.sqrt(var) * math.sqrt(252) * 100.0
    else:
        vol = 30.0

    peak = window[0]
    pior = 0.0
    trough_i = 0
    for i, px in enumerate(window):
        if px > peak:
            peak = px
        dd = px / peak - 1.0
        if dd < pior:
            pior = dd
            trough_i = i
    peak_before = max(window[: trough_i + 1])
    recover = 0
    for j in range(trough_i + 1, len(window)):
        if window[j] >= peak_before:
            recover = j - trough_i
            break

    var_dia = None
    if len(closes) >= 2 and closes[-2] > 0:
        var_dia = (closes[-1] / closes[-2] - 1.0) * 100.0

    return {
        "retorno12m": round(ret, 2),
        "acimaDoCdi": round(ret - cdi12m, 2),
        "vol12m": round(vol, 1),
        "piorQueda": round(pior * 100.0, 2),
        "diasAteOPico": int(recover),
        "beta": 1.0,
        "sensJuros100bp": 0.0,
        "sensDolar1pct": 0.0,
        "sensBrent10pct": 0.0,
        "fatos30d": 0,
        "serie": serie,
        "preco": closes[-1],
        "variacaoDiaPct": None if var_dia is None else round(var_dia, 2),
    }


def _acao_out(sig: PreviewSignal, cdi12m: float, *, with_serie: bool) -> tuple[AcaoOut, list[dict]]:
    m = _metrics_from_history(sig.code, cdi12m)
    serie = m.pop("serie")
    preco = m.pop("preco")
    var = m.pop("variacaoDiaPct")
    if not with_serie:
        serie = []
    if preco is None:
        preco = sig.preco_referencia

    nome, setor = _NOMES.get(sig.code, (sig.code, "-"))
    return (
        AcaoOut(
            ticker=sig.code,
            nome=nome,
            setor=setor,
            preco=preco,
            variacaoDiaPct=var,
            retorno12m=float(m["retorno12m"]),
            acimaDoCdi=float(m["acimaDoCdi"]),
            vol12m=float(m["vol12m"]),
            piorQueda=float(m["piorQueda"]),
            diasAteOPico=int(m["diasAteOPico"]),
            beta=float(m["beta"]),
            sensJuros100bp=float(m["sensJuros100bp"]),
            sensDolar1pct=float(m["sensDolar1pct"]),
            sensBrent10pct=float(m["sensBrent10pct"]),
            fatos30d=int(m["fatos30d"]),
            probabilidade=ProbabilidadeOut(
                pAlta=sig.probabilidade,
                horizonteMeses=sig.horizonte_meses,
                modeloVersao=sig.modelo_versao,
                calculadoEm=sig.calculado_em,
            ),
        ),
        serie,
    )


def _meta(gerado_em: str, *, mock: bool) -> MetaOut:
    return MetaOut(
        geradoEm=gerado_em,
        servidoEm=datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        fontes=[
            "pipeline nonio.train (lowvol-spine)",
            "B3 via parquet/yahoo",
            "BCB CDI (SGS)",
        ],
        mock=mock,
        aviso=AVISO,
    )


def list_acoes() -> AcoesEnvelope:
    signals = all_preview_signals()
    cdi12m = _cdi_12m()
    acoes: list[AcaoOut] = []
    gerado = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for sig in sorted(signals, key=lambda s: s.probabilidade, reverse=True):
        acao, _ = _acao_out(sig, cdi12m, with_serie=False)
        acoes.append(acao)
        gerado = sig.calculado_em
    return AcoesEnvelope(
        dados=AcoesDados(acoes=acoes, cdi12m=round(cdi12m, 2), limitadoSemToken=False),
        meta=_meta(gerado, mock=True),
    )


def get_acao(ticker: str) -> AcaoDetalheEnvelope | None:
    sig = preview_for(ticker)
    if sig is None:
        return None
    cdi12m = _cdi_12m()
    acao, serie = _acao_out(sig, cdi12m, with_serie=True)
    return AcaoDetalheEnvelope(
        dados=AcaoDetalheDados(acao=acao, serie=serie, fatos=[]),
        meta=_meta(sig.calculado_em, mock=True),
    )
