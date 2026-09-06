import { NextResponse } from "next/server";
import { zAcoes } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";

/**
 * GET /api/acoes
 *
 * O universo inteiro numa resposta. São 16 papéis: paginar isto seria
 * complicar a integração para economizar bytes que não pesam.
 *
 * Dinâmica porque busca cotação: `revalidate` congelaria o preço junto com o
 * resto. O cache real está no fetch da brapi, 15 minutos, em `lib/brapi`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(zAcoes.parse(await local.acoes()));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
