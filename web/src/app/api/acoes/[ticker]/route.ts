import { NextResponse } from "next/server";
import { envelopeAcao } from "@/lib/api/servico";

/**
 * GET /api/acoes/PETR4
 *
 * Mesma porta que as páginas (servico → backend lowvol / fallback local).
 * Papel fora do universo → 404.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/acoes/[ticker]">) {
  const { ticker } = await params;

  try {
    const env = await envelopeAcao(ticker);
    if (!env) {
      return NextResponse.json(
        { erro: `${ticker.toUpperCase()} não está no universo coberto` },
        { status: 404 },
      );
    }
    return NextResponse.json(env);
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
