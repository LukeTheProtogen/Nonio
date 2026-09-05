import { z } from "zod";

/**
 * Cliente da brapi (cotações B3).
 *
 * O token NUNCA vai para o browser: este módulo só é importado por Route
 * Handlers e Server Components. Sem BRAPI_TOKEN o app continua funcionando,
 * limitado aos quatro tickers gratuitos — é assim que a demo roda sem chave.
 */

/** Respondem sem token e sem consumir cota. Verificado em 04-09-2026. */
export const TICKERS_LIVRES = ["PETR4", "VALE3", "ITUB4", "MGLU3"] as const;

const BASE = "https://brapi.dev/api/quote";

const RespostaBrapi = z.object({
  results: z
    .array(
      z.object({
        symbol: z.string(),
        shortName: z.string().nullish(),
        regularMarketPrice: z.number().nullish(),
        regularMarketChangePercent: z.number().nullish(),
        regularMarketTime: z.string().nullish(),
        currency: z.string().nullish(),
      }),
    )
    .nullish(),
  error: z.unknown().nullish(),
  message: z.string().nullish(),
});

export type Cotacao = {
  ticker: string;
  nome: string | null;
  preco: number | null;
  variacaoPct: number | null;
  moeda: string | null;
  /** Quando a bolsa registrou o preço — precisa aparecer na tela. */
  atualizadoEm: string | null;
};

export function temToken(): boolean {
  return Boolean(process.env.BRAPI_TOKEN);
}

/**
 * Busca vários tickers numa única requisição — a própria brapi recomenda
 * agrupar, e é o que mantém o consumo dentro das 15.000 chamadas/mês do plano
 * gratuito. Cinco ativos a cada 15 min em pregão dão ~7.000/mês.
 */
export async function buscarCotacoes(tickers: string[]): Promise<Cotacao[]> {
  const token = process.env.BRAPI_TOKEN;
  const pedidos = token
    ? tickers
    : tickers.filter((t) =>
        (TICKERS_LIVRES as readonly string[]).includes(t.toUpperCase()),
      );

  if (pedidos.length === 0) return [];

  const url = new URL(`${BASE}/${pedidos.join(",")}`);
  if (token) url.searchParams.set("token", token);

  const r = await fetch(url, {
    // Revalidação de 15 min: o dado da brapi é intradiário com atraso, então
    // buscar a cada page view não deixa nada mais novo — só gasta cota.
    next: { revalidate: 900 },
  });

  if (!r.ok) throw new Error(`brapi respondeu ${r.status}`);

  const dados = RespostaBrapi.parse(await r.json());
  if (dados.error) throw new Error(`brapi: ${dados.message ?? "erro"}`);

  return (dados.results ?? []).map((c) => ({
    ticker: c.symbol,
    nome: c.shortName ?? null,
    preco: c.regularMarketPrice ?? null,
    variacaoPct: c.regularMarketChangePercent ?? null,
    moeda: c.currency ?? null,
    atualizadoEm: c.regularMarketTime ?? null,
  }));
}
