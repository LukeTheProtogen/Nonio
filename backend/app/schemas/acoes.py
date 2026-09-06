"""Schemas aligned with web/src/lib/api/contratos.ts for GET /acoes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProbabilidadeOut(BaseModel):
    pAlta: float = Field(ge=0, le=1)
    horizonteMeses: int = Field(gt=0)
    modeloVersao: str
    calculadoEm: str


class AcaoOut(BaseModel):
    ticker: str
    nome: str
    setor: str
    preco: float | None
    variacaoDiaPct: float | None
    retorno12m: float
    acimaDoCdi: float
    vol12m: float
    piorQueda: float
    diasAteOPico: int
    beta: float
    sensJuros100bp: float
    sensDolar1pct: float
    sensBrent10pct: float
    fatos30d: int
    probabilidade: ProbabilidadeOut | None


class AcoesDados(BaseModel):
    acoes: list[AcaoOut]
    cdi12m: float
    limitadoSemToken: bool = False


class MetaOut(BaseModel):
    geradoEm: str
    servidoEm: str
    fontes: list[str]
    mock: bool
    aviso: str


class AcoesEnvelope(BaseModel):
    dados: AcoesDados
    meta: MetaOut


class AcaoDetalheDados(BaseModel):
    acao: AcaoOut
    serie: list[dict]
    fatos: list[dict] = Field(default_factory=list)


class AcaoDetalheEnvelope(BaseModel):
    dados: AcaoDetalheDados
    meta: MetaOut
