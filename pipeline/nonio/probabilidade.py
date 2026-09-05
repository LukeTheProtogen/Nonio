"""Modelo baseline e a regra de recálculo por evento.

Este é o **baseline v0**: lognormal com volatilidade histórica e excesso
esperado ZERO sobre o CDI. Não tem conteúdo preditivo além da volatilidade —
é a barra que o modelo do dia 2 precisa superar, e é honesto exibir isso.

A consequência interessante: com excesso zero, a probabilidade de bater o CDI
fica ABAIXO de 50% e cai com a volatilidade. É o arrasto de volatilidade, e é
real: um ativo mais volátil tem menos chance de superar o CDI mesmo quando o
retorno esperado é igual.
"""
from math import erf, exp, log, sqrt

import polars as pl

PREGOES_ANO = 252
MODELO = "baseline-lognormal-v0"

# Tolerância de recálculo: metade da barra de erro de um bin de calibração com
# ~400 observações (±4,9pp). Abaixo disso, recalcular exibe ruído com cara de
# informação. Ajustar quando houver histórico de calibração de verdade.
TOLERANCIA_PP = 2.0


def _N(x: float) -> float:
    return 0.5 * (1 + erf(x / sqrt(2)))


def volatilidade(fechamentos: pl.Series) -> float:
    """Volatilidade anualizada dos log-retornos diários."""
    r = (fechamentos.log() - fechamentos.log().shift(1)).drop_nulls()
    return float(r.std(ddof=1) * sqrt(PREGOES_ANO))


def prob_bater_cdi(vol: float, excesso: float = 0.0, anos: float = 1.0) -> float:
    """P(retorno do ativo > CDI) no horizonte, sob lognormal.

    `excesso` é o retorno esperado acima do CDI. No baseline é zero.
    """
    mu_log = log(1 + excesso) - 0.5 * vol * vol * anos
    return _N(mu_log / (vol * sqrt(anos)))


def limiar_recalculo(vol: float, tolerancia_pp: float = TOLERANCIA_PP,
                     anos: float = 1.0) -> float:
    """Quanto o preço precisa se mover para a probabilidade mudar de verdade.

    Resolve para o choque de preço que desloca P em `tolerancia_pp` pontos.
    O limiar é POR ATIVO: ativo pouco volátil precisa de um movimento menor
    para a previsão mudar de forma mensurável. Um número fixo de 3% para todos
    seria errado nas duas pontas.
    """
    p0 = prob_bater_cdi(vol, anos=anos)
    alvo = p0 - tolerancia_pp / 100.0

    baixo, alto = 0.0, 1.0            # busca binária no choque de preço
    for _ in range(60):
        meio = (baixo + alto) / 2
        mu_log = -0.5 * vol * vol * anos - log(1 + meio)
        if _N(mu_log / (vol * sqrt(anos))) > alvo:
            baixo = meio
        else:
            alto = meio
    return (baixo + alto) / 2


def deve_recalcular(variacao_pct: float, vol: float, *,
                    fato_relevante: bool = False,
                    decisao_copom: bool = False,
                    novo_focus: bool = False) -> tuple[bool, str]:
    """A regra por evento.

    Recalcular por relógio produz ruído; recalcular por evento captura sinal.
    Ordem importa: eventos de informação vencem o limiar de preço, porque
    mudam o fundamento e não só o ponto de partida.
    """
    if fato_relevante:
        return True, "fato relevante novo na CVM"
    if decisao_copom:
        return True, "decisão do Copom"
    if novo_focus:
        return True, "divulgação do Focus"
    limiar = limiar_recalculo(vol) * 100
    if abs(variacao_pct) >= limiar:
        return True, f"preço moveu {variacao_pct:+.2f}% (limiar {limiar:.2f}%)"
    return False, f"movimento {variacao_pct:+.2f}% abaixo do limiar {limiar:.2f}%"
