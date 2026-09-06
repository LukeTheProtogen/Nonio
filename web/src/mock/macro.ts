/**
 * Painel macro — MOCK. Ver `src/mock/README.md`.
 *
 * O pipeline já normaliza o consenso do Focus, mas ainda não publica um JSON
 * por indicador com a nossa previsão ao lado. Enquanto isso não existe, estes
 * valores são ilustrativos e a tela diz isso.
 *
 * A `foto_atual` do backtest real (src/data/backtest.json) traz mediana, média,
 * desvio-padrão, mínimo, máximo e n para o IPCA — quando `nonio.prever`
 * publicar o resto, é daqui que sai a substituição, campo por campo.
 */

export type Indicador = {
  slug: string;
  nome: string;
  /** O evento sobre o qual a probabilidade é calculada. */
  evento: string;
  unidade: "pct" | "brl";
  consenso: {
    mediana: number;
    media: number;
    dp: number;
    min: number;
    max: number;
    n: number;
    /** Probabilidade do evento implícita na dispersão publicada pelo BCB. */
    pEvento: number;
  };
  modelo: {
    mediana: number;
    /** Faixa de 80%: onde há 80% de chance de o número cair. */
    q10: number;
    q90: number;
    pEvento: number;
  };
  /**
   * Falso antes de 02-01-2014, quando o Focus passou a publicar
   * `numeroRespondentes`. Sem ele a nuvem de pontos não pode ser reconstruída,
   * e a tela mostra a faixa mínimo–máximo dizendo por quê.
   */
  nuvemReconstruivel: boolean;
};

export const INDICADORES: Indicador[] = [
  {
    slug: "ipca-2026",
    nome: "IPCA 2026",
    evento: "acima de 4,5%",
    unidade: "pct",
    consenso: { mediana: 4.35, media: 4.38, dp: 0.28, min: 3.8, max: 5.2, n: 118, pEvento: 0.3 },
    modelo: { mediana: 4.62, q10: 4.21, q90: 5.04, pEvento: 0.61 },
    nuvemReconstruivel: true,
  },
  {
    slug: "ipca-2027",
    nome: "IPCA 2027",
    evento: "acima de 4,5%",
    unidade: "pct",
    consenso: { mediana: 3.9, media: 3.94, dp: 0.35, min: 3.1, max: 4.9, n: 104, pEvento: 0.04 },
    modelo: { mediana: 4.05, q10: 3.52, q90: 4.61, pEvento: 0.13 },
    nuvemReconstruivel: true,
  },
  {
    slug: "selic-2026",
    nome: "Selic fim de 2026",
    evento: "abaixo de 14%",
    unidade: "pct",
    consenso: { mediana: 14.25, media: 14.22, dp: 0.45, min: 13.0, max: 15.25, n: 96, pEvento: 0.29 },
    modelo: { mediana: 14.5, q10: 14.02, q90: 15.01, pEvento: 0.11 },
    nuvemReconstruivel: true,
  },
  {
    slug: "cambio-2026",
    nome: "Dólar fim de 2026",
    evento: "acima de R$ 6,00",
    unidade: "brl",
    consenso: { mediana: 5.6, media: 5.62, dp: 0.22, min: 5.05, max: 6.3, n: 91, pEvento: 0.03 },
    modelo: { mediana: 5.72, q10: 5.38, q90: 6.15, pEvento: 0.18 },
    nuvemReconstruivel: true,
  },
];

export function indicadorPorSlug(slug: string): Indicador | undefined {
  return INDICADORES.find((i) => i.slug === slug);
}

/** Data da coleta do Focus que alimenta o painel. MOCK. */
export const FOCUS_COLETADO_EM = "2026-08-31T11:25:00-03:00";

/** Base de cálculo travada em 0: amostra sobre recência. Ver README da raiz. */
export const BASE_CALCULO = 0;

export type Citacao = {
  trecho: string;
  ata: number;
  paragrafo: number;
  pagina: number;
  url: string;
};

/** Citações das atas — MOCK. O acervo das 280 atas ainda não foi processado. */
export const CITACOES: Citacao[] = [
  {
    trecho:
      "A depreciação cambial recente ainda não está integralmente refletida nos preços ao consumidor.",
    ata: 280,
    paragrafo: 14,
    pagina: 7,
    url: "https://www.bcb.gov.br/content/copom/atascopom/Copom280-not20260805280.pdf",
  },
  {
    trecho:
      "O Comitê julga apropriado manter a taxa de juros em patamar significativamente contracionista.",
    ata: 280,
    paragrafo: 21,
    pagina: 9,
    url: "https://www.bcb.gov.br/content/copom/atascopom/Copom280-not20260805280.pdf",
  },
  {
    trecho:
      "As expectativas de inflação para 2026 apuradas pela pesquisa Focus situam-se em torno de 4,3%.",
    ata: 280,
    paragrafo: 3,
    pagina: 2,
    url: "https://www.bcb.gov.br/content/copom/atascopom/Copom280-not20260805280.pdf",
  },
];

/**
 * Reconstrói a nuvem de pontos a partir dos agregados publicados.
 *
 * O Focus divulga estatística agregada, nunca as projeções individuais. Isto
 * amostra uma normal truncada entre mínimo e máximo com a média e o desvio
 * informados, e a semente é fixa para o desenho não mudar a cada render.
 *
 * Os pontos representam a FORMA da discordância, não instituições específicas —
 * e a tela precisa dizer isso, senão vira invenção apresentada como dado.
 */
export function reconstruirNuvem(c: Indicador["consenso"]): number[] {
  let semente = 42;
  const aleatorio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };

  const pontos: number[] = [c.min, c.max];
  while (pontos.length < c.n) {
    // Box-Muller, truncado na faixa publicada.
    const u1 = Math.max(aleatorio(), 1e-9);
    const u2 = aleatorio();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const v = c.media + z * c.dp;
    if (v >= c.min && v <= c.max) pontos.push(v);
  }
  return pontos;
}
