import Link from "next/link";
import { Marca } from "./marca";
import { dataLonga } from "@/lib/formato";

/**
 * Cabeçalho e rodapé do lado público.
 *
 * Moram aqui, e não dentro da landing, porque a landing não é mais a única
 * página pública: sobre, preço, termos, privacidade e contato usam a mesma
 * moldura. Duplicar a navegação é como um link novo aparece em quatro páginas
 * e falta na quinta.
 */

export function Cabecalho({ logado }: { logado: boolean }) {
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
export function Rodape({ geradoEm }: { geradoEm: string }) {
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