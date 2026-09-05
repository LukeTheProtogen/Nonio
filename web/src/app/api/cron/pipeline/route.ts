import { NextResponse } from "next/server";

/**
 * Disparado pelo Vercel Cron uma vez por dia (09:00 UTC, ~06:00 BRT).
 *
 * Cotação NÃO passa por aqui: ela se atualiza sozinha pelo `revalidate` de
 * 15 min em /api/cotacoes, sem depender de agendador. O cron existe para o que
 * muda devagar — Focus (semanal), CVM (diário), atas do Copom (8x/ano).
 * Isso mantém o projeto dentro do limite de execuções do plano gratuito.
 */
export async function GET(request: Request) {
  // A Vercel assina a chamada do cron. Sem essa checagem qualquer um dispara.
  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${segredo}`) {
      return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
    }
  }

  // TODO(dia 1): chamar a regeneração do snapshot.
  // O trabalho pesado é do pipeline Python; aqui só o gatilho.
  return NextResponse.json({ ok: true, rodadoEm: new Date().toISOString() });
}
