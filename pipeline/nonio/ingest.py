"""Ingestão das fontes públicas.

Roda offline e escreve Parquet em data/raw/. Nada aqui vai para o caminho de
requisição do usuário — o site lê o que este script publica.

    uv run python -m nonio.ingest
"""
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote, urlencode

import polars as pl
import requests

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / "data" / "raw"

OLINDA = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"
          "/ExpectativaMercadoMensais")
SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados"

# Decisão travada no README: base 0 (amostra ampla). Nunca misturar com a base 1.
BASE_CALCULO = 0


def focus(indicador: str = "IPCA", limite: int = 1000) -> pl.DataFrame:
    params = {
        "$format": "json",
        "$top": limite,
        "$orderby": "Data desc",
        "$filter": f"Indicador eq '{indicador}' and baseCalculo eq {BASE_CALCULO}",
        "$select": "Indicador,Data,DataReferencia,Media,Mediana,DesvioPadrao,"
                   "Minimo,Maximo,numeroRespondentes",
    }
    # O Olinda rejeita espaço codificado como "+" (o padrão do requests) e exige
    # "%20". Medido em 04-09-2026: com "+" a resposta é 400; com "%20", 200.
    url = f"{OLINDA}?{urlencode(params, quote_via=quote)}"
    return pl.DataFrame(_get_json(url)["value"])


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


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    tarefas = [
        ("focus_ipca.parquet", lambda: focus("IPCA")),
        ("sgs_ipca.parquet",         lambda: sgs(433, "ipca_mensal")),
        ("sgs_selic_mensal.parquet", lambda: sgs(4390, "selic_mensal")),
        ("sgs_selic_diaria.parquet", lambda: sgs_diario(432, "selic_meta")),
    ]
    for arquivo, fn in tarefas:
        df = fn()
        df.write_parquet(SAIDA / arquivo)
        print(f"  {arquivo:<20} {df.height:>6} linhas  {len(df.columns)} colunas")
    print(f"escrito em {SAIDA}")


if __name__ == "__main__":
    main()
