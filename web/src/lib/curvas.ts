/**
 * Geometria dos gráficos-assinatura.
 *
 * Escrito à mão em SVG de propósito: a curva de distribuição é a identidade
 * visual do produto e não deve virar chamada de biblioteca genérica. ECharts
 * entra onde o volume de pontos justifica, não aqui.
 *
 * Regras de desenho que valem para tudo:
 *   consenso é ÁREA, modelo é LINHA — a distinção de forma vem antes da de cor,
 *   para o gráfico continuar legível impresso em preto e branco;
 *   referência (meta, CDI, diagonal) é tracejada e cinza, nunca cor de marca;
 *   sem grade de fundo: só linha de base e tiques.
 */

export type Escala = {
  /** domínio no eixo x, em unidade do indicador */
  x0: number;
  x1: number;
  /** faixa em pixels */
  px0: number;
  px1: number;
};

export function emX(v: number, e: Escala): number {
  return e.px0 + ((e.px1 - e.px0) * (v - e.x0)) / (e.x1 - e.x0);
}

function densidade(x: number, mu: number, dp: number): number {
  return Math.exp(-0.5 * ((x - mu) / dp) ** 2) / (dp * Math.SQRT2 * Math.sqrt(Math.PI));
}

/**
 * Caminho SVG de uma normal.
 *
 * `picoRef` deixa duas curvas na mesma altura relativa: sem ele, a mais estreita
 * fica gigante e o leitor conclui que ela é "maior", o que não significa nada.
 */
export function caminhoNormal(
  mu: number,
  dp: number,
  e: Escala,
  base: number,
  altura: number,
  opcoes: { picoRef?: number; assimetria?: number; passos?: number } = {},
): { linha: string; area: string } {
  const { picoRef, assimetria = 0, passos = 140 } = opcoes;
  const pico = picoRef ?? densidade(mu, mu, dp);
  const pontos: [number, number][] = [];

  for (let i = 0; i <= passos; i++) {
    const x = e.x0 + ((e.x1 - e.x0) * i) / passos;
    let d = densidade(x, mu, dp);
    if (assimetria) {
      // Skew-normal: multiplica pela CDF deslocada. Serve para a curva do
      // modelo ter cauda para o lado do risco, como o modelo de fato tem.
      const z = (x - mu) / dp;
      d *= 2 * cdfNormal(assimetria * z);
    }
    pontos.push([emX(x, e), base - (altura * d) / pico]);
  }

  const linha = "M" + pontos.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  const area = `${linha} L${pontos[pontos.length - 1][0].toFixed(1)} ${base} L${pontos[0][0].toFixed(1)} ${base} Z`;
  return { linha, area };
}

/** Abramowitz-Stegun 7.1.26. Sete casas, suficiente para desenho e exibição. */
export function cdfNormal(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Posições dos pontos da nuvem, espalhados em y com semente fixa. */
export function dispersao(
  valores: number[],
  e: Escala,
  yTopo: number,
  yBase: number,
): { cx: number; cy: number }[] {
  let semente = 7;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };
  return valores.map((v) => ({
    cx: emX(v, e),
    cy: yTopo + aleatorio() * (yBase - yTopo),
  }));
}

/** Tiques do eixo, sempre terminando em rótulo com unidade. */
export function tiques(e: Escala, passo: number): { px: number; valor: number }[] {
  const saida: { px: number; valor: number }[] = [];
  const inicio = Math.ceil(e.x0 / passo) * passo;
  for (let v = inicio; v <= e.x1 + 1e-9; v += passo) {
    saida.push({ px: emX(v, e), valor: Number(v.toFixed(4)) });
  }
  return saida;
}
