"""Acertar a média sem perder a capacidade de distinguir casos.

O problema: as probabilidades saem deslocadas em nível — o prior lognormal com
excesso zero afirma ~42% de chance de bater o CDI onde a frequência observada
foi ~51%. Queremos corrigir esse nível.

A armadilha: acerta-se a média perfeitamente prevendo a taxa-base para TODO
mundo. Calibração impecável, discriminação nula, produto sem valor. Por isso
toda correção aqui é **monótona** — preserva integralmente a ordenação, e
portanto o AUC. Ela mexe no nível, nunca no ranking.

A decomposição de Brier separa as duas coisas e é como se verifica isso:

    BS = confiabilidade − resolução + incerteza

    confiabilidade  erro de NÍVEL      (queremos → 0)
    resolução       poder de separar    (queremos alto, e intocado)
    incerteza       do problema, fixa   (não se mexe)

    uv run python -m nonio.calibragem
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .probabilidade import prob_bater_cdi

EPS = 1e-6


def logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(np.asarray(p, float), EPS, 1 - EPS)
    return np.log(p / (1 - p))


def sigmoide(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.asarray(z, float)))


# ── correção de nível ───────────────────────────────────────────────────────

def ajuste_intercepto(p: np.ndarray, alvo: float,
                      tol: float = 1e-10, iteracoes: int = 200) -> float:
    """Deslocamento `a` em log-odds tal que média(σ(logit(p)+a)) == alvo.

    Um único parâmetro, transformação monótona: a ordenação dos ativos é
    idêntica antes e depois, logo o AUC não muda por construção. É a correção
    mais conservadora que existe para erro de nível.

    Resolvido por bisseção — a média é monótona crescente em `a`, então a raiz
    é única e a busca não depende de chute inicial.
    """
    p = np.asarray(p, float)
    z = logit(p)
    alvo = float(np.clip(alvo, EPS, 1 - EPS))

    lo, hi = -20.0, 20.0
    for _ in range(iteracoes):
        meio = (lo + hi) / 2
        if sigmoide(z + meio).mean() < alvo:
            lo = meio
        else:
            hi = meio
        if hi - lo < tol:
            break
    return (lo + hi) / 2


def aplicar_intercepto(p: np.ndarray, a: float) -> np.ndarray:
    return sigmoide(logit(p) + a)


def calibrar_excesso(vols: np.ndarray, y: np.ndarray, anos: float = 1.0,
                     iteracoes: int = 200) -> float:
    """Excesso esperado sobre o CDI que faz o prior bater a taxa observada.

    Alternativa ao ajuste de intercepto quando se quer corrigir o PRIOR em vez
    da saída do modelo. Mantém a estrutura lognormal — e com ela a variação
    transversal por volatilidade, que é informação real — e move só o nível.

    O `excesso=0` do baseline é uma escolha honesta de "não afirmo retorno".
    Este número diz quanto essa escolha custou em nível, medido, não achado.
    """
    vols = np.asarray(vols, float)
    alvo = float(np.mean(y))
    lo, hi = -0.50, 0.50
    for _ in range(iteracoes):
        meio = (lo + hi) / 2
        m = np.mean([prob_bater_cdi(float(v), excesso=meio, anos=anos) for v in vols])
        if m < alvo:
            lo = meio
        else:
            hi = meio
        if hi - lo < 1e-8:
            break
    return (lo + hi) / 2


# ── medição ─────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Decomposicao:
    brier: float
    confiabilidade: float
    resolucao: float
    incerteza: float
    erro_binning: float

    @property
    def brier_skill(self) -> float:
        return 1.0 - self.brier / self.incerteza if self.incerteza > 0 else float("nan")


def decomposicao_brier(p: np.ndarray, y: np.ndarray, n_faixas: int = 10) -> Decomposicao:
    """BS = confiabilidade − resolução + incerteza (Murphy, 1973).

    O `erro_binning` é a diferença entre o BS direto e o reconstruído pela
    decomposição. Não é zero porque a decomposição agrupa em faixas — reportar
    o resíduo evita confundir artefato de agrupamento com miscalibração.
    """
    p = np.asarray(p, float); y = np.asarray(y, float)
    n = y.size
    o_barra = float(y.mean())
    bordas = np.linspace(0.0, 1.0, n_faixas + 1)
    idx = np.clip(np.digitize(p, bordas) - 1, 0, n_faixas - 1)

    conf = res = 0.0
    for k in range(n_faixas):
        m = idx == k
        nk = int(m.sum())
        if nk == 0:
            continue
        conf += nk * (p[m].mean() - y[m].mean()) ** 2
        res += nk * (y[m].mean() - o_barra) ** 2
    conf /= n; res /= n
    inc = o_barra * (1 - o_barra)
    bs = float(np.mean((p - y) ** 2))
    return Decomposicao(bs, conf, res, inc, bs - (conf - res + inc))


def auc(p: np.ndarray, y: np.ndarray) -> float:
    """AUC por contagem de pares — sem dependência externa."""
    p = np.asarray(p, float); y = np.asarray(y, float)
    pos, neg = p[y == 1], p[y == 0]
    if pos.size == 0 or neg.size == 0:
        return float("nan")
    ordem = np.argsort(np.concatenate([pos, neg]), kind="mergesort")
    postos = np.empty(ordem.size, float)
    postos[ordem] = np.arange(1, ordem.size + 1)
    # empates recebem posto médio
    todos = np.concatenate([pos, neg])
    for v in np.unique(todos[np.concatenate([np.ones(pos.size, bool), np.ones(neg.size, bool)])]):
        m = todos == v
        if m.sum() > 1:
            postos[m] = postos[m].mean()
    return float((postos[:pos.size].sum() - pos.size * (pos.size + 1) / 2) / (pos.size * neg.size))


def relatorio(p: np.ndarray, y: np.ndarray, nome: str = "", n_faixas: int = 10) -> dict:
    d = decomposicao_brier(p, y, n_faixas)
    r = {
        "nome": nome, "n": int(np.size(y)),
        "media_prevista": float(np.mean(p)), "media_observada": float(np.mean(y)),
        "vies": float(np.mean(p) - np.mean(y)),
        "brier": d.brier, "confiabilidade": d.confiabilidade,
        "resolucao": d.resolucao, "incerteza": d.incerteza,
        "brier_skill": d.brier_skill, "auc": auc(p, y),
        "erro_binning": d.erro_binning,
    }
    return r


def imprimir(rs: list[dict]) -> None:
    print(f"{'':<22} {'n':>6} {'prev':>7} {'obs':>7} {'viés':>8} "
          f"{'Brier':>7} {'confiab':>8} {'resol':>7} {'AUC':>6}")
    print("-" * 84)
    for r in rs:
        print(f"{r['nome']:<22} {r['n']:>6} {r['media_prevista']:>7.1%} "
              f"{r['media_observada']:>7.1%} {r['vies']:>+8.1%} {r['brier']:>7.4f} "
              f"{r['confiabilidade']:>8.4f} {r['resolucao']:>7.4f} {r['auc']:>6.3f}")


if __name__ == "__main__":
    rng = np.random.default_rng(7)
    y = (rng.uniform(size=4000) < 0.55).astype(float)
    p = np.clip(0.42 + 0.25 * (y - 0.5) + rng.normal(0, .12, 4000), .02, .98)
    a = ajuste_intercepto(p, float(y.mean()))
    imprimir([relatorio(p, y, "antes"),
              relatorio(aplicar_intercepto(p, a), y, f"após intercepto a={a:+.3f}")])
