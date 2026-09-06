/**
 * Períodos do gráfico do papel.
 *
 * O seletor filtra a SÉRIE DE PREÇO, não a previsão. A distinção não é
 * detalhe: o modelo publica um horizonte só, doze meses
 * (`baseline-lognormal-v0`), e um seletor que parecesse trocar o horizonte da
 * probabilidade mostraria sete números onde existe um. Mudar o recorte do
 * gráfico não muda a previsão, e a tela precisa dizer isso.
 *
 * Três e cinco anos entram na lista DESLIGADOS, não são omitidos. Esconder o
 * que falta faz o produto parecer menor do que é e não explica nada; mostrar
 * apagado, com o motivo, diz que a lacuna é de dado e não de intenção. É o
 * mesmo tratamento das rotas "em breve" na barra lateral.
 */

export type Periodo = {
  id: string;
  rotulo: string;
  /** Pregões a manter, contados do fim da série. */
  pregoes: number;
};

/** 252 pregões é o ano de bolsa. O resto é proporção disso. */
const ANO = 252;

export const PERIODOS: Periodo[] = [
  { id: "1m", rotulo: "1 mês", pregoes: 21 },
  { id: "3m", rotulo: "3 meses", pregoes: 63 },
  { id: "6m", rotulo: "6 meses", pregoes: 126 },
  { id: "9m", rotulo: "9 meses", pregoes: 189 },
  { id: "1a", rotulo: "1 ano", pregoes: ANO },
];

/**
 * O que o pedido pede e o dado ainda não tem.
 *
 * A série publicada cobre um ano. Desenhar três ou cinco anos exigiria inventar
 * o que não foi medido, que é exatamente o que este produto não faz.
 */
export const PERIODOS_INDISPONIVEIS = [
  { id: "3a", rotulo: "3 anos" },
  { id: "5a", rotulo: "5 anos" },
] as const;

export const PERIODO_PADRAO = "1a";

export function ehPeriodo(v: string): boolean {
  return PERIODOS.some((p) => p.id === v);
}

/**
 * Recorta a série pelo fim.
 *
 * Sempre do fim para trás: o que interessa é o passado recente, e cortar pelo
 * começo mostraria um ano antigo com o preço de hoje faltando.
 */
export function recortar<T>(serie: T[], periodo: string): T[] {
  const p = PERIODOS.find((x) => x.id === periodo);
  if (!p) return serie;
  return serie.slice(Math.max(0, serie.length - p.pregoes));
}
