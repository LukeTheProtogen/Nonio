from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.nextauth_gate import ApiUser, require_nextauth_user
from app.schemas.copom import CopomDetailOut, CopomPage
from app.services import copom as copom_service

router = APIRouter(prefix="/copom", tags=["copom"])


@router.get("", response_model=CopomPage)
def list_copom(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    with_features_only: bool = Query(
        default=False,
        description="Se true, só reuniões com extração LLM",
    ),
    _user: ApiUser = Depends(require_nextauth_user),
) -> CopomPage:
    return copom_service.list_meetings(
        page=page,
        page_size=page_size,
        with_features_only=with_features_only,
    )


@router.get("/latest", response_model=CopomDetailOut)
def latest_copom(
    _user: ApiUser = Depends(require_nextauth_user),
) -> CopomDetailOut:
    item = copom_service.latest_meeting()
    if item is None:
        raise HTTPException(status_code=404, detail="Nenhuma ata Copom indexada")
    return item


@router.get("/{nro}", response_model=CopomDetailOut)
def get_copom(
    nro: int,
    _user: ApiUser = Depends(require_nextauth_user),
) -> CopomDetailOut:
    item = copom_service.get_meeting(nro)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Copom {nro} não encontrado")
    return item
