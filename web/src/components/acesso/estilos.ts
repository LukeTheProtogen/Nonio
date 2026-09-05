/**
 * Classes compartilhadas das telas de acesso.
 *
 * Vivem num módulo SEM "use client" de propósito. Todo export de um arquivo
 * marcado como cliente vira referência de cliente quando importado por um
 * Server Component — o valor não atravessa a fronteira, e uma constante de
 * string chega do outro lado como função. O sintoma é silencioso: a `className`
 * recebe a função inteira, nenhuma classe aplica, e o elemento cai no display
 * padrão sem erro nenhum no console.
 *
 * Regra prática: valor compartilhado entre servidor e cliente mora em módulo
 * neutro. "use client" é para componente, não para constante.
 */

export const botaoPrimario =
  "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md bg-modelo px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-modelo-forte disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo";

export const botaoNeutro =
  "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-rule bg-background px-5 text-[14.5px] font-semibold text-ink shadow-[0_1px_2px_rgba(14,22,22,.04)] transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo";

export function entrada(erro?: boolean): string {
  return [
    "h-11 w-full rounded-md border px-3.5 text-[14.5px] outline-none",
    "placeholder:text-referencia",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo",
    erro ? "border-negativo" : "border-rule focus-visible:border-modelo",
  ].join(" ");
}

export function caixaCodigo(erro?: boolean): string {
  return [
    "h-14 w-12 rounded-md border text-center font-mono text-[22px] outline-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo",
    erro ? "border-negativo text-negativo" : "border-rule focus-visible:border-modelo",
  ].join(" ");
}
