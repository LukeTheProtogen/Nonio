"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Marca } from "@/components/marketing/marca";
import { sair, type Sessao } from "@/lib/sessao";
import { alternarDemo } from "@/lib/demo-acoes";
import { dataCurta, hora } from "@/lib/formato";

/**
 * Barra lateral do produto.
 *
 * Petróleo marca só o item ativo e o que é clicável. As rotas que ainda não
 * existem aparecem apagadas em vez de sumirem: esconder o que vem depois faz o
 * produto parecer menor do que é, e um link que dá 404 é pior que um item
 * visivelmente desligado.
 *
 * A conta mora no pé, nunca no topo. O topo é do produto; a conta é acessório,
 * e a hierarquia visual precisa dizer isso.
 *
 * Cliente por causa do `usePathname`. Layout de servidor não conhece a rota
 * atual, e antes disto a barra marcava "Macro" como ativa em todas as telas —
 * a navegação inteira mentia sobre onde a pessoa estava.
 */

type Rota = { href: string; rotulo: string; icone: React.ReactNode; pronta: boolean };

export function BarraLateral({
  sessao,
  fontes,
  demo,
}: {
  sessao: Sessao;
  fontes: { rotulo: string; em: string; hora?: boolean }[];
  /** Modo demonstração ligado. Vem do servidor, nunca de estado local. */
  demo: boolean;
}) {
  const caminho = usePathname();
  const ativa = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  const rotas: Rota[] = [
    { href: "/macro", rotulo: "Macro", icone: <IconeMacro />, pronta: true },
    { href: "/acoes", rotulo: "Ações", icone: <IconeAcoes />, pronta: true },
    { href: "/historico", rotulo: "Histórico", icone: <IconeHistorico />, pronta: true },
  ];

  return (
    /*
      Sem `h-full`.
      
      `height: 100%` só resolve contra pai com altura DEFINIDA, e a cadeia aqui
      termina em `body { min-height: 100% }` — mínimo não é definido. A barra
      ficava do tamanho do próprio conteúdo, o `grow` abaixo não tinha para onde
      crescer, e a conta encalhava no topo em vez de descer para o pé.
      
      O pai é `display:flex` em linha, e `align-items: stretch` é o padrão: a
      barra estica sozinha, sem precisar de altura nenhuma.
    */
    <aside className="flex w-58 shrink-0 flex-col overflow-y-auto border-r border-rule py-5.5">
      <div className="flex flex-col gap-0.5 px-5 pb-4.5">
        <Link href="/macro" className="flex items-center gap-2.5">
          {/* Sem caixa aqui: ao lado do nome, um bloco de cor sólida competiria
              com o próprio nome em vez de assiná-lo. */}
          <Marca tamanho={22} caixa={false} />
          <span className="font-heading text-[21px] font-semibold tracking-tight">Nônio</span>
        </Link>
        <span className="eyebrow">pesquisa · probabilidade</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {rotas.map((r) => (
          <ItemNav key={r.href} rota={r} ativa={ativa(r.href)} />
        ))}
      </nav>

      <div className="mx-5 my-3.5 h-px bg-rule" />

      <nav className="flex flex-col gap-0.5">
        <ItemNav
          rota={{ href: "/fontes", rotulo: "Fontes", icone: <IconeFontes />, pronta: true }}
          ativa={ativa("/fontes")}
        />
      </nav>

      <div className="grow" />

      <div className="flex flex-col gap-2.5 px-5">
        <span className="eyebrow">Fontes</span>
        <div className="flex flex-col gap-1.5 text-xs">
          {fontes.map((f) => (
            <div key={f.rotulo} className="flex justify-between gap-2">
              <span>{f.rotulo}</span>
              <span className="font-mono text-ink-soft tabular">
                {f.hora ? hora(f.em) : dataCurta(f.em)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-3.5 border-t border-rule pt-3">
        <ChaveDemo ligado={demo} />
      </div>

      <div className="mx-3.5 mt-3 border-t border-rule px-2.5 pt-2.5">
        <div className="flex items-center gap-2.5">
          <Link
            href="/conta"
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-sm py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo ${
              ativa("/conta") ? "text-modelo" : ""
            }`}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-rule bg-modelo-lavado text-xs font-semibold text-modelo">
              {sessao.nome.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-medium">{sessao.nome}</span>
              <span className="text-[11px] text-ink-soft">{sessao.plano}</span>
            </span>
          </Link>

          {/* Sair é POST, nunca link: um GET que encerra sessão é derrubado pelo
              pré-carregamento do próprio navegador. */}
          <form action={sair}>
            <button
              type="submit"
              className="rounded-sm px-1.5 py-1 text-[11px] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
            >
              Sair
            </button>
          </form>
        </div>
      </div>

      <p className="mx-5 mt-3.5 text-[11px] leading-snug text-ink-soft">
        Ferramenta de pesquisa. Não é recomendação de investimento. Res. CVM 19 e 20.
      </p>
    </aside>
  );
}

/**
 * Chave do modo demonstração.
 *
 * Mora na barra, à vista de todas as telas, e não escondida numa página de
 * ajustes: enquanto ela está ligada NADA na tela vem da rede, e quem apresenta
 * precisa conseguir conferir isso de relance.
 *
 * É formulário com ação de servidor, não estado de cliente. O modo decide o que
 * o servidor busca — se fosse estado local, a tela alternaria a aparência e
 * continuaria pedindo cotação para a brapi.
 */
function ChaveDemo({ ligado }: { ligado: boolean }) {
  return (
    <form action={alternarDemo}>
      <button
        type="submit"
        role="switch"
        aria-checked={ligado}
        title={
          ligado
            ? "Desligar: volta a buscar cotação ao vivo"
            : "Ligar: congela tudo no snapshot versionado, sem rede"
        }
        className="flex w-full items-center gap-2.5 rounded-sm py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
      >
        <span
          aria-hidden
          className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
            ligado ? "bg-modelo" : "bg-surface-3 ring-1 ring-rule ring-inset"
          }`}
        >
          <span
            className={`absolute top-0.5 size-3 rounded-full bg-white shadow-sm transition-[left] ${
              ligado ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[12.5px] font-medium">Modo demonstração</span>
          <span className="text-[11px] leading-tight text-ink-soft">
            {ligado ? "congelado, sem rede" : "cotação ao vivo"}
          </span>
        </span>
      </button>
    </form>
  );
}

function ItemNav({ rota, ativa }: { rota: Rota; ativa: boolean }) {
  const base = "flex h-9 items-center gap-2.5 border-l-2 px-4.5 text-sm font-medium";

  if (!rota.pronta) {
    return (
      <span
        aria-disabled
        title="Ainda não construída"
        className={`${base} border-transparent text-referencia`}
      >
        {rota.icone}
        <span>{rota.rotulo}</span>
        <span className="ml-auto text-[10px] font-normal">em breve</span>
      </span>
    );
  }

  return (
    <Link
      href={rota.href}
      className={`${base} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-modelo ${
        ativa ? "border-modelo text-modelo" : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {rota.icone}
      <span>{rota.rotulo}</span>
    </Link>
  );
}

const traco = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "shrink-0",
  "aria-hidden": true,
};

function IconeMacro() {
  return (
    <svg {...traco}>
      <path d="M2 16c4 0 5.5-12 8-12s4 12 8 12" />
      <path d="M2 16h16" />
    </svg>
  );
}
function IconeAcoes() {
  return (
    <svg {...traco}>
      <path d="M4 16v-6M8 16V5M12 16V8M16 16v-4" />
    </svg>
  );
}
function IconeHistorico() {
  return (
    <svg {...traco}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 2" />
    </svg>
  );
}
function IconeFontes() {
  return (
    <svg {...traco}>
      <ellipse cx="10" cy="5" rx="6" ry="2.4" />
      <path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" />
      <path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" />
    </svg>
  );
}
