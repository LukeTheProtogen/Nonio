"""Métricas de erro, calibração e probabilidade.

Funções puras sobre arrays. Sem I/O, sem estado — para poderem ser testadas
contra casos de resposta conhecida. O alinhamento previsão × realizado fica em
`backtest.py`; aqui só a matemática.

Referências do formulário: seções 02 (erro pontual), 03 (probabilidade e
calibração) e 01 (estatística do consenso).
"""
from __future__ import annotations

from dataclasses import dataclass
from math import erf, exp, log, pi, sqrt

import numpy as np

SQRT2 = sqrt(2.0)


# ── normal ──────────────────────────────────────────────────────────────────

def phi(x: np.ndarray | float) -> np.ndarray:
    """Densidade da normal padrão."""
    x = np.asarray(x, dtype=float)
    return np.exp(-0.5 * x * x) / sqrt(2 * pi)


def Phi(x: np.ndarray | float) -> np.ndarray:
    """Acumulada da normal padrão, via erf (sem dependência de scipy)."""
    x = np.asarray(x, dtype=float)
    return 0.5 * (1.0 + np.vectorize(erf)(x / SQRT2))


def Phi_inv(p: np.ndarray | float) -> np.ndarray:
    """Inversa da normal padrão — aproximação racional de Acklam.

    Erro relativo abaixo de 1,15e-9 em (0,1). Basta de sobra para quantis
    exibidos com duas casas.
    """
    p = np.asarray(p, dtype=float)
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
         3.754408661907416e+00]
    plow, phigh = 0.02425, 1 - 0.02425
    out = np.empty_like(p)

    lo = p < plow
    if lo.any():
        q = np.sqrt(-2 * np.log(p[lo]))
        out[lo] = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                  ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    hi = p > phigh
    if hi.any():
        q = np.sqrt(-2 * np.log(1 - p[hi]))
        out[hi] = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / \
                   ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1)
    mid = ~(lo | hi)
    if mid.any():
        q = p[mid] - 0.5
        r = q * q
        out[mid] = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / \
                   (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)
    return out


# ── 02 · erro pontual ───────────────────────────────────────────────────────

def me(y: np.ndarray, f: np.ndarray) -> float:
    """Erro médio. Retém o sinal: mede VIÉS, não tamanho."""
    return float(np.mean(np.asarray(y) - np.asarray(f)))


def mae(y: np.ndarray, f: np.ndarray) -> float:
    return float(np.mean(np.abs(np.asarray(y) - np.asarray(f))))


def rmse(y: np.ndarray, f: np.ndarray) -> float:
    d = np.asarray(y) - np.asarray(f)
    return float(sqrt(np.mean(d * d)))


def skill_score(rmse_modelo: float, rmse_referencia: float) -> float:
    """S = 1 − RMSE_m/RMSE_ref. S=0,18 lê-se '18% melhor que a referência'.

    S negativo é publicado, não escondido — é o ponto do produto.
    """
    if rmse_referencia <= 0:
        return float("nan")
    return 1.0 - rmse_modelo / rmse_referencia


# ── 02 · Mincer-Zarnowitz ───────────────────────────────────────────────────

@dataclass(frozen=True)
class MZ:
    alfa: float
    beta: float
    ep_alfa: float
    ep_beta: float
    t_beta_igual_1: float
    n: int
    lags_hac: int

    @property
    def leitura(self) -> str:
        if abs(self.t_beta_igual_1) < 1.96:
            return "β indistinguível de 1: sem viés de escala detectável"
        return ("β<1: o consenso exagera o movimento" if self.beta < 1
                else "β>1: subreação — quando projeta alto, o realizado vem ainda mais alto")


def mincer_zarnowitz(y: np.ndarray, f: np.ndarray, lags: int | None = None) -> MZ:
    """Regride realizado sobre previsto: y = α + β·f + u.  H₀: α=0 e β=1.

    Erros-padrão por Newey-West (HAC): com horizontes sobrepostos os resíduos
    são autocorrelados, e o erro-padrão de OLS simples sairia pequeno demais —
    a regressão pareceria significativa quando não é.
    """
    y = np.asarray(y, float); f = np.asarray(f, float)
    n = y.size
    X = np.column_stack([np.ones(n), f])
    XtX_inv = np.linalg.inv(X.T @ X)
    beta_hat = XtX_inv @ (X.T @ y)
    u = y - X @ beta_hat

    L = lags if lags is not None else max(1, int(np.floor(4 * (n / 100) ** (2 / 9))))
    S = (X * u[:, None]).T @ (X * u[:, None])
    for l in range(1, L + 1):
        w = 1.0 - l / (L + 1.0)                     # núcleo de Bartlett
        A = (X[l:] * u[l:, None]).T @ (X[:-l] * u[:-l, None])
        S += w * (A + A.T)
    V = XtX_inv @ S @ XtX_inv
    ep = np.sqrt(np.diag(V))
    return MZ(float(beta_hat[0]), float(beta_hat[1]), float(ep[0]), float(ep[1]),
              float((beta_hat[1] - 1.0) / ep[1]), n, L)


# ── 03 · probabilidade e calibração ─────────────────────────────────────────

def prob_acima(limiar: float, mediana: np.ndarray, desvio: np.ndarray) -> np.ndarray:
    """P(y > limiar) sob normal com a mediana e o desvio que o BC divulga.

    O Focus NÃO publica probabilidade — ele publica mediana e desvio. Esta é a
    ponte, e o produto precisa dizer isso na tela: a probabilidade implícita é
    uma leitura nossa da dispersão publicada, não um número do Banco Central.
    """
    m = np.asarray(mediana, float); s = np.asarray(desvio, float)
    return np.where(s > 0, 1.0 - Phi((limiar - m) / np.where(s > 0, s, 1.0)), np.nan)


def quantis(mediana: float, desvio: float, taus=(0.05, 0.25, 0.75, 0.95)) -> dict:
    """Quantis da normal implícita no consenso. Base para q05/q25/q75/q95."""
    return {f"q{int(t*100):02d}": float(mediana + desvio * Phi_inv(t)) for t in taus}


def brier(p: np.ndarray, o: np.ndarray) -> float:
    """BS = média (p − o)². Zero é perfeito."""
    p = np.asarray(p, float); o = np.asarray(o, float)
    return float(np.mean((p - o) ** 2))


def brier_skill(bs: float, bs_referencia: float) -> float:
    return float("nan") if bs_referencia <= 0 else 1.0 - bs / bs_referencia


def confiabilidade(p: np.ndarray, o: np.ndarray, n_faixas: int = 10) -> list[dict]:
    """Diagrama de confiabilidade: 'dissemos X%, aconteceu Y%'.

    Faixas largas de propósito — com poucas observações, faixa fina produz
    ruído com cara de miscalibração.
    """
    p = np.asarray(p, float); o = np.asarray(o, float)
    bordas = np.linspace(0.0, 1.0, n_faixas + 1)
    idx = np.clip(np.digitize(p, bordas) - 1, 0, n_faixas - 1)
    saida = []
    for k in range(n_faixas):
        m = idx == k
        if not m.any():
            continue
        n = int(m.sum())
        freq = float(o[m].mean())
        saida.append({
            "faixa": f"{bordas[k]:.0%}–{bordas[k+1]:.0%}",
            "dissemos": float(p[m].mean()),
            "aconteceu": freq,
            "n": n,
            # ±1,96 erro-padrão binomial: sem isso, desvio de amostra pequena
            # é lido como miscalibração.
            "ep": float(1.96 * sqrt(max(freq * (1 - freq), 1e-12) / n)),
        })
    return saida


# ── 01 · nuvem do consenso ──────────────────────────────────────────────────

def nuvem(mediana: float, desvio: float, minimo: float, maximo: float,
          n: int, seed: int = 42) -> np.ndarray:
    """Reconstrói ~n respostas como normal truncada em [mínimo, máximo].

    O Focus publica só os resumos; a nuvem é uma RECONSTRUÇÃO plausível, não os
    dados originais — e a interface tem que dizer isso. Seed fixa para que a
    mesma entrada gere sempre a mesma figura: nuvem que muda a cada render
    parece dado novo chegando, o que seria mentira.
    """
    if not (n and n > 0) or not (desvio and desvio > 0):
        raise ValueError("nuvem exige n>0 e desvio>0 — ver coluna nuvem_reconstruivel")
    lo, hi = (minimo, maximo) if minimo is not None and maximo is not None else (-np.inf, np.inf)
    a, b = Phi((lo - mediana) / desvio), Phi((hi - mediana) / desvio)
    rng = np.random.default_rng(seed)
    u = rng.uniform(float(a), float(b), size=int(n))
    return mediana + desvio * Phi_inv(u)
