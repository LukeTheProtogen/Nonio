import type { Metadata } from "next";
import { NuvemConsenso } from "@/components/marketing/nuvem-consenso";
import { INDICADORES, CITACOES, FOCUS_COLETADO_EM, BASE_CALCULO } from "@/mock/macro";
import { fotoAtual } from "@/lib/backtest";
import { dataLonga, num, probabilidade } from "@/lib/formato";

export const metadata: Metadata = { title: "Macro" };

/**
 * Painel macro.
 *
 * A probabilidade é o número grande porque é a unidade do produto. Mediana e
 * previsão recuam para rótulo: são o insumo, não a resposta. Antes disso a tela
 * mostrava seis elementos por cartão e nenhum deles dizia ao olho por onde
 * começar.
 */
export default function Macro() {
  const foco = INDICADORES[0];
  const citacao = CITACOES[0];
  const real = fotoAtual.linhas[0];

  return (
    <>
      <BarraSuperior />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-9 pt-7">
        <header className="flex items-end justify-between gap-8 pb-6.5">
          <h1 className="font-heading text-3xl font-semibold leading-tight">
            Onde o mercado discorda, e onde estamos dentro
          </h1>
          <div className="flex shrink-0 gap-2">
            <Chip ativo>Fim de 2026</Chip>
            <Chip>Fim de 2027</Chip>
          </div>
        </header>

        <section className="grid grid-cols-4 border-y border-rule">
          {INDICADORES.map((ind, i) => (
            <article
              key={ind.slug}
              className={[
                "flex flex-col gap-3 px-6 py-5",
                i > 0 && "border-l border-rule",
                i === 0 && "pl-0 shadow-[inset_0_2px_0_var(--modelo)]",
                i === INDICADORES.length - 1 && "pr-0",
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
                  valor={probabilidade(ind.modelo.pEvento)}
                  rotulo={`modelo · ${num(ind.modelo.mediana)}${ind.unidade === "pct" ? "%" : ""}`}
                  cor="text-modelo"
                />
                <Numero
                  valor={probabilidade(ind.consenso.pEvento)}
                  rotulo={`consenso · ${num(ind.consenso.mediana)}${ind.unidade === "pct" ? "%" : ""}`}
                  cor="text-consenso"
                />
              </div>
            </article>
          ))}
        </section>

        <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-12 pt-7">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex items-baseline justify-between gap-6">
              <h2 className="font-heading text-xl font-semibold">
                {foco.nome} · as {foco.consenso.n} projeções
              </h2>
              <span className="font-mono text-xs text-ink-soft">
                base de cálculo {BASE_CALCULO}
              </span>
            </div>

            <NuvemConsenso indicador={foco} />

            <div className="flex flex-wrap gap-x-7 gap-y-2.5 text-[13px] text-ink-soft">
              <Legenda cor="bg-consenso">
                uma instituição por ponto, mediana em {num(foco.consenso.mediana)}%
              </Legenda>
              <Legenda cor="bg-modelo">
                nosso modelo em {num(foco.modelo.mediana)}%, com a faixa de 80%
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
          <span>
            Probabilidade com fonte rastreável. Não é recomendação de investimento (Res. CVM 19 e
            20).
          </span>
          <span className="font-mono">Focus de {dataLonga(FOCUS_COLETADO_EM)}</span>
        </footer>
      </div>
    </>
  );
}

function BarraSuperior() {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule px-9">
      <span className="text-[13px] font-medium">Macro</span>
      <div className="flex items-center gap-3">
        <span className="rounded-sm border border-atencao-borda bg-atencao-fundo px-2 py-0.5 font-mono text-[11px] text-atencao">
          dados de demonstração
        </span>
        <span className="font-mono text-xs text-ink-soft">
          Focus de {dataLonga(FOCUS_COLETADO_EM)}
        </span>
      </div>
    </div>
  );
}

function Chip({ children, ativo }: { children: React.ReactNode; ativo?: boolean }) {
  return (
    <span
      className={`inline-flex h-8 items-center rounded-full border px-3.5 text-[13px] font-medium ${
        ativo ? "border-modelo bg-modelo-lavado text-modelo" : "border-rule text-ink-soft"
      }`}
    >
      {children}
    </span>
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
function MiniDistribuicao({ indicador }: { indicador: (typeof INDICADORES)[number] }) {
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
