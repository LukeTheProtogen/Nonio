import demoJson from "@/data/demo.json";
import type { Cotacao } from "@/lib/brapi";

/**
 * Modo demonstração.
 *
 * Por quê: a apresentação não pode depender do Wi-Fi do evento, do horário de
 * pregão nem de a API de terceiro estar de pé. Fora do pregão a cotação vem do
 * fechamento anterior e alguém pergunta por que está "errada"; dentro do
 * pregão, uma falha da brapi derruba a demo no pior momento possível.
 *
 * Como: `?demo=1` na URL, ou NONIO_DEMO=1 no ambiente para deixar a instância
 * inteira congelada durante o ensaio. O snapshot é gerado por `make snapshot`
 * e versionado — é dado real, capturado numa data conhecida, não inventado.
 *
 * A regra que não se quebra: o modo aparece SEMPRE na resposta e na tela. Dado
 * congelado apresentado como ao vivo é exatamente o tipo de desonestidade que
 * este produto existe para não cometer.
 */

export type Snapshot = {
  capturadoEm: string;
  cotacoes: Cotacao[];
};

export const snapshot = demoJson as Snapshot;

/** Liga por query string (`?demo=1`) ou por ambiente (NONIO_DEMO=1). */
export function ehDemo(url?: string): boolean {
  if (process.env.NONIO_DEMO === "1") return true;
  if (!url) return false;
  const v = new URL(url).searchParams.get("demo");
  return v === "1" || v === "true";
}

export function cotacoesCongeladas(tickers: string[]): Cotacao[] {
  const querido = new Set(tickers.map((t) => t.toUpperCase()));
  return snapshot.cotacoes.filter((c) => querido.has(c.ticker.toUpperCase()));
}
