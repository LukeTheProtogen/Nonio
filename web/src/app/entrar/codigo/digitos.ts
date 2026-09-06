/**
 * Montagem do código, separada do componente para poder ser testada.
 *
 * Toda função aqui é pura: recebe o estado e devolve o próximo. Nenhuma lê
 * `digitos` de uma closure — foi exatamente isso que fazia o código montado
 * sair errado com digitação rápida.
 */
export const CASAS = 6;

export type Estado = string[];

export const vazio = (): Estado => Array(CASAS).fill("");

/** Escreve a partir da casa `i`. Digitar substitui; colar espalha. */
export function preencher(atual: Estado, i: number, texto: string): Estado {
  const limpo = texto.replace(/\D/g, "");
  if (!limpo) return atual.map((v, k) => (k === i ? "" : v));
  const proximos = [...atual];
  for (let k = 0; k < limpo.length && i + k < CASAS; k++) proximos[i + k] = limpo[k];
  return proximos;
}

/** Onde o foco deve ficar depois de escrever. */
export function proximoFoco(i: number, texto: string): number {
  const limpo = texto.replace(/\D/g, "");
  if (!limpo) return i;
  return Math.min(i + limpo.length, CASAS - 1);
}

/** Backspace: casa cheia apaga ali; vazia volta uma e apaga lá. */
export function apagar(atual: Estado, i: number): { estado: Estado; foco: number } {
  const alvo = atual[i] ? i : Math.max(i - 1, 0);
  return { estado: atual.map((v, k) => (k === alvo ? "" : v)), foco: alvo };
}

export const completo = (e: Estado) => e.join("").length === CASAS;
