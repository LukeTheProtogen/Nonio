import previsoesJson from "@/data/previsoes.json";

/**
 * Previsões publicadas pelo pipeline. Entram no bundle em tempo de build:
 * cada rodada do pipeline commita, o commit dispara o deploy, e o dado servido
 * fica sempre casado com a versão publicada.
 *
 * O modelo NÃO vive aqui. O baseline e a regra de recálculo estão em
 * pipeline/nonio/probabilidade.py; esta camada só lê o que foi publicado e
 * calcula a distância até a cotação de agora.
 */

export type Previsao = {
  ticker: string;
  probabilidade: number;
  horizonte_meses: number;
  /** Preço no instante do cálculo. Sem ele não existe delta. */
  preco_referencia: number;
  vol_anual: number;
  /**
   * Quanto o preço precisa mover para a probabilidade mudar de forma
   * mensurável. Vem calculado POR ATIVO pelo pipeline — a interface não
   * recalcula, só compara, e assim as duas pontas não podem discordar.
   */
  limiar_recalculo: number;
  calculado_em: string;
  modelo_versao: string;
  gatilho: string;
};

const dados = previsoesJson as {
  geradoEm: string;
  modeloVersao: string;
  toleranciaPp: number;
  previsoes: Previsao[];
};

export const geradoEm = dados.geradoEm;
export const modeloVersao = dados.modeloVersao;
export const toleranciaPp = dados.toleranciaPp;

export function previsaoDe(ticker: string): Previsao | undefined {
  return dados.previsoes.find((p) => p.ticker === ticker.toUpperCase());
}

export function todasPrevisoes(): Previsao[] {
  return dados.previsoes;
}

function normCdf(x: number): number {
  // Abramowitz-Stegun 7.1.26 — 7 casas, suficiente para exibição.
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export type Delta = {
  variacao: number;
  /** Quanto essa variação deslocaria a probabilidade, em pontos percentuais. */
  deslocamentoPp: number;
  acimaDoLimiar: boolean;
  leitura: string;
};

/**
 * A distância entre a medição de agora e a previsão publicada.
 *
 * A probabilidade não se move sozinha: ela é do último cálculo, e o preço é de
 * agora. Mostrar a distância é mais honesto — e mais informativo — do que
 * recalcular a cada tick e produzir tremor sem sinal.
 *
 * Espelha prob_bater_cdi() de pipeline/nonio/probabilidade.py: baseline com
 * excesso esperado ZERO sobre o CDI. Se o modelo mudar lá, muda aqui.
 */
export function calcularDelta(precoAtual: number, p: Previsao): Delta {
  const variacao = (precoAtual - p.preco_referencia) / p.preco_referencia;
  const vol = p.vol_anual;

  // excesso esperado = 0: o baseline não afirma retorno, só volatilidade.
  const prob = (choque: number) =>
    normCdf((-Math.log(1 + choque) - 0.5 * vol * vol) / vol);

  const deslocamentoPp = (prob(variacao) - prob(0)) * 100;
  const acimaDoLimiar = Math.abs(variacao) >= p.limiar_recalculo;

  const pct = (variacao * 100).toFixed(2).replace(".", ",");
  const pp = deslocamentoPp.toFixed(1).replace(".", ",");
  const lim = (p.limiar_recalculo * 100).toFixed(2).replace(".", ",");

  const leitura = acimaDoLimiar
    ? `${pct}% desde o cálculo — deslocaria a probabilidade em ${pp} pp, acima do limiar de ${lim}% deste ativo: recálculo justificado`
    : `${pct}% desde o cálculo — deslocaria a probabilidade em ${pp} pp, abaixo do limiar de ${lim}% deste ativo`;

  return { variacao, deslocamentoPp, acimaDoLimiar, leitura };
}
