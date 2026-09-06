from fastapi import APIRouter, Depends, HTTPException

from app.auth.nextauth_gate import ApiUser, require_nextauth_user
from app.schemas.acoes import AcaoDetalheEnvelope, AcoesEnvelope
from app.services import acoes as acoes_service

router = APIRouter(prefix="/acoes", tags=["acoes"])


@router.get("", response_model=AcoesEnvelope)
def list_acoes(
    _user: ApiUser = Depends(require_nextauth_user),
) -> AcoesEnvelope:
    return acoes_service.list_acoes()


@router.get("/{ticker}", response_model=AcaoDetalheEnvelope)
def get_acao(
    ticker: str,
    _user: ApiUser = Depends(require_nextauth_user),
) -> AcaoDetalheEnvelope:
    item = acoes_service.get_acao(ticker)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Ação {ticker!r} sem preview")
    return item
