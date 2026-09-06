import type { Metadata } from "next";
import Link from "next/link";
import { NuvemConsenso } from "@/components/marketing/nuvem-consenso";
import { BarraSuperior } from "@/components/app/barra-superior";
import { obterMacro } from "@/lib/api/servico";
import type { Indicador } from "@/lib/api/contratos";
import { fotoAtual } from "@/lib/backtest";
import { dataLonga, num, probabilidade } from "@/lib/formato";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";

export const metadata: Metadata = { title: "Macro" };

/**
 * Painel macro.
 *
 * A probabilidade é o número grande porque é a unidade do produto. Mediana e
 * previsão recuam para rótulo: são o insumo, não a resposta. Antes disso a tela
 * mostrava seis elementos por cartão e nenhum deles dizia ao olho por onde
 * começar.
 */
export default async function Macro({ searchParams }: PageProps<"/macro">) {
  const params = await searchParams;
  const { indicadores, citacoes, coletadoEm, baseCalculo } = await obterMacro();

  /*
    O Focus projeta cinco anos à frente para quatro famílias: são vinte
    indicadores. A tela mostrava os vinte num grid de quatro colunas, o que dava
    cinco fileiras de cartão e empurrava o gráfico principal para fora da tela.

    Ano é um FILTRO, não conteúdo. Ninguém compara IPCA de 2026 com Selic de
    2030; compara-se o mesmo ano entre famílias, ou a mesma família ao longo dos
    anos. Os chips já existiam na tela — só não faziam nada.
  */
  const anos = [...new Set(indicadores.map((i) => i.ano))].sort();
  const pedido = Number(params.ano);
  const ano = anos.includes(pedido) ? pedido : anos[0]!;

  const doAno = indicadores.filter((i) => i.ano === ano);

  // O indicador em foco embaixo. Padrão é o primeiro do ano, que é o IPCA.
  const slugPedido = typeof params.ind === "string" ? params.ind : null;
  const foco = doAno.find((i) => i.slug === slugPedido) ?? doAno[0]!;

  // Pode não existir: as 280 atas ainda não foram processadas.
  const citacao = citacoes[0];
  const real = fotoAtual.linhas[0]!;

  return (
    <>
      <BarraSuperior titulo="Macro" mock>
        <span className="font-mono text-xs text-ink-soft">
          Focus de {dataLonga(coletadoEm)}
        </span>
      </BarraSuperior>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-9 pt-7">
        <header className="flex items-end justify-between gap-8 pb-6.5">
          <h1 className="font-heading text-3xl font-semibold leading-tight">
            Onde o mercado discorda, e onde estamos dentro
          </h1>
          <nav className="flex shrink-0 gap-1 rounded-full border border-rule bg-surface-2 p-1">
            {anos.map((a) => (
              <Chip key={a} href={`/macro?ano=${a}`} ativo={a === ano}>
                {a}
              </Chip>
            ))}
          </nav>
        </header>

        <section className="grid grid-cols-4 border-y border-rule">
          {doAno.map((ind, i) => (
            /*
              O cartão é link: clicar troca o indicador do gráfico abaixo. Antes
              o foco era sempre o primeiro da lista e os outros três eram
              decoração — quatro cartões que não levam a lugar nenhum.
            */
            <Link
              href={`/macro?ano=${ano}&ind=${ind.slug}`}
              key={ind.slug}
              aria-current={ind.slug === foco.slug}
              className={[
                "flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-surface-2",
                i > 0 && "border-l border-rule",
                i === 0 && "pl-0",
                ind.slug === foco.slug && "shadow-[inset_0_2px_0_var(--modelo)]",
                i === doAno.length - 1 && "pr-0",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold">{ind.nome}</h2>
                <span className="font-mono text-[11px] text-ink-soft">{ind.evento}</span>
              </div>

              <MiniDistribuicao indicador={ind} />

              <div className="grid grid-cols-2 gap-3.5">
                <Numero
                  valor={ind.modelo ? probabilidade(ind.modelo.pEvento) : "—"}
                  rotulo={
                    ind.modelo
                      ? `modelo · ${num(ind.modelo.mediana)}${ind.unidade === "pct" ? "%" : ""}`
                      : "modelo · ainda não existe para macro"
                  }
                  cor={ind.modelo ? "text-modelo" : "text-ink-soft"}
                />
                <Numero
                  valor={ind.consenso.pEvento === null ? "—" : probabilidade(ind.consenso.pEvento)}
                  rotulo={`consenso · ${num(ind.consenso.mediana)}${ind.unidade === "pct" ? "%" : ""}`}
                  cor="text-consenso"
                />
              </div>
            </Link>
          ))}
        </section>

        <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-12 pt-7">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-6">
              <h2 className="font-heading text-xl font-semibold">
                {foco.nome} · as {foco.consenso.n} projeções
              </h2>
              <span className="font-mono text-xs text-ink-soft">
                base de cálculo {baseCalculo}
              </span>
            </div>

            <NuvemConsenso indicador={foco} />

            <div className="flex flex-wrap gap-x-7 gap-y-2.5 text-[13px] text-ink-soft">
              <Legenda cor="bg-consenso">
                uma instituição por ponto, mediana em {num(foco.consenso.mediana)}%
              </Legenda>
              <Legenda cor={foco.modelo ? "bg-modelo" : "bg-ink-soft"}>
                {foco.modelo
                  ? `nosso modelo em ${num(foco.modelo.mediana)}%, com a faixa de 80%`
                  : "modelo próprio para macro ainda não existe"}
              </Legenda>
            </div>

            {/*
              Os pontos são reconstrução a partir dos agregados, não instituições
              nomeadas. Dizer isso na tela é o que separa dado de invenção.
            */}
            <p className="text-xs leading-relaxed text-ink-soft">
              O Focus publica estatística agregada, nunca as projeções individuais. Os pontos
              são uma reconstrução a partir da média, do desvio e dos extremos publicados, e
              representam a forma da discordância, não instituições específicas.
            </p>
          </div>

          <aside className="flex min-w-0 flex-col gap-3.5 border-l border-rule pl-7">
            <span className="eyebrow">Por que divergimos</span>
            {citacao ? (
              <>
                <blockquote className="font-heading text-base italic leading-relaxed">
                  “{citacao.trecho}”
                </blockquote>
                <a
                  href={citacao.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[13px] text-modelo hover:text-modelo-forte"
                >
                  <IconeExterno />
                  Ata do Copom {citacao.ata} · parágrafo {citacao.paragrafo}
                </a>
              </>
            ) : (
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Nenhuma citação publicada ainda — as 280 atas do Copom não foram processadas.
                Preferimos a lacuna a uma citação não verificada.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 border-t border-rule-soft pt-3.5">
              <span className="eyebrow">Consenso medido</span>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                A última foto do backtest, com dado real: mediana{" "}
                <span className="font-mono text-ink tabular">{num(real.consenso.mediana)}%</span>,
                desvio <span className="font-mono text-ink tabular">{num(real.consenso.dp)}</span>,{" "}
                <span className="font-mono text-ink tabular">{real.consenso.n}</span> respondentes.
              </p>
            </div>
          </aside>
        </section>

        <footer className="mt-auto flex justify-between gap-8 border-t border-rule py-3.5 text-xs text-ink-soft">
          <span>{DISCLAIMER_MEDIO}</span>
          <span className="font-mono">Focus de {dataLonga(coletadoEm)}</span>
        </footer>
      </div>
    </>
  );
}

function Chip({
  children,
  href,
  ativo,
}: {
  children: React.ReactNode;
  href: string;
  ativo?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ativo}
      className={`inline-flex h-8 items-center rounded-full px-3.5 font-mono text-[13px] font-medium tabular transition-colors ${
        ativo ? "bg-modelo text-white" : "text-ink-soft hover:bg-carta hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor: string }) {
  return (
    <div className="flex flex-col">
      <span className={`font-heading text-[38px] font-semibold leading-none tabular ${cor}`}>
        {valor}
      </span>
      <span className="pt-1 text-xs text-ink-soft">{rotulo}</span>
    </div>
  );
}

function Legenda({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block size-2 shrink-0 rounded-full ${cor}`} />
      {children}
    </span>
  );
}

/** Curva de bolso do cartão: área do consenso, linha do modelo, nada mais. */
function MiniDistribuicao({ indicador }: { indicador: Indicador }) {
  return (
    <div className="h-[74px] w-full">
      <NuvemConsenso indicador={indicador} larguraViewBox={520} compacto />
    </div>
  );
}

function IconeExterno() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M5 2.5H2.5v9h9V9" />
      <path d="M8 2.5h3.5V6" />
      <path d="M11.5 2.5 6.5 7.5" />
    </svg>
  );
}
