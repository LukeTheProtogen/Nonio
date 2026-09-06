import { NextResponse } from "next/server";
import { obterCopom } from "@/lib/api/servico";

/**
 * GET /api/copom
 *
 * Reuniões com extração (decisão, Selic, tom). O gráfico do papel usa a
 * mesma porta (`servico.obterCopom`); esta rota existe para o contrato ser
 * inspecionável com curl.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ reunioes: await obterCopom() });
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
