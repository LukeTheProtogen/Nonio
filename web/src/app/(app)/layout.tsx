import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { BarraLateral } from "@/components/app/barra-lateral";
import { FOCUS_COLETADO_EM } from "@/mock/macro";
import { geradoEm as backtestGeradoEm } from "@/lib/backtest";

/**
 * Casca do produto. Tudo daqui para dentro exige sessão.
 *
 * A guarda é aqui e não em middleware de propósito: o layout já é assíncrono e
 * roda no servidor, então a verificação acontece antes de qualquer tela render,
 * e não existe estado em que o conteúdo apareça por um instante antes de sumir.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");

  return (
    <div className="flex min-h-0 w-full flex-1 overflow-hidden">
      <BarraLateral
        ativa="/macro"
        sessao={sessao}
        fontes={[
          { rotulo: "Focus", em: FOCUS_COLETADO_EM },
          { rotulo: "Backtest", em: backtestGeradoEm },
        ]}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
