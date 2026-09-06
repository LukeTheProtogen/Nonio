/**
 * Universo de ações — PARCIALMENTE MOCK. Ver `src/mock/README.md`.
 *
 * Real hoje: cotação (brapi, via /api/painel) e probabilidade de 12 meses
 * (pipeline, em src/data/previsoes.json).
 *
 * Mock aqui: retorno acumulado, risco, sensibilidade macro e fatos relevantes.
 * Nenhum desses é publicado pelo pipeline ainda.
 *
 * O universo segue a decisão travada do README da raiz: 15 a 20 papéis do
 * Ibovespa. Sem token da brapi só quatro respondem — PETR4, VALE3, ITUB4 e
 * MGLU3 — e por isso eles vêm primeiro: são os que têm cotação de verdade.
 */

export type Acao = {
  ticker: string;
  nome: string;
  setor: string;
  /** true quando a brapi responde sem token. Os demais dependem de BRAPI_TOKEN. */
  cotacaoLivre: boolean;

  // ---- retorno (MOCK) — 12 meses, dividendos e JCP incluídos
  retorno12m: number;
  acimaDoCdi: number;

  // ---- risco (MOCK)
  vol12m: number;
  beta: number;
  /*
   * Pior queda e dias até o pico NÃO ficam aqui. Saem medidos da série de
   * `mock/serie.ts`, que é gerada a partir de `vol12m` e `retorno12m`. Como
   * campo solto eles acabariam contradizendo o gráfico que a janela desenha,
   * e a tabela e o gráfico discordando sobre a mesma queda é defeito visível.
   */

  // ---- contexto (MOCK) — regressão de fatores de 3 anos
  sensJuros100bp: number;
  sensDolar1pct: number;
  sensBrent10pct: number;
  fatos30d: number;
};

/** CDI acumulado em 12 meses. MOCK — sai do SGS 12 quando o pipeline publicar. */
export const CDI_12M = 10.5;

export const ACOES: Acao[] = [
  { ticker: "PETR4", nome: "Petrobras", setor: "Petróleo e gás", cotacaoLivre: true,
    retorno12m: 24.1, acimaDoCdi: 13.6, vol12m: 28, beta: 1.08,
    sensJuros100bp: -1.9, sensDolar1pct: 0.4, sensBrent10pct: 5.8, fatos30d: 3 },
  { ticker: "VALE3", nome: "Vale", setor: "Mineração", cotacaoLivre: true,
    retorno12m: 6.3, acimaDoCdi: -4.2, vol12m: 26, beta: 0.94,
    sensJuros100bp: -1.1, sensDolar1pct: 0.7, sensBrent10pct: 1.1, fatos30d: 1 },
  { ticker: "ITUB4", nome: "Itaú Unibanco", setor: "Bancos", cotacaoLivre: true,
    retorno12m: 19.8, acimaDoCdi: 9.3, vol12m: 21, beta: 0.88,
    sensJuros100bp: -2.4, sensDolar1pct: -0.5, sensBrent10pct: 0.1, fatos30d: 2 },
  { ticker: "MGLU3", nome: "Magazine Luiza", setor: "Varejo", cotacaoLivre: true,
    retorno12m: -18.4, acimaDoCdi: -28.9, vol12m: 52, beta: 1.42,
    sensJuros100bp: -6.1, sensDolar1pct: -0.9, sensBrent10pct: -1.4, fatos30d: 4 },

  // Dependem de BRAPI_TOKEN para ter cotação. Os scores continuam visíveis.
  { ticker: "ELET3", nome: "Eletrobras", setor: "Energia elétrica", cotacaoLivre: false,
    retorno12m: 22.5, acimaDoCdi: 12.0, vol12m: 25, beta: 0.81,
    sensJuros100bp: -4.6, sensDolar1pct: -0.2, sensBrent10pct: 0.3, fatos30d: 2 },
  { ticker: "EQTL3", nome: "Equatorial", setor: "Energia elétrica", cotacaoLivre: false,
    retorno12m: 17.9, acimaDoCdi: 7.4, vol12m: 22, beta: 0.74,
    sensJuros100bp: -4.9, sensDolar1pct: -0.3, sensBrent10pct: 0.2, fatos30d: 0 },
  { ticker: "PRIO3", nome: "PRIO", setor: "Petróleo e gás", cotacaoLivre: false,
    retorno12m: 15.4, acimaDoCdi: 4.9, vol12m: 35, beta: 1.05,
    sensJuros100bp: -1.4, sensDolar1pct: 0.6, sensBrent10pct: 7.2, fatos30d: 2 },
  { ticker: "WEGE3", nome: "WEG", setor: "Bens de capital", cotacaoLivre: false,
    retorno12m: 9.7, acimaDoCdi: -0.8, vol12m: 24, beta: 0.72,
    sensJuros100bp: -3.8, sensDolar1pct: 0.9, sensBrent10pct: -0.4, fatos30d: 0 },
  { ticker: "SUZB3", nome: "Suzano", setor: "Papel e celulose", cotacaoLivre: false,
    retorno12m: 4.8, acimaDoCdi: -5.7, vol12m: 27, beta: 0.66,
    sensJuros100bp: 0.6, sensDolar1pct: 1.4, sensBrent10pct: 0.8, fatos30d: 1 },
  { ticker: "RENT3", nome: "Localiza", setor: "Aluguel de veículos", cotacaoLivre: false,
    retorno12m: 3.2, acimaDoCdi: -7.3, vol12m: 33, beta: 1.21,
    sensJuros100bp: -5.2, sensDolar1pct: -0.6, sensBrent10pct: -1.2, fatos30d: 1 },
  { ticker: "RADL3", nome: "Raia Drogasil", setor: "Varejo de saúde", cotacaoLivre: false,
    retorno12m: -2.1, acimaDoCdi: -12.6, vol12m: 29, beta: 0.92,
    sensJuros100bp: -3.3, sensDolar1pct: -0.4, sensBrent10pct: -0.5, fatos30d: 1 },
  { ticker: "BBAS3", nome: "Banco do Brasil", setor: "Bancos", cotacaoLivre: false,
    retorno12m: -6.4, acimaDoCdi: -16.9, vol12m: 30, beta: 1.12,
    sensJuros100bp: -3.1, sensDolar1pct: -0.3, sensBrent10pct: 0.2, fatos30d: 4 },
  { ticker: "HAPV3", nome: "Hapvida", setor: "Saúde", cotacaoLivre: false,
    retorno12m: -14.8, acimaDoCdi: -25.3, vol12m: 48, beta: 1.35,
    sensJuros100bp: -2.7, sensDolar1pct: -0.7, sensBrent10pct: -0.9, fatos30d: 5 },
  { ticker: "ABEV3", nome: "Ambev", setor: "Bebidas", cotacaoLivre: false,
    retorno12m: 11.2, acimaDoCdi: 0.7, vol12m: 19, beta: 0.58,
    sensJuros100bp: -2.0, sensDolar1pct: -1.1, sensBrent10pct: -0.3, fatos30d: 0 },
  { ticker: "BBDC4", nome: "Bradesco", setor: "Bancos", cotacaoLivre: false,
    retorno12m: 8.4, acimaDoCdi: -2.1, vol12m: 27, beta: 1.04,
    sensJuros100bp: -2.8, sensDolar1pct: -0.4, sensBrent10pct: 0.1, fatos30d: 2 },
  { ticker: "B3SA3", nome: "B3", setor: "Serviços financeiros", cotacaoLivre: false,
    retorno12m: 1.6, acimaDoCdi: -8.9, vol12m: 31, beta: 1.18,
    sensJuros100bp: -4.4, sensDolar1pct: -0.8, sensBrent10pct: -0.2, fatos30d: 1 },
];

/**
 * As três lentes da tabela.
 *
 * Uma pergunta por vista. É o mesmo gesto dos três passos da janela do papel,
 * então a estrutura se aprende uma vez só. O que não cabe numa lente vai para a
 * página do papel — nada é escondido, é realocado.
 */
export const LENTES = {
  retorno: {
    rotulo: "Retorno",
    descricao: "Quanto rendeu, contra o CDI do mesmo período. Dividendos e JCP incluídos.",
  },
  risco: {
    rotulo: "Risco",
    descricao: "O caminho que o retorno percorreu até chegar aqui.",
  },
  contexto: {
    rotulo: "Contexto",
    descricao: "O que move o papel, e o que aconteceu com ele nos últimos 30 dias.",
  },
} as const;

export type Lente = keyof typeof LENTES;

export function ehLente(v: string | undefined): v is Lente {
  return v === "retorno" || v === "risco" || v === "contexto";
}
