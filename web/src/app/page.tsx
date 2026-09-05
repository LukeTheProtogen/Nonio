import Link from "next/link";
import type { Metadata } from "next";
import { NuvemConsenso } from "@/components/marketing/nuvem-consenso";
import { CurvaCalibracao } from "@/components/marketing/curva-calibracao";
import { Feixes } from "@/components/marketing/feixes";
import { EscalaNonio } from "@/components/marketing/escala-nonio";
import { Marca, LinkSeta, Canhoto } from "@/components/marketing/marca";
import { porHorizonte, geradoEm as backtestGeradoEm } from "@/lib/backtest";
import { INDICADORES, CITACOES, FOCUS_COLETADO_EM } from "@/mock/macro";
import { dataLonga, num, probabilidade } from "@/lib/formato";
import { sessaoAtual } from "@/lib/sessao";

export const metadata: Metadata = {
  title: "A decisão é sua",
  description:
    "Mais de cem instituições projetam a inflação brasileira e discordam entre si. Mostramos a discordância inteira, com a fonte de cada número.",
};

/* Uma ideia por rolagem. Onde couber uma frase no lugar de um parágrafo, fica a frase. */

export default async function Landing() {
  const sessao = await sessaoAtual();
  const ipca = INDICADORES[0];
  const h12 = porHorizonte(12);
  const h6 = porHorizonte(6);
  const citacao = CITACOES[0];

  return (
    <main className="w-full">
      {/* 01 · CABEÇALHO E DOBRA, sob os mesmos feixes */}
      <div className="relative isolate">
        <Feixes />
        <Cabecalho logado={Boolean(sessao)} />
        <section className="relative mx-auto max-w-[1440px] px-10 pb-28 pt-24 md:px-40">
        <p className="eyebrow">Pesquisa e probabilidade sobre dados públicos</p>
        <h1 className="mt-8 max-w-[14ch] font-heading text-6xl font-semibold leading-[1.03] tracking-[-0.024em] md:text-[78px]">
          A decisão é sua.
        </h1>
        <div className="mt-7 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          {/*
            Único título colorido da página. A regra da paleta proíbe petróleo
            como decoração porque perto de um gráfico ele confunde qual linha é
            o modelo — aqui não há gráfico, é a tese, e uma vez só não vira
            padrão. Não repetir em outras seções.
          */}
          <p className="max-w-[26ch] text-2xl leading-snug text-modelo md:text-[26px]">
            Nosso trabalho é não esconder nada dela.
          </p>
          <div className="flex flex-col items-start gap-5">
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-ink-soft">
              Mais de cem instituições projetam a inflação brasileira e discordam entre si.
              Mostramos a discordância inteira, com a fonte de cada número.
            </p>
            <div className="flex items-center gap-5">
              <Link
                href="/criar-conta"
                className="inline-flex h-13 items-center rounded-md bg-modelo px-7 py-4 font-semibold text-white transition-colors hover:bg-modelo-forte"
              >
                Criar conta
              </Link>
              <span className="text-sm text-ink-soft">Sem cartão para começar.</span>
            </div>
          </div>
        </div>
        </section>
      </div>

      {/* 02 · A NUVEM */}
      <Bloco>
        <div className="flex flex-col gap-6 pb-11 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[19ch] font-heading text-[46px] font-semibold leading-tight tracking-[-0.016em] text-balance">
            Público desde 2000. Você nunca viu.
          </h2>
          <p className="eyebrow pb-2">Boletim Focus · {dataLonga(FOCUS_COLETADO_EM)}</p>
        </div>

        <NuvemConsenso indicador={ipca} />

        <div className="grid gap-14 pt-9 md:grid-cols-3">
          <Legenda cor="consenso">{ipca.consenso.n} instituições, uma por ponto</Legenda>
          <Legenda cor="consenso">A mediana, o único número que te mostram</Legenda>
          <Legenda cor="modelo">O nosso, com a faixa de 80%</Legenda>
        </div>

        <p className="mt-12 max-w-[32ch] font-heading text-[30px] font-medium leading-snug">
          A chance de estourar o teto da meta é de{" "}
          <span className="text-modelo">{probabilidade(ipca.modelo.pEvento)}</span> pelo nosso
          modelo, e de{" "}
          <span className="text-consenso">{probabilidade(ipca.consenso.pEvento)}</span> pela
          dispersão do consenso.
        </p>
      </Bloco>

      {/* 03 · A FONTE */}
      <Bloco>
        <h2 className="max-w-[24ch] pb-11 font-heading text-[46px] font-semibold leading-tight tracking-[-0.016em] text-balance">
          Todo número aponta para o parágrafo que o sustenta.
        </h2>
        <figure className="max-w-[74ch] border-l-2 border-modelo py-2 pl-8">
          <blockquote className="font-heading text-[25px] italic leading-snug">
            “{citacao.trecho}”
          </blockquote>
          <figcaption className="mt-4">
            <a
              href={citacao.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[15px] text-modelo hover:text-modelo-forte"
            >
              <IconeExterno />
              Ata do Copom {citacao.ata} · parágrafo {citacao.paragrafo} · página {citacao.pagina}
            </a>
          </figcaption>
        </figure>
      </Bloco>

      {/* 04 · ALINHAMENTO */}
      <Bloco tom="claro">
        <h2 className="max-w-[23ch] font-heading text-[52px] font-semibold leading-tight tracking-[-0.016em] text-balance">
          Não ganhamos quando você compra. Nem quando você vende. Nem mais se você ganhar.
        </h2>
        <p className="mt-9 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
          Licença para plataformas e assinatura de valor fixo. É a lista inteira.
        </p>
        <div className="mt-15 grid gap-10 border-t border-rule pt-9 md:grid-cols-4">
          {[
            "Comissão por ordem",
            "Taxa sobre o seu ganho",
            "Rebate de quem emite",
            "Venda dos seus dados",
          ].map((item) => (
            <p key={item} className="flex items-center gap-3 text-[17px]">
              <IconeX />
              {item}
            </p>
          ))}
        </div>
        <p className="mt-6 text-[15px] text-ink-soft">
          Recusados. Cada um alinha alguém que não é você.
        </p>
      </Bloco>

      {/* 05 · QUEM DECIDE */}
      <Bloco tom="claro">
        <div className="grid items-center gap-12 pb-14 md:grid-cols-[130px_1fr_minmax(0,520px)]">
          <Canhoto acima="Escala" abaixo="auxiliar" />
          <div className="flex flex-col gap-6">
            <h2 className="max-w-[19ch] font-heading text-[46px] font-semibold leading-tight tracking-[-0.016em] text-balance">
              Somos o auxiliar. Quem decide continua sendo você.
            </h2>
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-soft">
              Nônio é a escala auxiliar do paquímetro. Encostada na régua principal, ela deixa
              ler a fração que a régua sozinha não mostra. Não mede nada por conta própria, e
              não substitui a régua: só torna visível o que já estava ali.
            </p>
          </div>
          <EscalaNonio className="w-full" />
        </div>
        <div className="grid md:grid-cols-[1fr_1px_1fr]">
          <div className="flex flex-col">
            <p className="eyebrow pb-3.5 text-modelo">nós fazemos</p>
            {[
              "Lemos 280 atas do Copom e marcamos o trecho exato.",
              "Medimos 24 anos de erro do consenso, por horizonte.",
              "Publicamos a probabilidade e a calibração dela.",
              "Guardamos a tese que você escreveu, com a data.",
            ].map((t, i) => (
              <p
                key={t}
                className={`py-5 pr-12 text-[19px] leading-snug ${i === 0 ? "border-t border-rule" : "border-t border-rule-soft"}`}
              >
                {t}
              </p>
            ))}
          </div>
          <div className="hidden bg-rule md:block" />
          <div className="flex flex-col">
            <p className="eyebrow pb-3.5">você decide</p>
            {[
              "Se a leitura vale para o seu caso.",
              "Quanto peso dar a ele.",
              `Se ${probabilidade(ipca.modelo.pEvento)} é alto para o seu dinheiro.`,
              "Comprar, vender ou não fazer nada. Aqui não há botão.",
            ].map((t, i) => (
              <p
                key={t}
                className={`py-5 text-[19px] leading-snug md:pl-12 ${i === 0 ? "border-t border-rule" : "border-t border-rule-soft"}`}
              >
                {t}
              </p>
            ))}
          </div>
        </div>
      </Bloco>

      {/* 06 · A PROVA — dado medido de verdade */}
      {h12 && h6 && (
        <Bloco>
          <div className="grid items-center gap-12 md:grid-cols-[130px_340px_1fr]">
            <Canhoto acima="Dado" abaixo="medido" />
            <CurvaCalibracao horizonte={h12} />
            <div className="flex flex-col gap-7">
              <h2 className="max-w-[20ch] font-heading text-[46px] font-semibold leading-tight tracking-[-0.016em] text-balance">
                O consenso erra, e dá para medir quanto.
              </h2>
              <p className="max-w-[34ch] font-heading text-[26px] font-medium leading-snug">
                A doze meses do fechamento, a mediana do Focus erra o IPCA em{" "}
                <span className="tabular">{num(h12.consenso.rmse)}</span> pontos percentuais.
                A seis meses, <span className="tabular">{num(h6.consenso.rmse)}</span>.
              </p>
              <p className="max-w-[48ch] text-[17px] leading-relaxed text-ink-soft">
                {h12.mincer_zarnowitz.leitura}. São{" "}
                <span className="tabular">{h12.n}</span> observações entre{" "}
                {h12.periodo[0].slice(0, 4)} e {h12.periodo[1].slice(0, 4)}. O gráfico ao lado
                mostra a outra metade do problema: nas vezes em que a dispersão do consenso
                implicava cerca de 70% de chance, o evento aconteceu em nenhuma delas. Cada ponto
                é uma faixa de probabilidade, e o tamanho dele é o número de observações.
              </p>
              <p className="max-w-[48ch] text-[15px] leading-relaxed text-ink-soft">
                Quando o nosso modelo publicar a primeira previsão, o erro dele entra nesta mesma
                tela, do lado do consenso, incluindo os anos em que perdermos.
              </p>
              <LinkSeta href="/entrar">Ver o histórico completo</LinkSeta>
            </div>
          </div>
        </Bloco>
      )}

      {/* 07 · SEGURANÇA */}
      <Bloco>
        <h2 className="max-w-[19ch] pb-12 font-heading text-[46px] font-semibold leading-tight tracking-[-0.016em] text-balance">
          Seu dinheiro nunca passa por aqui.
        </h2>
        <div className="grid gap-11 border-t border-rule pt-9 md:grid-cols-4">
          {[
            "Não somos corretora nem guardamos saldo.",
            "Nenhuma ordem sai daqui.",
            "Nunca pedimos senha de banco.",
            "Toda fonte é pública e tem link.",
          ].map((t) => (
            <p key={t} className="text-[19px] leading-snug">
              {t}
            </p>
          ))}
        </div>
      </Bloco>

      {/* 08 · FECHO */}
      <Bloco tom="escuro">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-[18ch] font-heading text-[52px] font-semibold leading-tight tracking-[-0.016em] text-balance">
            O número que mais nos expõe está logo acima.
          </h2>
          <div className="flex shrink-0 flex-col items-start gap-3.5">
            <Link
              href="/criar-conta"
              className="inline-flex h-14 items-center rounded-md bg-white px-8 text-[17px] font-semibold text-tinta transition-opacity hover:opacity-90"
            >
              Criar conta
            </Link>
            <span className="max-w-[32ch] text-sm leading-normal text-tinta-suave">
              Teste de 14 dias, sem cartão e sem CPF.
            </span>
          </div>
        </div>
      </Bloco>

      <Rodape geradoEm={backtestGeradoEm} />
    </main>
  );
}

/**
 * Faixa da landing. O tom de fundo alterna para a página não virar um lençol
 * branco de ponta a ponta — são neutros, nunca cor de marca, então nada aqui
 * compete com o significado de petróleo e ocre.
 */
function Bloco({
  children,
  tom = "branco",
}: {
  children: React.ReactNode;
  tom?: "branco" | "claro" | "escuro";
}) {
  const fundo = {
    branco: "",
    claro: "bg-surface-3",
    escuro: "bg-tinta text-white",
  }[tom];

  return (
    <div className={fundo}>
      <section className="mx-auto max-w-[1440px] px-10 py-38 md:px-40">{children}</section>
    </div>
  );
}

function Legenda({ cor, children }: { cor: "modelo" | "consenso"; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-3 text-[17px]">
      <span
        className={`inline-block size-2 shrink-0 -translate-y-0.5 rounded-full ${cor === "modelo" ? "bg-modelo" : "bg-consenso"}`}
      />
      <span>{children}</span>
    </p>
  );
}

function Cabecalho({ logado }: { logado: boolean }) {
  return (
    /*
     * Marca solta, links numa pílula, ação em outra. Ancora sem barra: a régua
     * de ponta a ponta pesava demais e a caixa única ficava bruta. Não é fixa
     * na rolagem — barra grudada rouba altura da dobra numa página que se lê de
     * cima para baixo uma vez só.
     */
    <header className="relative mx-auto w-full max-w-[1440px] px-10 pt-7 md:px-40">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Nônio, página inicial" className="flex items-center gap-3">
            <Marca />
            <span className="font-heading text-[21px] font-semibold tracking-tight">Nônio</span>
          </Link>

          <nav className="ml-3 hidden h-11 items-center gap-1 rounded-full border border-rule bg-surface-2/70 px-1.5 backdrop-blur-sm sm:flex">
            {[
              { href: "/sobre", rotulo: "Sobre" },
              { href: "/precos", rotulo: "Preço" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex h-8 items-center rounded-full px-4 text-[14.5px] text-ink-soft transition-colors hover:bg-white hover:text-ink"
              >
                {l.rotulo}
              </Link>
            ))}
          </nav>
        </div>

        {/*
          Com sessão aberta, oferecer "Entrar" mente sobre o estado de quem
          está lendo: a pessoa clica, o guarda desvia para o painel, e parece
          defeito. O cabeçalho tem que dizer a verdade sobre quem está logado.
        */}
        <div className="flex items-center gap-2">
          {logado ? (
            <Link
              href="/macro"
              className="inline-flex h-11 items-center rounded-full bg-modelo px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-modelo-forte"
            >
              Ir para o painel
            </Link>
          ) : (
            <>
              <Link
                href="/entrar"
                className="inline-flex h-11 items-center rounded-full px-5 text-[14.5px] text-ink-soft transition-colors hover:text-ink"
              >
                Entrar
              </Link>
              <Link
                href="/criar-conta"
                className="inline-flex h-11 items-center rounded-full bg-modelo px-6 text-[14.5px] font-semibold text-white transition-colors hover:bg-modelo-forte"
              >
                Criar conta
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Rodape({ geradoEm }: { geradoEm: string }) {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-10 py-11 md:px-40">
        <div className="flex flex-col gap-6 md:flex-row md:items-baseline md:justify-between">
          <span className="font-heading text-[19px] font-semibold">Nônio</span>
          <nav className="flex flex-wrap gap-8 text-sm text-ink-soft">
            <Link href="/sobre" className="hover:text-ink">Sobre</Link>
            <Link href="/precos" className="hover:text-ink">Preço</Link>
            <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
            <Link href="/termos" className="hover:text-ink">Termos</Link>
            <Link href="/contato" className="hover:text-ink">Contato</Link>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-6 text-[12.5px] leading-relaxed text-ink-soft md:flex-row">
          <p className="max-w-[86ch]">
            Não constitui recomendação de investimento. Não indicamos compra ou venda, não
            realizamos análise de valores mobiliários na forma da Resolução CVM 20 e não
            distribuímos produtos financeiros. Probabilidade não é promessa, e resultado passado não
            garante resultado futuro.
          </p>
          <p className="shrink-0 font-mono md:text-right">
            Banco Central · CVM · IBGE · Tesouro · B3
            <br />
            backtest de {dataLonga(geradoEm)}
          </p>
        </div>
      </div>
    </footer>
  );
}

function IconeExterno() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 2.5H2.5v9h9V9" />
      <path d="M8 2.5h3.5V6" />
      <path d="M11.5 2.5 6.5 7.5" />
    </svg>
  );
}

function IconeX() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--negativo)" strokeWidth={1.8} strokeLinecap="round" className="shrink-0" aria-hidden>
      <path d="M5 5 15 15M15 5 5 15" />
    </svg>
  );
}
