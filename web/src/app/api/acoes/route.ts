import { NextResponse } from "next/server";
import { envelopeAcoes } from "@/lib/api/servico";

/**
 * GET /api/acoes
 *
 * Mesma porta que as páginas: `servico` → FastAPI `/acoes` (lowvol parquet)
 * quando `NONIO_API_URL` + recurso ligados; senão / sem JWT → local (previsoes.json).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await envelopeAcoes());
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
