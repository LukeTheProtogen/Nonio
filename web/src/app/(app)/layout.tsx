import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { emDemo } from "@/lib/demo-acoes";
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

  const demo = await emDemo();

  return (
    /*
      Altura travada na janela, e não no conteúdo.

      `flex-1` dentro de um `body` com `min-height` deixa a linha CRESCER quando
      o conteúdo cresce: numa tabela longa a barra lateral esticava junto, a
      conta ia parar a mil pixels do topo, e era preciso rolar o documento
      inteiro para chegar nela. Casca de produto não rola — quem rola é o
      conteúdo, dentro dela.

      `svh` porque no celular a barra de endereço aparece e some.
    */
    <div className="flex h-[100svh] w-full overflow-hidden">
      <BarraLateral
        sessao={sessao}
        demo={demo}
        fontes={[
          { rotulo: "Focus", em: FOCUS_COLETADO_EM },
          { rotulo: "Backtest", em: backtestGeradoEm },
        ]}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
