import { NextResponse } from "next/server";
import { buscarCotacoes, temToken } from "@/lib/brapi";
import { calcularDelta, geradoEm, modeloVersao, toleranciaPp, todasPrevisoes } from "@/lib/previsoes";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";
import { cotacoesCongeladas, ehDemo, snapshot } from "@/lib/demo";

// A rota renderiza a cada requisição para que "consultadoEm" seja verdade.
// O fetch da brapi continua com cache de 15 min (next.revalidate em lib/brapi),
// então isso NÃO aumenta o consumo de cota — só deixa de mentir no carimbo.
export const dynamic = "force-dynamic";

/**
 * GET /api/painel
 *
 * As três coisas juntas, com a data de cada uma à vista:
 *   cotação ao vivo (15 min) · probabilidade (diária) · delta entre elas
 */
export async function GET(request: Request) {
  const previsoes = todasPrevisoes();
  const demo = ehDemo(request.url);

  try {
    const tickers = previsoes.map((p) => p.ticker);
    // Em demo, nenhuma chamada externa acontece — nem para falhar.
    const cotacoes = demo ? cotacoesCongeladas(tickers) : await buscarCotacoes(tickers);
    const porTicker = new Map(cotacoes.map((c) => [c.ticker, c]));

    const linhas = previsoes.map((p) => {
      const c = porTicker.get(p.ticker);
      const preco = c?.preco ?? null;
      return {
        ticker: p.ticker,
        aoVivo: {
          preco,
          variacaoPct: c?.variacaoPct ?? null,
          atualizadoEm: c?.atualizadoEm ?? null,
        },
        previsao: {
          probabilidade: p.probabilidade,
          horizonteMeses: p.horizonte_meses,
          precoReferencia: p.preco_referencia,
          volAnual: p.vol_anual,
          // O limiar deste ativo faz parte de explicar a decisão ao usuário:
          // sem ele, "recalcular ou não" vira veredito sem critério à vista.
          limiarRecalculo: p.limiar_recalculo,
          calculadoEm: p.calculado_em,
          modeloVersao: p.modelo_versao,
          gatilho: p.gatilho,
        },
        delta: preco === null ? null : calcularDelta(preco, p),
      };
    });

    return NextResponse.json({
      linhas,
      modo: demo ? "demo" : "ao-vivo",
      congeladoEm: demo ? snapshot.capturadoEm : null,
      previsoesGeradasEm: geradoEm,
      // O enquadramento viaja junto com o dado: quem consome a API — o
      // front, um parceiro, um script — recebe o mesmo aviso da tela.
      aviso: DISCLAIMER_MEDIO,
      modeloVersao,
      toleranciaPp,
      limitadoSemToken: demo ? false : !temToken(),
      consultadoEm: new Date().toISOString(),
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 502 },
    );
  }
}
