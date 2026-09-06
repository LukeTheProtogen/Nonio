/**
 * Formatação pt-BR para números que aparecem na tela.
 *
 * Centralizado porque número financeiro mal formatado é erro de leitura, não de
 * estilo: "4.35" e "4,35" são valores diferentes para quem lê em português, e
 * misturar as duas grafias na mesma tela destrói a confiança no dado.
 *
 * Toda saída daqui é usada junto de `font-mono` + `.tabular` — sem isso as
 * colunas dançam a cada atualização de cotação.
 */

const nf = (min: number, max = min) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

/** 4,62 — sem unidade. */
export function num(v: number, casas = 2): string {
  return nf(casas).format(v);
}

/** 4,62% — a unidade da maioria dos indicadores. */
export function pct(v: number, casas = 2): string {
  return `${nf(casas).format(v)}%`;
}

/**
 * +13,6 p.p. — ponto percentual, com sinal.
 * A diferença entre 4,3% e 5,3% é de um ponto percentual, não de um por cento.
 */
export function pp(v: number, casas = 1): string {
  return `${sinal(v)}${nf(casas).format(Math.abs(v))} p.p.`;
}

/** +1,2% — variação com sinal explícito, inclusive o menos tipográfico. */
export function pctSinal(v: number, casas = 1): string {
  return `${sinal(v)}${nf(casas).format(Math.abs(v))}%`;
}

/** R$ 12.410 */
export function moeda(v: number, casas = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(v);
}

/** 61% — probabilidade vinda em fração (0,61). */
export function probabilidade(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

/** Menos tipográfico, não hífen. O hífen quebra o alinhamento tabular. */
function sinal(v: number): string {
  if (v > 0) return "+";
  if (v < 0) return "−";
  return "";
}

/** Classe semântica do delta. Verde e vermelho só aqui, nunca como marca. */
export function corDelta(v: number): string {
  if (v > 0) return "text-positivo";
  if (v < 0) return "text-negativo";
  return "text-ink-soft";
}

/** 31-08 */
export function dataCurta(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/** 31-08-2026 */
export function dataLonga(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/** 17:32 — o horário da última medição precisa estar sempre à vista. */
export function hora(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

/**
 * "há 12 dias" — usado para marcar dado atrasado.
 * Atraso é aviso, não erro: a tela mostra o último dado bom com a idade à
 * vista, em vez de esconder que a fonte não atualizou.
 */
export function idadeEmDias(iso: string, agora = new Date()): number {
  const d = new Date(iso);
  return Math.floor((agora.getTime() - d.getTime()) / 86_400_000);
}
