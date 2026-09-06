/**
 * Períodos do gráfico do papel.
 *
 * O seletor filtra a SÉRIE DE PREÇO, não a previsão. A distinção não é
 * detalhe: o modelo publica um horizonte só, doze meses
 * (`baseline-lognormal-v0`), e um seletor que parecesse trocar o horizonte da
 * probabilidade mostraria sete números onde existe um. Mudar o recorte do
 * gráfico não muda a previsão, e a tela precisa dizer isso.
 *
 * Três e cinco anos só aparecem ligados quando a série do papel chega lá.
 * Yahoo publica cinco anos; o mock local ainda gera doze meses. Apagar o
 * botão no papel curto faz o produto parecer menor; desligado, com o motivo,
 * diz que a lacuna é daquele papel e não da intenção. Copom entra no desenho
 * só nesses recortes longos: em um ano as reuniões (oito) viram ruído em cima
 * do preço; em três ou cinco anos elas são o ciclo da Selic.
 */

export type Periodo = {
  id: string;
  /** Curto, para caber na barra de passos: "3M" e não "3 meses". */
  rotulo: string;
  /** O nome inteiro, para o title e para leitor de tela. */
  nome: string;
  /** Pregões a manter, contados do fim da série. */
  pregoes: number;
};

/** 252 pregões é o ano de bolsa. O resto é proporção disso. */
const ANO = 252;

/** Abaixo disto o Copom não entra no gráfico — ver o comentário do topo. */
const PREGOES_COPOM = ANO;

export const PERIODOS: Periodo[] = [
  { id: "1m", rotulo: "1M", nome: "1 mês", pregoes: 21 },
  { id: "3m", rotulo: "3M", nome: "3 meses", pregoes: 63 },
  { id: "6m", rotulo: "6M", nome: "6 meses", pregoes: 126 },
  { id: "9m", rotulo: "9M", nome: "9 meses", pregoes: 189 },
  { id: "1a", rotulo: "1A", nome: "1 ano", pregoes: ANO },
  { id: "3a", rotulo: "3A", nome: "3 anos", pregoes: ANO * 3 },
  { id: "5a", rotulo: "5A", nome: "5 anos", pregoes: ANO * 5 },
];

export const PERIODO_PADRAO = "1a";

export function ehPeriodo(v: string): boolean {
  return PERIODOS.some((p) => p.id === v);
}

/**
 * Recortes até um ano existem sempre: até o mock de 252 pregões os cobre.
 * Três e cinco anos pedem série de verdade; 85% do pedido basta — 252×5 é
 * 1260, e o Yahoo de cinco anos chega ~1248.
 */
export function periodoCabe(p: Periodo, nPregoes: number): boolean {
  if (p.pregoes <= ANO) return true;
  return nPregoes >= p.pregoes * 0.85;
}

export function periodosDisponiveis(nPregoes: number): Periodo[] {
  return PERIODOS.filter((p) => periodoCabe(p, nPregoes));
}

export function periodosIndisponiveis(nPregoes: number): Periodo[] {
  return PERIODOS.filter((p) => !periodoCabe(p, nPregoes));
}

export function mostraCopom(periodo: string): boolean {
  const p = PERIODOS.find((x) => x.id === periodo);
  return !!p && p.pregoes > PREGOES_COPOM;
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
