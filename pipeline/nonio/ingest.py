"""Ingestão das fontes públicas.

Roda offline e escreve Parquet em data/raw/. Nada aqui vai para o caminho de
requisição do usuário — o site lê o que este script publica.

    uv run python -m nonio.ingest
"""
import os
import re
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote, urlencode

import polars as pl
import requests

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "data" / "raw"

OLINDA_BASE = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"
SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"

# Decisão travada no README: base 0 (amostra ampla). Nunca misturar com a base 1.
BASE_CALCULO = 0

# Schema explícito, não inferido. Nos registros dos anos 2000 vários campos vêm
# inteiros ou nulos, e o Polars fixa o tipo pelas primeiras linhas — depois estoura
# com "could not append value: 0.2 of type: f64". Num pipeline de dados o schema é
# contrato, não adivinhação.
_NUM = {
    "Media": pl.Float64, "Mediana": pl.Float64, "DesvioPadrao": pl.Float64,
    "Minimo": pl.Float64, "Maximo": pl.Float64, "numeroRespondentes": pl.Int64,
}
SCHEMA_MENSAIS = {"Indicador": pl.String, "Data": pl.String,
                  "DataReferencia": pl.String, **_NUM}
SCHEMA_ANUAIS = SCHEMA_MENSAIS
SCHEMA_SELIC = {"Data": pl.String, "Reuniao": pl.String, **_NUM}


def _slug(nome: str) -> str:
    """'IPCA Livres' -> 'ipca_livres'. Nome de arquivo previsível."""
    troca = str.maketrans("áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ", "aaaaeeiooouucAAAAEEIOOOUUC")
    return re.sub(r"[^a-z0-9]+", "_", nome.translate(troca).lower()).strip("_")


ENDPOINTS = {
    "mensais": "ExpectativaMercadoMensais",
    "anuais": "ExpectativasMercadoAnuais",
    "selic": "ExpectativasMercadoSelic",
}

CAMPOS = "Data,Media,Mediana,DesvioPadrao,Minimo,Maximo,numeroRespondentes"


def _paginar(endpoint: str, filtro: str, select: str, ordem: str,
             pagina: int = 20000) -> list[dict]:
    """Percorre um endpoint do Olinda até esgotar.

    O Olinda não suporta `$count`, então não dá para saber o total antes:
    paginamos com `$skip` até uma página voltar menor que o pedido.
    Medido em 04-09-2026: `$top` aceita ao menos 20000 e `$skip` é confiável.
    """
    linhas: list[dict] = []
    pulo = 0
    while True:
        params = {
            "$format": "json", "$top": pagina, "$skip": pulo,
            "$orderby": ordem, "$filter": filtro, "$select": select,
        }
        # O Olinda rejeita espaço codificado como "+" (o padrão do requests) e
        # exige "%20". Medido em 04-09-2026: com "+" a resposta é 400.
        url = f"{OLINDA_BASE}/{endpoint}?{urlencode(params, quote_via=quote)}"
        lote = _get_json(url)["value"]
        if not lote:
            break
        linhas += lote
        if len(lote) < pagina:
            break
        pulo += pagina
        time.sleep(0.5)
    return linhas


def focus_mensais(indicador: str) -> pl.DataFrame:
    """Expectativa mensal: uma linha por (data de coleta, mês de referência)."""
    linhas = _paginar(
        ENDPOINTS["mensais"],
        f"Indicador eq '{indicador}' and baseCalculo eq {BASE_CALCULO}",
        f"Indicador,DataReferencia,{CAMPOS}",
        "Data asc,DataReferencia asc",
    )
    if not linhas:
        raise FonteIndisponivel(f"Focus mensais vazio para {indicador}")
    return (pl.DataFrame(linhas, schema=SCHEMA_MENSAIS)
              .unique(subset=["Data", "DataReferencia"], keep="first")
              .with_columns(
                  pl.col("Data").str.to_date("%Y-%m-%d"),
                  # "MM/AAAA" -> 1º dia do mês de referência
                  pl.col("DataReferencia")
                    .str.replace(r"^(\d{2})/(\d{4})$", r"$2-$1-01")
                    .str.to_date("%Y-%m-%d").alias("referencia"),
              ))


def focus_anuais(indicador: str) -> pl.DataFrame:
    """Expectativa anual: referência é o ano-calendário ('2026')."""
    linhas = _paginar(
        ENDPOINTS["anuais"],
        f"Indicador eq '{indicador}' and baseCalculo eq {BASE_CALCULO}",
        f"Indicador,DataReferencia,{CAMPOS}",
        "Data asc,DataReferencia asc",
    )
    if not linhas:
        raise FonteIndisponivel(f"Focus anuais vazio para {indicador}")
    return (pl.DataFrame(linhas, schema=SCHEMA_ANUAIS)
              .unique(subset=["Data", "DataReferencia"], keep="first")
              .with_columns(
                  pl.col("Data").str.to_date("%Y-%m-%d"),
                  # o ano de referência fecha em 31/12
                  (pl.col("DataReferencia") + "-12-31").str.to_date("%Y-%m-%d")
                    .alias("referencia"),
              ))


def focus_selic() -> pl.DataFrame:
    """Expectativa de Selic por reunião do Copom ('R5/2028')."""
    linhas = _paginar(
        ENDPOINTS["selic"],
        f"baseCalculo eq {BASE_CALCULO}",
        f"Reuniao,{CAMPOS}",
        "Data asc,Reuniao asc",
    )
    if not linhas:
        raise FonteIndisponivel("Focus Selic por reunião vazio")
    return (pl.DataFrame(linhas, schema=SCHEMA_SELIC)
              .unique(subset=["Data", "Reuniao"], keep="first")
              .with_columns(
                  pl.col("Data").str.to_date("%Y-%m-%d"),
                  pl.col("Reuniao").str.extract(r"^R(\d+)/", 1).cast(pl.Int32)
                    .alias("reuniao_num"),
                  pl.col("Reuniao").str.extract(r"/(\d{4})$", 1).cast(pl.Int32)
                    .alias("reuniao_ano"),
              ))

class FonteIndisponivel(RuntimeError):
    """A fonte respondeu, mas não com o dado pedido."""


def _get_json(url: str, params: dict | None = None, tentativas: int = 4):
    """GET que não confia no código HTTP.

    O SGS do BCB devolve **HTTP 200 com página HTML** quando estrangula a
    requisição — medido em 04-09-2026, corpo de 6255 bytes e content-type
    text/html. `raise_for_status()` passa direto e o erro só aparece no
    `.json()`, longe da causa. Aqui a validação é pelo content-type.
    """
    espera = 2.0
    for n in range(1, tentativas + 1):
        r = requests.get(url, params=params, timeout=90)
        tipo = r.headers.get("content-type", "")
        if r.ok and "json" in tipo.lower():
            try:
                return r.json()
            except ValueError:
                pass
        if n < tentativas:
            time.sleep(espera)
            espera *= 2
            continue
        raise FonteIndisponivel(
            f"{url} respondeu HTTP {r.status_code}, content-type '{tipo}', "
            f"{len(r.content)} bytes, após {tentativas} tentativas. "
            "Se for HTML com 200, é limite de taxa do SGS — espere e repita."
        )


def _sgs_bruto(serie: int, params: dict | None = None) -> list[dict]:
    return _get_json(SGS.format(serie=serie),
                     {"formato": "json", **(params or {})})


def _tipar(linhas: list[dict], nome: str) -> pl.DataFrame:
    return (pl.DataFrame(linhas)
              .with_columns(pl.col("data").str.to_date("%d/%m/%Y"),
                            pl.col("valor").cast(pl.Float64))
              .rename({"valor": nome})
              .unique(subset="data", keep="first")
              .sort("data"))


def sgs(serie: int, nome: str) -> pl.DataFrame:
    """Série curta o bastante para vir inteira (mensais, em geral)."""
    return _tipar(_sgs_bruto(serie), nome)


def sgs_diario(serie: int, nome: str, inicio: int = 2000) -> pl.DataFrame:
    """Série diária, em janelas de 9 anos.

    O SGS devolve 406 quando o intervalo passa de ~10 anos numa série diária.
    Medido em 04-09-2026: 7 e 10 anos retornam 200; 11 e 27 anos, 406.
    """
    linhas: list[dict] = []
    fim_total = date.today().year
    ini = inicio
    while ini <= fim_total:
        fim = min(ini + 8, fim_total)
        linhas += _sgs_bruto(serie, {
            "dataInicial": f"01/01/{ini}",
            "dataFinal": f"31/12/{fim}",
        })
        ini = fim + 1
        time.sleep(1.0)  # o SGS estrangula rajadas
    return _tipar(linhas, nome)


# Núcleo do produto. Ampliar aqui, não espalhar pelo código.
MENSAIS = ["IPCA", "IPCA Livres", "IPCA Serviços", "Câmbio", "IGP-M"]
ANUAIS = ["IPCA", "Selic", "Câmbio", "PIB Total"]


def _escrever(df: pl.DataFrame, arquivo: str) -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    df.write_parquet(SAIDA / arquivo)
    print(f"  {arquivo:<34} {df.height:>7} linhas  {len(df.columns)} colunas")


def _pular(arquivo: str) -> bool:
    """Não rebaixa o que já está no disco, salvo NONIO_FORCAR=1.

    A carga completa do Focus leva minutos. Sem isso, qualquer ajuste no
    pipeline custa uma nova rodada inteira.
    """
    existe = (SAIDA / arquivo).exists()
    if existe and os.environ.get("NONIO_FORCAR") != "1":
        print(f"  {arquivo:<34} já existe — pulado (NONIO_FORCAR=1 refaz)")
        return True
    return False


def main() -> None:
    print(f"Focus base de cálculo = {BASE_CALCULO} (amostra ampla)\n")

    for ind in MENSAIS:
        arq = f"focus_mensais_{_slug(ind)}.parquet"
        if not _pular(arq):
            _escrever(focus_mensais(ind), arq)

    for ind in ANUAIS:
        arq = f"focus_anuais_{_slug(ind)}.parquet"
        if not _pular(arq):
            _escrever(focus_anuais(ind), arq)

    if not _pular("focus_selic_reuniao.parquet"):
        _escrever(focus_selic(), "focus_selic_reuniao.parquet")

    for arq, fn in (
        ("sgs_ipca.parquet",         lambda: sgs(433, "ipca_mensal")),
        ("sgs_selic_mensal.parquet", lambda: sgs(4390, "selic_mensal")),
        ("sgs_selic_diaria.parquet", lambda: sgs_diario(432, "selic_meta")),
        ("sgs_cambio.parquet",       lambda: sgs_diario(1, "cambio_venda", inicio=2000)),
        # 13522: IPCA acumulado em 12 meses — é o realizado anual, já pronto.
        ("sgs_ipca_12m.parquet",     lambda: sgs(13522, "ipca_12m")),
        # 13521: meta de inflação do CMN, por ano. O teto MUDA ao longo do
        # tempo — cravar 4,5% faria o Brier mentir no histórico.
        ("sgs_meta_inflacao.parquet", lambda: sgs(13521, "meta")),
    ):
        if not _pular(arq):
            _escrever(fn(), arq)

    print(f"\n  escrito em {SAIDA}")


if __name__ == "__main__":
    main()
