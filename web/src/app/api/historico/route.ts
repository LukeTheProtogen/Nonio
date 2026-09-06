import { NextResponse } from "next/server";
import { zHistorico } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";

/**
 * GET /api/historico
 *
 * Erro medido do consenso do Focus contra o IPCA realizado, por horizonte.
 *
 * É o único endpoint 100% real hoje: sai de `src/data/backtest.json`, escrito
 * pelo pipeline. Atenção ao que ele mede — o erro do CONSENSO, não o nosso.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    return NextResponse.json(zHistorico.parse(local.historico()));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
