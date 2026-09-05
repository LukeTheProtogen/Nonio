import { NextResponse } from "next/server";
import { buscarCotacoes, temToken, TICKERS_LIVRES } from "@/lib/brapi";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";
import { cotacoesCongeladas, ehDemo, snapshot } from "@/lib/demo";

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

  const demo = ehDemo(request.url);

  try {
    // Em demo, nenhuma chamada externa acontece — nem para falhar.
    const cotacoes = demo ? cotacoesCongeladas(pedidos) : await buscarCotacoes(pedidos);
    return NextResponse.json({
      cotacoes,
      modo: demo ? "demo" : "ao-vivo",
      congeladoEm: demo ? snapshot.capturadoEm : null,
      limitado: demo ? false : !temToken(),
      fonte: demo ? "snapshot congelado" : "brapi.dev",
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
