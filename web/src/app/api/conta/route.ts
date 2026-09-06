import { NextResponse } from "next/server";
import { zConta } from "@/lib/api/contratos";
import * as local from "@/lib/api/local";
import { sessaoAtual } from "@/lib/sessao";

/**
 * GET /api/conta
 *
 * O único endpoint que exige sessão. O proxy não cobre `/api`, então a
 * verificação é aqui mesmo: 401 sem cookie, sem corpo que revele nada.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const sessao = await sessaoAtual();
  if (!sessao) {
    return NextResponse.json({ erro: "sessão necessária" }, { status: 401 });
  }

  try {
    return NextResponse.json(zConta.parse(local.conta(sessao.nome, sessao.plano)));
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "falha desconhecida" },
      { status: 500 },
    );
  }
}
