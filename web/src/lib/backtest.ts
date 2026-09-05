import backtestJson from "@/data/backtest.json";

/**
 * Backtest do consenso — DADO REAL, publicado por `pipeline/nonio/backtest.py`.
 *
 * Atenção ao que este arquivo mede: o erro do CONSENSO do Focus contra o
 * realizado, comparado a dois modelos bobos (repetir o último valor e cravar a
 * meta). Ele ainda NÃO tem uma coluna nossa, porque o modelo não publicou
 * previsão. Qualquer tela que apresente estes números como "nosso acerto" está
 * mentindo — e é justamente o tipo de erro que este produto existe para não
 * cometer.
 *
 * O que dá para afirmar hoje, com número medido: quanto o consenso erra, por
 * horizonte, e que a probabilidade implícita nele é mal calibrada.
 */

export type Confiabilidade = {
  faixa: string;
  /** Probabilidade média que o consenso implicava nesta faixa. */
  dissemos: number;
  /** Frequência com que o evento realmente aconteceu. */
  aconteceu: number;
  n: number;
  ep: number;
};

export type Horizonte = {
  horizonte_meses: number;
  n: number;
  periodo: [string, string];
  consenso: { me: number; mae: number; rmse: number };
  ingenuo: { mae: number; rmse: number };
  meta: { mae: number; rmse: number };
  skill_consenso_vs_ingenuo: number;
  skill_consenso_vs_meta: number;
  mincer_zarnowitz: {
    alfa: number;
    beta: number;
    ep_alfa: number;
    ep_beta: number;
    t_beta_igual_1: number;
    lags_hac: number;
    leitura: string;
  };
  evento_acima_teto: {
    brier: number;
    brier_climatologia: number;
    brier_skill: number;
    frequencia_base: number;
    confiabilidade: Confiabilidade[];
  };
};

export type FotoAtual = {
  data: string;
  linhas: {
    ano: number;
    horizonte_meses: number;
    consenso: { mediana: number; media: number; dp: number; min: number; max: number; n: number };
    quantis_implicitos: { q05: number; q25: number; q75: number; q95: number };
    teto: number;
    meta: number;
    p_acima_teto: number;
    nuvem_reconstruivel: boolean;
  }[];
};

const dados = backtestJson as unknown as {
  gerado_em: string;
  indicador: string;
  base_calculo: number;
  por_horizonte: Horizonte[];
  foto_atual: FotoAtual;
};

export const geradoEm = dados.gerado_em;
export const indicador = dados.indicador;
/** 0, travado. Amostra sobre recência — ver README da raiz. Nunca misturar. */
export const baseCalculo = dados.base_calculo;
export const fotoAtual = dados.foto_atual;

/** Horizontes exibidos na interface. A base guarda 18 e 24 também. */
export const HORIZONTES_EXIBIDOS = [1, 3, 6, 9, 12] as const;

export function porHorizonte(meses: number): Horizonte | undefined {
  return dados.por_horizonte.find((h) => h.horizonte_meses === meses);
}

export function horizontesExibidos(): Horizonte[] {
  return HORIZONTES_EXIBIDOS.map(porHorizonte).filter((h): h is Horizonte => Boolean(h));
}

/**
 * As faixas de confiabilidade com amostra grande o bastante para significar
 * alguma coisa. Faixa com n baixo vira ruído com aparência de achado.
 */
export function confiabilidadeUtil(h: Horizonte, nMinimo = 20): Confiabilidade[] {
  return h.evento_acima_teto.confiabilidade.filter((c) => c.n >= nMinimo);
}
