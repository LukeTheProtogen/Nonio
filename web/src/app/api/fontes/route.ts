import { NextResponse } from "next/server";
import { zFontes } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";

/**
 * GET /api/fontes
 *
 * Estado da ingestão: o que foi coletado, quando, e o que não foi.
 *
 * Dinâmica porque o estado "atrasada" depende de quanto tempo passou desde a
 * última coleta. Com cache, uma fonte parada há uma semana continuaria
 * aparecendo verde, que é exatamente o que esta tela existe para evitar.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(zFontes.parse(await local.fontes()));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
