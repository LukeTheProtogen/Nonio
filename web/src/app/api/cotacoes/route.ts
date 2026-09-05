import { NextResponse } from "next/server";
import { buscarCotacoes, temToken, TICKERS_LIVRES } from "@/lib/brapi";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";

export const revalidate = 900;

/**
 * GET /api/cotacoes?tickers=PETR4,VALE3
 *
 * Sem BRAPI_TOKEN, responde só os tickers gratuitos e diz isso no corpo —
 * o front mostra o aviso em vez de uma tabela vazia sem explicação.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const pedidos = (params.get("tickers") ?? TICKERS_LIVRES.join(","))
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  try {
    const cotacoes = await buscarCotacoes(pedidos);
    return NextResponse.json({
      cotacoes,
      limitado: !temToken(),
      fonte: "brapi.dev",
      // O enquadramento viaja junto com o dado: quem consome a API — o
      // front, um parceiro, um script — recebe o mesmo aviso da tela.
      aviso: DISCLAIMER_MEDIO,
      buscadoEm: new Date().toISOString(),
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 502 },
    );
  }
}
