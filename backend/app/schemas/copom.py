from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class CopomMeetingOut(BaseModel):
    """Ata indexada (+ features quando existirem)."""

    model_config = ConfigDict(from_attributes=True)

    nro_reuniao: int
    data_referencia: date | None = None
    data_publicacao: date | None = None
    titulo: str | None = None
    pdf_url: str | None = None
    has_features: bool = False
    decisao: str | None = None
    selic_meta_aa: float | None = None
    delta_pp: float | None = None
    datas_reuniao: str | None = None
    tom_politica: str | None = Field(
        default=None, description="dovish | neutro | hawkish | indefinido"
    )
    tom_inflacao: str | None = None
    tom_atividade: str | None = None
    resumo: str | None = None


class CopomDetailOut(CopomMeetingOut):
    pdf_path: str | None = None
    bytes: int | None = None
    modelo: str | None = None
    extracted_at: datetime | None = None
    decisao_signed: int | None = None
    unanimidade: bool | None = None
    n_votantes: int | None = None
    expectativas_acima_meta: bool | None = None
    risco_alta_dominante: bool | None = None
    menciona_geopolitica: bool | None = None
    menciona_fiscal: bool | None = None
    guidance_restritivo: bool | None = None
    focus_ipca_ano_corrente: float | None = None
    focus_ipca_ano_seguinte: float | None = None
    projecao_copom_horizonte: float | None = None


class CopomPage(BaseModel):
    items: list[CopomMeetingOut]
    page: int
    page_size: int
    total: int
