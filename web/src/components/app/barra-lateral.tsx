import Link from "next/link";
import { sair, type Sessao } from "@/lib/sessao";
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
 */

type Rota = { href: string; rotulo: string; icone: React.ReactNode; pronta: boolean };

export function BarraLateral({
  ativa,
  sessao,
  fontes,
}: {
  ativa: string;
  sessao: Sessao;
  fontes: { rotulo: string; em: string; hora?: boolean }[];
}) {
  const rotas: Rota[] = [
    { href: "/macro", rotulo: "Macro", icone: <IconeMacro />, pronta: true },
    { href: "/acoes", rotulo: "Ações", icone: <IconeAcoes />, pronta: false },
    { href: "/historico", rotulo: "Histórico", icone: <IconeHistorico />, pronta: false },
  ];

  return (
    <aside className="flex h-full w-58 shrink-0 flex-col border-r border-rule py-5.5">
      <div className="flex flex-col gap-0.5 px-5 pb-4.5">
        <Link href="/macro" className="font-heading text-[21px] font-semibold tracking-tight">
          Nônio
        </Link>
        <span className="eyebrow">pesquisa · probabilidade</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {rotas.map((r) => (
          <ItemNav key={r.href} rota={r} ativa={ativa === r.href} />
        ))}
      </nav>

      <div className="mx-5 my-3.5 h-px bg-rule" />

      <nav className="flex flex-col gap-0.5">
        <ItemNav
          rota={{ href: "/fontes", rotulo: "Fontes", icone: <IconeFontes />, pronta: false }}
          ativa={ativa === "/fontes"}
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

      <div className="mx-3.5 mt-3.5 border-t border-rule px-2.5 pt-2.5">
        <form action={sair} className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-rule bg-modelo-lavado text-xs font-semibold text-modelo">
            {sessao.nome.charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[12.5px] font-medium">{sessao.nome}</span>
            <span className="text-[11px] text-ink-soft">{sessao.plano}</span>
          </span>
          <button
            type="submit"
            className="ml-auto rounded-sm px-1.5 py-1 text-[11px] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="mx-5 mt-3.5 text-[11px] leading-snug text-ink-soft">
        Ferramenta de pesquisa. Não é recomendação de investimento. Res. CVM 19 e 20.
      </p>
    </aside>
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
