import { NextResponse } from "next/server";
import { zMacro } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";

/**
 * GET /api/macro
 *
 * Consenso do Focus por indicador, com a nossa distribuição ao lado.
 *
 * Esta rota existe para o contrato ser inspecionável com curl e para um front
 * separado poder consumir. As PÁGINAS não passam por aqui: chamam
 * `lib/api/servico` direto, sem volta de rede — ver o comentário de servico.ts.
 *
 * O `parse` antes de responder é de propósito. Se o mock sair do contrato, o
 * erro estoura aqui, com o nome do campo, e não no navegador de quem consome.
 */
export const revalidate = 900;

export async function GET() {
  try {
    return NextResponse.json(zMacro.parse(local.macro()));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
