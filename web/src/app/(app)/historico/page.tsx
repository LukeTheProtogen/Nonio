import type { Metadata } from "next";
import Link from "next/link";
import { obterHistorico } from "@/lib/api/servico";
import { BarraSuperior } from "@/components/app/barra-superior";
import { BarrasErro } from "@/components/app/barras";
import { CurvaCalibracao } from "@/components/marketing/curva-calibracao";
import { porHorizonte } from "@/lib/backtest";
import { num, probabilidade } from "@/lib/formato";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";

export const metadata: Metadata = { title: "Histórico" };

/**
 * Quanto o consenso erra, medido.
 *
 * Esta é a única tela do produto inteiramente sobre DADO REAL. E o que ela mede
 * é o consenso do Focus contra o IPCA que aconteceu, não o nosso modelo — que
 * ainda não publicou previsão nenhuma. O título e o texto dizem isso em vez de
 * deixar a ambiguidade trabalhar a nosso favor.
 *
 * Nada de linha do tempo bonita: o backtest publica agregado por horizonte, não
 * série mensal de erro. Desenhar uma curva a partir de cinco pontos agregados
 * seria inventar formato para preencher espaço.
 */
export default async function Historico({ searchParams }: PageProps<"/historico">) {
  const params = await searchParams;
  const { indicador, baseCalculo, horizontes } = await obterHistorico();

  const pedido = Number(params.h);
  const foco = horizontes.find((h) => h.horizonteMeses === pedido) ?? horizontes.at(-1)!;
  const cru = porHorizonte(foco.horizonteMeses);

  return (
    <>
      <BarraSuperior titulo="Histórico">
        <span className="font-mono text-xs text-ink-soft">
          {indicador} · base de cálculo {baseCalculo}
        </span>
      </BarraSuperior>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6 md:px-9 md:py-7">
        <header className="flex flex-col gap-2">
          <h1 className="t-tela max-w-[26ch]">
            O consenso erra, e dá para medir quanto
          </h1>
          <p className="max-w-[70ch] text-[14.5px] leading-relaxed text-ink-soft">
            Tudo nesta tela é medido contra o IPCA que de fato aconteceu. Mede o erro do{" "}
            <strong className="font-semibold text-ink">consenso do Focus</strong>, não o nosso:
            o modelo ainda não publicou previsão, e apresentar isto como acerto nosso seria
            mentira.
          </p>
        </header>

        {/* ------------------------------------------------ erro por horizonte */}
        <section className="flex flex-col gap-5 border-t border-rule pt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="t-sub">Erro médio por horizonte</h2>
            <p className="text-[13px] text-ink-soft">
              Contra dois modelos bobos: repetir o último valor, e cravar a meta.
            </p>
          </div>

          <BarrasErro
            grupos={horizontes.map((h) => ({
              rotulo: `${h.horizonteMeses} ${h.horizonteMeses === 1 ? "mês" : "meses"}`,
              series: [
                { rotulo: "consenso", valor: h.consenso.mae, cor: "var(--consenso)" },
                { rotulo: "repetir o último", valor: h.ingenuo.mae, cor: "var(--referencia)" },
                { rotulo: "cravar a meta", valor: h.meta.mae, cor: "var(--rule)" },
              ],
            }))}
          />

          <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-ink-soft">
            <Legenda cor="var(--consenso)">consenso do Focus</Legenda>
            <Legenda cor="var(--referencia)">repetir o último valor</Legenda>
            <Legenda cor="var(--rule)">cravar a meta de inflação</Legenda>
          </div>

          <p className="max-w-[76ch] text-[13px] leading-relaxed text-ink-soft">
            Erro absoluto médio, em pontos percentuais. Quanto menor, melhor. A comparação com os
            dois modelos bobos é o que separa “acerta” de “acerta mais do que qualquer um
            acertaria sem pensar”.
          </p>
        </section>

        {/* -------------------------------------------------------- horizonte */}
        <section className="flex flex-col gap-5 border-t border-rule pt-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 className="t-sub">
              A {foco.horizonteMeses} {foco.horizonteMeses === 1 ? "mês" : "meses"} do fechamento
            </h2>

            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-rule bg-surface-2 p-1">
              {horizontes.map((h) => (
                <Link
                  key={h.horizonteMeses}
                  href={`/historico?h=${h.horizonteMeses}`}
                  scroll={false}
                  aria-current={h.horizonteMeses === foco.horizonteMeses}
                  className={`inline-flex h-7 items-center rounded-full px-3.5 font-mono text-[13px] tabular transition-colors ${
                    h.horizonteMeses === foco.horizonteMeses
                      ? "bg-modelo text-white"
                      : "text-ink-soft hover:bg-white hover:text-ink"
                  }`}
                >
                  {h.horizonteMeses}m
                </Link>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-6 lg:grid-cols-4 lg:gap-x-10">
            <Metrica
              rotulo="Erro médio"
              valor={num(foco.consenso.mae)}
              unidade="p.p."
              nota="Erro absoluto médio"
            />
            <Metrica
              rotulo="Viés"
              valor={num(foco.consenso.me)}
              unidade="p.p."
              nota={foco.consenso.me > 0 ? "Projeta acima do realizado" : "Projeta abaixo do realizado"}
            />
            <Metrica
              rotulo="Ganho sobre o ingênuo"
              valor={`${num(foco.skillVsIngenuo * 100, 0)}%`}
              nota={
                foco.skillVsIngenuo > 0
                  ? "Melhor que repetir o último valor"
                  : "Pior que repetir o último valor"
              }
              cor={foco.skillVsIngenuo > 0 ? "text-positivo" : "text-negativo"}
            />
            <Metrica
              rotulo="Observações"
              valor={String(foco.n)}
              nota={`${foco.periodo[0].slice(0, 4)} a ${foco.periodo[1].slice(0, 4)}`}
            />
          </div>

          {/*
            Mincer-Zarnowitz em uma frase. A leitura vem pronta do pipeline: se
            a interpretação fosse escrita aqui, ela poderia contradizer o número
            calculado lá, e o front não é lugar de reinterpretar estatística.
          */}
          <div className="flex flex-col gap-2 border-l-2 border-modelo bg-modelo-lavado px-5 py-4">
            <span className="eyebrow">Regressão de Mincer-Zarnowitz</span>
            <p className="max-w-[74ch] text-[14.5px] leading-relaxed">
              {foco.mincerZarnowitz.leitura}
            </p>
            <p className="font-mono text-[12px] text-ink-soft tabular">
              β = {num(foco.mincerZarnowitz.beta)} (ep {num(foco.mincerZarnowitz.epBeta)}) · α ={" "}
              {num(foco.mincerZarnowitz.alfa)} · t para β=1: {num(foco.mincerZarnowitz.tBetaIgual1)}
            </p>
          </div>
        </section>

        {/* ----------------------------------------------------- calibragem */}
        <section className="flex flex-col gap-5 border-t border-rule pt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="t-sub">A probabilidade se confirma?</h2>
            <p className="font-mono text-[12px] text-ink-soft tabular">
              Brier {num(foco.brier.valor, 3)} · climatologia {num(foco.brier.climatologia, 3)}
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
            {cru && (
              <div className="min-w-0">
                <CurvaCalibracao horizonte={cru} />
              </div>
            )}

            <div className="flex flex-col gap-4">
              <p className="max-w-[54ch] text-[14.5px] leading-relaxed text-ink-soft">
                Cada ponto é uma faixa de probabilidade implícita no consenso. No eixo horizontal,
                o que o consenso dizia; no vertical, com que frequência aconteceu. Em cima da
                diagonal seria perfeito.
              </p>

              <table className="w-full border-collapse text-[13.5px]">
                <thead>
                  <tr className="border-y border-rule text-left">
                    <th scope="col" className="py-2 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-soft">Faixa</th>
                    <th scope="col" className="py-2 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-ink-soft">Dizia</th>
                    <th scope="col" className="py-2 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-ink-soft">Aconteceu</th>
                    <th scope="col" className="py-2 text-right text-[11px] font-medium uppercase tracking-[0.07em] text-ink-soft">n</th>
                  </tr>
                </thead>
                <tbody>
                  {foco.confiabilidade.map((c) => (
                    <tr key={c.faixa} className="border-b border-rule-soft">
                      <td className="py-2 font-mono tabular">{c.faixa}</td>
                      <td className="py-2 text-right font-mono tabular">{probabilidade(c.dissemos)}</td>
                      <td className="py-2 text-right font-mono tabular">{probabilidade(c.aconteceu)}</td>
                      <td className="py-2 text-right font-mono text-ink-soft tabular">{c.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                Faixa com poucas observações é ruído com aparência de achado. O número de
                observações fica na tabela por isso, e não como enfeite.
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-auto flex justify-between gap-8 border-t border-rule py-3.5 text-xs text-ink-soft">
          <span>{DISCLAIMER_MEDIO}</span>
        </footer>
      </div>
    </>
  );
}

function Metrica({
  rotulo,
  valor,
  unidade,
  nota,
  cor = "",
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  nota: string;
  cor?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow">{rotulo}</span>
      <span className={`t-numero text-[36px] ${cor}`}>
        {valor}
        {unidade ? <span className="pl-1.5 text-[15px] font-medium text-ink-soft">{unidade}</span> : null}
      </span>
      <span className="pt-1 text-[12px] text-ink-soft">{nota}</span>
    </div>
  );
}

function Legenda({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block size-2.5 shrink-0" style={{ background: cor }} />
      {children}
    </span>
  );
}
