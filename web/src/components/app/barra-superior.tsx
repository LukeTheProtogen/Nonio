import { Busca, type Alvo } from "./busca";
import { ACOES } from "@/mock/acoes";
import { INDICADORES } from "@/mock/macro";

/**
 * Os alvos da busca: todo indicador macro e todo papel do universo.
 *
 * Montado no módulo, não por requisição: é lista fixa e pequena, e recalcular a
 * cada render só gastaria trabalho. Quando o universo vier do backend, isto
 * passa a ser prop.
 */
const ALVOS: Alvo[] = [
  ...INDICADORES.map((i) => ({
    chave: i.slug.split("-")[0]!.toUpperCase(),
    rotulo: i.nome,
    detalhe: "indicador",
    href: "/macro",
  })),
  ...ACOES.map((a) => ({
    chave: a.ticker,
    rotulo: a.nome,
    detalhe: a.setor,
    href: `/acoes?papel=${a.ticker}`,
  })),
];

/**
 * Barra do topo de cada tela do produto.
 *
 * Existe por causa do carimbo de demonstração. Enquanto parte do painel roda em
 * mock, esse aviso precisa estar no mesmo lugar em todas as telas: se ele muda
 * de posição, a pessoa aprende a não vê-lo, e aí ele não serve para nada.
 *
 * O `mock` vem do `meta.mock` da resposta, nunca de constante escrita à mão —
 * assim o carimbo some sozinho quando o backend passar a mandar dado real.
 */
export function BarraSuperior({
  titulo,
  mock,
  children,
}: {
  titulo: string;
  mock?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-rule px-9">
      <span className="shrink-0 text-[13px] font-medium">{titulo}</span>
      <div className="flex min-w-0 items-center gap-3">
        {mock && (
          <span
            title="Parte desta tela usa dado ilustrativo enquanto o pipeline não publica"
            className="rounded-sm border border-atencao-borda bg-atencao-fundo px-2 py-0.5 font-mono text-[11px] text-atencao"
          >
            dados de demonstração
          </span>
        )}
        {children}
        <Busca alvos={ALVOS} />
      </div>
    </div>
  );
}
