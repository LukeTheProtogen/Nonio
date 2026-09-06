import Link from "next/link";
import type { Metadata } from "next";
import { NuvemConsenso } from "@/components/marketing/nuvem-consenso";
import { CurvaCalibracao } from "@/components/marketing/curva-calibracao";
import { EscalaNonio } from "@/components/marketing/escala-nonio";
import { LinkSeta } from "@/components/marketing/marca";
import { Cabecalho, Rodape } from "@/components/marketing/moldura-publica";
import { FaixaFontes } from "@/components/marketing/faixa-fontes";
import { Halo } from "@/components/marketing/halo";
import { Vitrine } from "@/components/marketing/vitrine";
import { ArteFecho } from "@/components/marketing/arte-fecho";
import { obterMacro } from "@/lib/api/servico";
import { porHorizonte, geradoEm as backtestGeradoEm } from "@/lib/backtest";
import { dataLonga, num, probabilidade } from "@/lib/formato";
import { sessaoAtual } from "@/lib/sessao";

export const metadata: Metadata = {
  title: "Público desde 2000",
  description:
    "Mais de cem instituições projetam a inflação brasileira e discordam entre si. O Nônio mostra a discordância inteira, com a fonte de cada número.",
};

/*
 * A landing.
 *
 * O gráfico É o herói. A versão anterior abria com uma frase e enterrava a
 * nuvem na terceira rolagem — e a nuvem é a única coisa aqui que ninguém mais
 * mostra. Quem chega precisa VER a discordância antes de ler sobre ela.
 *
 * Regra de texto, aplicada linha a linha: nenhum parágrafo onde couber uma
 * frase, nenhuma frase onde couber um número. A página caiu de ~450 para ~180
 * palavras, e o que saiu não era argumento, era repetição do argumento.
 *
 * Seis blocos, e cada um responde uma pergunta só:
 *   1 o que é isto?       herói, com o gráfico
 *   2 de onde vem?        faixa de fontes
 *   3 o que eu vejo?      três cartões
 *   4 como é de verdade?  o produto, em captura real
 *   5 posso acreditar?    prova medida
 *   6 vocês ganham como?  alinhamento
 *   7 e agora?            fecho
 */
export default async function Landing() {
  const [sessao, macro] = await Promise.all([sessaoAtual(), obterMacro()]);

  const ipca = macro.indicadores[0]!;
  const h12 = porHorizonte(12);

  return (
    <main className="w-full">
      {/* ═══ 1 · HERÓI ═══════════════════════════════════════════════════ */}
      <div className="relative isolate">
        <Halo />
        <Cabecalho logado={Boolean(sessao)} />

        {/*
          O herói ocupa a primeira tela inteira.

          Sem isso, em monitor grande sobrava uma tira da faixa de fontes no pé
          da janela, com a animação de entrada pela metade: conteúdo meio
          transparente à vista dá impressão de página que não carregou.

          `svh` e não `vh`: no celular a barra de endereço aparece e some, e com
          `vh` o herói pula de altura no meio da rolagem. O desconto de 104px é
          o cabeçalho, que mora fora desta seção.

          É `min-h`, nunca `h`: em tela baixa o conteúdo cresce em vez de ser
          cortado.
        */}
        <section className="mx-auto grid max-w-[1440px] items-center gap-14 px-10 pt-10 pb-20 md:px-20 lg:min-h-[calc(100svh-104px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:pt-0 lg:pb-16">
          <div className="flex flex-col items-start gap-7">
            <p className="eyebrow">Boletim Focus · {dataLonga(macro.coletadoEm)}</p>

            <h1 className="t-heroi max-w-[13ch] text-balance">
              Público desde 2000. Você nunca viu.
            </h1>

            <p className="t-lead max-w-[40ch] text-ink-soft">
              <span className="font-mono text-ink tabular">{ipca.consenso.n}</span> instituições
              projetam a inflação brasileira e discordam entre si. A imprensa publica a mediana.
              Nós mostramos a discordância inteira.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                href="/criar-conta"
                className="inline-flex h-13 items-center rounded-lg bg-modelo px-7 font-semibold text-white transition-colors hover:bg-modelo-forte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
              >
                Criar conta
              </Link>
              <Link
                href="/sobre"
                className="inline-flex h-13 items-center rounded-lg border border-rule bg-carta px-6 font-medium transition-colors hover:border-ink-soft"
              >
                Como funciona
              </Link>
            </div>

            <p className="text-[13.5px] text-ink-soft">
              Sem cartão. Ferramenta de pesquisa, não recomendação de investimento.
            </p>
          </div>

          {/*
            O cartão branco existe porque o chão virou papel: agora branco
            significa "isto flutua acima", e o gráfico é a coisa que deve
            flutuar. No fundo branco antigo o gráfico não tinha onde pousar.
          */}
          <figure className="flex min-w-0 flex-col gap-4 rounded-xl border border-rule bg-carta p-6 shadow-[0_18px_48px_-24px_rgb(35_43_38/0.22)] md:p-8">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="t-cartao">{ipca.nome}</span>
              <span className="font-mono text-[12.5px] text-ink-soft tabular">
                mediana {num(ipca.consenso.mediana)}% · desvio {num(ipca.consenso.dp)}
              </span>
            </figcaption>

            <NuvemConsenso indicador={ipca} larguraViewBox={760} animado />

            <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-ink-soft">
              <Chave cor="var(--consenso)">
                uma instituição por ponto, {ipca.consenso.n} no total
              </Chave>
              {/*
                A legenda só promete o modelo quando ele existe. Com o macro
                real ele é null — há modelo de AÇÕES, não de macro — e a linha
                petróleo simplesmente não é desenhada. Anunciar uma curva que
                não está na tela é o tipo de detalhe que destrói a confiança no
                gráfico inteiro.
              */}
              {ipca.modelo ? (
                <Chave cor="var(--modelo)">nosso modelo, com a faixa de 80%</Chave>
              ) : (
                <>
                  {ipca.consenso.quantis && (
                    <Chave cor="var(--consenso)">
                      metade delas entre {num(ipca.consenso.quantis.q25)}% e{" "}
                      {num(ipca.consenso.quantis.q75)}%
                    </Chave>
                  )}
                  <Chave cor="var(--referencia)">
                    modelo próprio para macro ainda não existe
                  </Chave>
                </>
              )}
            </div>
          </figure>
        </section>
      </div>

      {/* ═══ 2 · DE ONDE VEM ═════════════════════════════════════════════ */}
      <FaixaFontes />

      {/* ═══ 3 · O QUE VOCÊ VÊ ═══════════════════════════════════════════ */}
      <Bloco>
        <h2 className="t-secao revela max-w-[17ch] pb-11 text-balance">
          Três coisas que o resumo do mercado não te dá.
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              titulo: "A discordância inteira",
              texto:
                "Não a mediana. A distribuição, o desvio, os extremos e quantos responderam.",
              numero: String(ipca.consenso.n),
              rodape: "projeções nesta semana",
            },
            /*
              Sem modelo macro, o número aqui é a probabilidade implícita no
              CONSENSO — e o texto passa a dizer isso. A versão anterior caía
              para o número do consenso mantendo "calculada, não estimada no
              olho", o que apresentava a leitura do Focus como previsão nossa.
              É exatamente a mentira que o produto existe para não contar.
            */
            {
              titulo: "A probabilidade, com limiar",
              texto: ipca.modelo
                ? `A chance de o IPCA fechar ${ipca.evento}, calculada, não estimada no olho.`
                : `A chance de o IPCA fechar ${ipca.evento}, implícita na dispersão que o Banco Central publica.`,
              numero:
                ipca.modelo?.pEvento !== undefined
                  ? probabilidade(ipca.modelo.pEvento)
                  : ipca.consenso.pEvento === null
                    ? "—"
                    : probabilidade(ipca.consenso.pEvento),
              rodape: ipca.modelo ? ipca.evento : `${ipca.evento} · do consenso`,
            },
            {
              titulo: "A fonte de cada número",
              texto:
                "Nenhum dado exclusivo. Cada valor tem origem pública, com data, a um clique.",
              numero: "0",
              rodape: "fontes fechadas",
            },
          ].map((c, i) => (
            <article
              key={c.titulo}
              className="revela flex flex-col gap-3 rounded-xl border border-rule bg-carta p-7"
              style={{ ["--atraso" as string]: `${i * 90}ms` }}
            >
              <span className="t-numero text-[46px] text-modelo">
                {c.numero}
              </span>
              <span className="t-meta text-ink-soft">{c.rodape}</span>
              <h3 className="t-cartao pt-3">
                {c.titulo}
              </h3>
              <p className="t-rotulo text-ink-soft">{c.texto}</p>
            </article>
          ))}
        </div>
      </Bloco>

      {/* ═══ 4 · O PRODUTO ═══════════════════════════════════════════════ */}
      <Bloco tom="claro">
        <h2 className="t-secao revela max-w-[16ch] pb-14 text-balance">
          É assim que fica na sua tela.
        </h2>
        <Vitrine />
      </Bloco>

      {/* ═══ 5 · PROVA ═══════════════════════════════════════════════════ */}
      {h12 && (
        <Bloco>
          <div className="grid items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="revela flex flex-col items-start gap-6">
              <p className="eyebrow">Prova, não promessa</p>

              <h2 className="t-secao max-w-[16ch] text-balance">
                O consenso erra, e dá para medir quanto.
              </h2>

              <p className="t-sub max-w-[42ch] font-medium">
                A doze meses, a mediana do Focus erra o IPCA em{" "}
                <span className="text-modelo tabular">{num(h12.consenso.mae)}</span> pontos
                percentuais, em média.
              </p>

              {/*
                Este parágrafo não pode sair por concisão. Sem ele, o número
                acima parece o NOSSO acerto — e ele é o erro do consenso, medido
                com dado real. É a única frase da página que existe para impedir
                uma leitura boa demais.
              */}
              <p className="t-ui max-w-[48ch] text-ink-soft">
                {h12.n} observações entre {h12.periodo[0].slice(0, 4)} e{" "}
                {h12.periodo[1].slice(0, 4)}. Isto mede o consenso, não a gente: o nosso modelo
                ainda não publicou previsão, e chamar isto de acerto nosso seria mentira.
              </p>

              <LinkSeta href="/sobre">Como medimos</LinkSeta>
            </div>

            <figure className="revela flex min-w-0 flex-col gap-4 rounded-xl border border-rule bg-carta p-6">
              <figcaption className="eyebrow">A probabilidade do consenso se confirma?</figcaption>
              <CurvaCalibracao horizonte={h12} animado />
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Horizontal, o que o consenso dizia. Vertical, o que aconteceu. Em cima da
                diagonal seria perfeito.
              </p>
            </figure>
          </div>
        </Bloco>
      )}

      {/* ═══ 6 · ALINHAMENTO ═════════════════════════════════════════════ */}
      <Bloco tom="salvia">
        <div className="grid items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
          <div className="revela flex flex-col items-start gap-6">
            <h2 className="t-secao max-w-[18ch] text-balance">
              Não ganhamos nada quando você compra.
            </h2>
            <p className="t-corpo max-w-[44ch]">
              Sem comissão de corretora, sem taxa por operação, sem repasse de gestora. A única
              receita é a assinatura de quem usa, e é isso que mantém o incentivo do seu lado da
              mesa.
            </p>
            <LinkSeta href="/precos">Ver preço</LinkSeta>
          </div>

          {/*
            A régua é o nome do produto: escala principal, escala auxiliar, e o
            traço que coincide. Fica aqui, e não na dobra, porque é metáfora —
            e metáfora ao lado do gráfico competiria com o dado.
          */}
          <figure className="revela flex flex-col gap-4 rounded-xl border border-rule/60 bg-carta p-7">
            <EscalaNonio />
            <figcaption className="text-[13px] leading-relaxed text-ink-soft">
              Nônio é a escala auxiliar do paquímetro. Ela não mede sozinha: revela a fração que a
              escala principal não mostra. Quem lê continua sendo você.
            </figcaption>
          </figure>
        </div>
      </Bloco>

      {/* ═══ 7 · FECHO ═══════════════════════════════════════════════════ */}
      <Bloco tom="escuro">
        <div className="grid items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="revela flex flex-col items-start gap-8">
            <h2 className="t-titulo max-w-[15ch] text-balance">
              A decisão é sua. Nosso trabalho é não esconder nada dela.
            </h2>
            <Link
              href="/criar-conta"
              className="inline-flex h-14 items-center rounded-lg bg-carta px-8 font-semibold text-modelo-forte transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Criar conta
            </Link>
          </div>

          {/*
            A arte mora num cartão, como todas as outras figuras da página: a do
            herói, a da calibração e a da régua. Solta sobre o verde ela parecia
            jogada, e não era impressão — era a única figura da página sem
            moldura e sem legenda, que é o que separa figura de enfeite.

            Verde mais claro que o bloco (`--modelo` sobre `--modelo-forte`), na
            mesma relação que papel e branco têm no resto: o que está por cima é
            mais claro que o chão.

            `text-white/70` porque a arte desenha em `currentColor` — herda a cor
            do bloco em vez de trazer paleta própria, e continua certa se o fundo
            do fecho mudar um dia.
          */}
          <figure className="revela flex min-w-0 flex-col gap-4 rounded-xl border border-white/10 bg-modelo p-7">
            <div className="text-white/70">
              <ArteFecho />
            </div>
            <figcaption className="flex items-baseline justify-between gap-4 border-t border-white/10 pt-3.5">
              <span className="eyebrow text-white/55">
                {ipca.consenso.n} projeções · uma leitura
              </span>
              <span className="font-mono text-[12px] text-white/55 tabular">
                {num(ipca.consenso.mediana)}%
              </span>
            </figcaption>
          </figure>
        </div>
      </Bloco>

      <Rodape geradoEm={backtestGeradoEm} />
    </main>
  );
}

/**
 * Faixa da página.
 *
 * Quatro tons: papel (o chão), claro, sálvia e escuro. O ritmo alternado é o
 * que impede a página de virar um rolo branco de ponta a ponta — a crítica
 * original, e a mais fácil de resolver.
 */
function Bloco({
  children,
  tom = "papel",
}: {
  children: React.ReactNode;
  tom?: "papel" | "claro" | "salvia" | "escuro";
}) {
  const fundo = {
    papel: "",
    claro: "bg-carta border-y border-rule",
    salvia: "bg-salvia-lavado",
    escuro: "bg-modelo-forte text-white",
  }[tom];

  return (
    <section className={fundo}>
      <div className="mx-auto max-w-[1440px] px-10 py-24 md:px-20 md:py-28">{children}</div>
    </section>
  );
}

function Chave({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: cor }} />
      {children}
    </span>
  );
}
