import { NextResponse } from "next/server";
import { zAcaoDetalhe } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";

/**
 * GET /api/acoes/PETR4
 *
 * Papel fora do universo devolve 404, não 200 com corpo vazio: quem consome
 * precisa distinguir "não existe" de "existe e está sem dado".
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/acoes/[ticker]">) {
  const { ticker } = await params;

  try {
    const bruto = await local.acao(ticker.toUpperCase());
    if (!bruto) {
      return NextResponse.json(
        { erro: `${ticker.toUpperCase()} não está no universo coberto` },
        { status: 404 },
      );
    }
    return NextResponse.json(zAcaoDetalhe.parse(bruto));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
