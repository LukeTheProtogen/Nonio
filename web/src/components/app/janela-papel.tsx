"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AcaoDetalhe } from "@/lib/api/contratos";
import { GraficoPreco } from "./grafico-preco";
import { BarrasDivergentes } from "./barras";
import { num, pctSinal, moeda, probabilidade, corDelta, dataLonga } from "@/lib/formato";

/**
 * A janela do papel: abre por cima do painel, como um aplicativo abrindo.
 *
 * Um passo por vez, com seta para o próximo. A versão de três colunas cabia na
 * tela e mesmo assim não se lia: três blocos de números lado a lado viram
 * parede, e quem olha não sabe por onde começar. Um assunto por vez responde
 * uma pergunta por vez.
 *
 * Fecha no X, no Esc e no clique fora, e as três voltam para a mesma URL sem o
 * `?papel=`. O estado mora no endereço, então a janela sobrevive a recarregar a
 * página e o link pode ser mandado para outra pessoa.
 */

const PASSOS = ["Preço", "Risco", "Contexto"] as const;

export function JanelaPapel(props: {
  detalhe: AcaoDetalhe;
  lente: string;
  anterior: string | null;
  proximo: string | null;
}) {
  /*
   * A chave é o ticker: trocar de papel remonta a janela do zero, e o passo
   * volta ao primeiro sozinho. Fazer isso com efeito seria pedir ao React que
   * renderizasse o passo errado e corrigisse em seguida.
   */
  return <Conteudo key={props.detalhe.acao.ticker} {...props} />;
}

function Conteudo({
  detalhe,
  lente,
  anterior,
  proximo,
}: {
  detalhe: AcaoDetalhe;
  lente: string;
  anterior: string | null;
  proximo: string | null;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const { acao, serie, fatos } = detalhe;

  const fechar = () => router.push(`/acoes?lente=${lente}`, { scroll: false });

  /*
   * Esc fecha, setas trocam de passo. Teclado não é acessório: quem usa isto
   * o dia inteiro não volta ao mouse para avançar três telas.
   */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") setPasso((p) => Math.min(p + 1, PASSOS.length - 1));
      if (e.key === "ArrowLeft") setPasso((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lente]);

  // O foco entra na janela ao abrir, senão o leitor de tela continua na tabela.
  useEffect(() => caixa.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 md:p-10"
      role="dialog"
      aria-modal
      aria-label={`${acao.ticker}, ${acao.nome}`}
    >
      {/* Fundo. Opacidade baixa de propósito: a tela de trás continua legível,
          o que sustenta a sensação de janela em cima e não de outra página. */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={fechar}
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
      />

      <div
        ref={caixa}
        tabIndex={-1}
        /*
         * Altura FIXA, não altura de conteúdo.
         *
         * Os três passos têm conteúdos de tamanhos diferentes, e com altura
         * automática a janela crescia e encolhia a cada troca. O quadro inteiro
         * saltava, e o passo seguinte chegava com o conteúdo já fora do lugar
         * onde o olho estava — movimento que ninguém pediu e que não explica
         * nada. Janela de aplicativo tem tamanho; é o conteúdo que rola dentro.
         */
        className="relative flex h-[660px] max-h-full w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-rule bg-carta shadow-[0_24px_64px_-16px_rgb(35_43_38/0.3)] outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-6 border-b border-rule px-8 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-baseline gap-3">
              <h2 className="font-heading text-[26px] font-semibold">{acao.ticker}</h2>
              <span className="truncate text-[15px] text-ink-soft">
                {acao.nome} · {acao.setor}
              </span>
            </div>
            {/*
              A linha do preço é SEMPRE renderizada, mesmo sem cotação.

              Escondê-la encurtava o cabeçalho nos papéis que a brapi não cobre
              sem token, e aí a janela inteira subia ao passar de um papel com
              preço para um sem. Trocar de papel com a seta fazia o conteúdo
              saltar, que é o mesmo defeito de altura variável entre os passos.
              Espaço reservado custa uma linha; salto custa a confiança na tela.
            */}
            <p className="flex h-5 items-baseline gap-2.5 font-mono text-[14px] tabular">
              {acao.preco === null ? (
                <span className="text-referencia" title="Esta cotação depende de BRAPI_TOKEN">
                  sem cotação
                </span>
              ) : (
                <>
                  <span>{moeda(acao.preco)}</span>
                  {acao.variacaoDiaPct !== null && (
                    <span className={corDelta(acao.variacaoDiaPct)}>
                      {pctSinal(acao.variacaoDiaPct)} hoje
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <SetaPapel href={anterior && `/acoes?lente=${lente}&papel=${anterior}`} lado="esq" />
            <SetaPapel href={proximo && `/acoes?lente=${lente}&papel=${proximo}`} lado="dir" />
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="ml-1.5 flex size-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>
        </header>

        <nav className="flex shrink-0 gap-0.5 border-b border-rule px-8">
          {PASSOS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setPasso(i)}
              aria-current={passo === i}
              className={`-mb-px border-b-2 px-4 py-3 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-modelo ${
                passo === i
                  ? "border-modelo text-modelo"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          {passo === 0 && <PassoPreco serie={serie} acao={acao} />}
          {passo === 1 && <PassoRisco acao={acao} serie={serie} />}
          {passo === 2 && <PassoContexto acao={acao} fatos={fatos} />}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-6 border-t border-rule px-8 py-4">
          <p className="text-[12px] text-ink-soft">
            Não é recomendação de investimento. Res. CVM 19 e 20.
          </p>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11.5px] text-ink-soft tabular">
              {passo + 1} de {PASSOS.length}
            </span>
            <button
              type="button"
              disabled={passo === PASSOS.length - 1}
              onClick={() => setPasso((p) => p + 1)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-modelo px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-modelo-forte disabled:cursor-default disabled:bg-surface-3 disabled:text-referencia"
            >
              {PASSOS[passo + 1] ?? "Fim"}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 2.5 9.5 7 5 11.5" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- passos

function PassoPreco({ serie, acao }: { serie: AcaoDetalhe["serie"]; acao: AcaoDetalhe["acao"] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        <Destaque
          rotulo="Retorno em 12 meses"
          valor={pctSinal(acao.retorno12m)}
          cor={corDelta(acao.retorno12m)}
          nota="Com dividendos e JCP"
        />
        <Destaque
          rotulo="Contra o CDI"
          valor={pctSinal(acao.acimaDoCdi)}
          cor={corDelta(acao.acimaDoCdi)}
          nota="Mesmo período, mesma régua"
        />
        {/*
          Também sempre presente. Sem previsão publicada mostra um traço, porque
          o cartão sumindo deslocava os outros dois ao trocar de papel.
        */}
        <Destaque
          rotulo={`Alta em ${acao.probabilidade?.horizonteMeses ?? 12} meses`}
          valor={acao.probabilidade ? probabilidade(acao.probabilidade.pAlta) : "—"}
          cor={acao.probabilidade ? "text-modelo" : "text-referencia"}
          nota={
            acao.probabilidade
              ? `Nosso modelo · ${acao.probabilidade.modeloVersao}`
              : "O modelo ainda não publicou para este papel"
          }
        />
      </div>

      <GraficoPreco serie={serie} />
    </div>
  );
}

function PassoRisco({
  acao,
  serie,
}: {
  acao: AcaoDetalhe["acao"];
  serie: AcaoDetalhe["serie"];
}) {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap gap-x-12 gap-y-4">
        <Destaque rotulo="Volatilidade anual" valor={`${num(acao.vol12m, 0)}%`} nota="Desvio dos retornos diários" />
        <Destaque
          rotulo="Pior queda"
          valor={`${num(acao.piorQueda, 1)}%`}
          cor="text-negativo"
          nota="Do topo ao fundo, no período"
        />
        <Destaque
          rotulo="Recuperação"
          valor={acao.diasAteOPico === 0 ? "ainda não" : `${acao.diasAteOPico} pregões`}
          cor={acao.diasAteOPico === 0 ? "text-negativo" : undefined}
          nota="Até voltar ao topo anterior"
        />
        <Destaque rotulo="Beta" valor={num(acao.beta)} nota="Contra o Ibovespa" />
      </div>

      {/*
        Texto e gráfico LADO A LADO, não empilhados: empilhado o passo
        transbordava a altura fixa da janela e o gráfico ficava cortado ao meio.
        Ao lado, o gráfico fica mais estreito e portanto mais baixo, e tudo cabe.

        A divisão também lê melhor: à esquerda o número traduzido em palavras,
        à direita o mesmo número desenhado. Volatilidade sozinha não diz nada a
        quem não é do mercado; ver ONDE a queda aconteceu, e quanto durou, diz.
      */}
      <div className="grid gap-x-9 gap-y-6 lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)]">
        <p className="text-[14.5px] leading-relaxed text-ink-soft">
          Volatilidade de {num(acao.vol12m, 0)}% ao ano significa que, num ano comum, o preço
          passa a maior parte do tempo dentro de uma faixa de mais ou menos{" "}
          {num(acao.vol12m, 0)}% em torno de onde começou. No pior trecho dos últimos doze meses,
          quem comprou no topo viu{" "}
          <span className="font-mono text-negativo tabular">{num(acao.piorQueda, 1)}%</span> do
          valor sumir antes de qualquer recuperação.
        </p>

        <div className="min-w-0">
          <GraficoPreco serie={serie} marcarQueda />
        </div>
      </div>
    </div>
  );
}

function PassoContexto({
  acao,
  fatos,
}: {
  acao: AcaoDetalhe["acao"];
  fatos: AcaoDetalhe["fatos"];
}) {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="text-[15px] font-semibold">O que move o papel</h3>
        <BarrasDivergentes
          itens={[
            {
              rotulo: "Selic sobe 1 ponto percentual",
              valor: acao.sensJuros100bp,
              nota: "Resposta estimada do preço",
            },
            { rotulo: "Dólar sobe 1%", valor: acao.sensDolar1pct },
            { rotulo: "Brent sobe 10%", valor: acao.sensBrent10pct },
          ]}
        />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          Regressão de fatores de três anos. Descreve como o papel se comportou quando esses
          preços se moveram, não o que vai acontecer da próxima vez.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5 md:border-l md:border-rule md:pl-8">
        <h3 className="text-[15px] font-semibold">Fatos relevantes, 30 dias</h3>
        {fatos.length === 0 ? (
          <p className="text-[13.5px] text-ink-soft">
            Nenhum comunicado obrigatório no período.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {fatos.map((f, i) => (
              <li key={i} className="flex flex-col gap-1 border-b border-rule-soft pb-3 last:border-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">{f.categoria}</span>
                  <span className="font-mono text-[11.5px] text-ink-soft tabular">
                    {dataLonga(f.data)}
                  </span>
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13.5px] leading-snug hover:text-modelo"
                >
                  {f.titulo}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ pedaços

function Destaque({
  rotulo,
  valor,
  nota,
  cor = "",
}: {
  rotulo: string;
  valor: string;
  nota: string;
  cor?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow">{rotulo}</span>
      <span className={`font-heading text-[32px] font-semibold leading-none tabular ${cor}`}>
        {valor}
      </span>
      <span className="pt-1 text-[12px] text-ink-soft">{nota}</span>
    </div>
  );
}

function SetaPapel({ href, lado }: { href: string | null; lado: "esq" | "dir" }) {
  const d = lado === "esq" ? "M9 2.5 4.5 7 9 11.5" : "M5 2.5 9.5 7 5 11.5";
  const rotulo = lado === "esq" ? "Papel anterior" : "Próximo papel";

  if (!href) {
    return (
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-md text-rule"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d={d} />
        </svg>
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={rotulo}
      title={rotulo}
      className="flex size-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </Link>
  );
}
