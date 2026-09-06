import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPublica, Secao, Nota } from "@/components/marketing/pagina-publica";
import { PLANOS, type Plano } from "@/mock/planos";
import { moeda } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Preço",
  description:
    "Assinatura simples, sem comissão de corretora e sem taxa por operação. A receita vem de quem usa.",
};

/**
 * Preço.
 *
 * Uma tabela de três colunas com preço visível é o mínimo: preço escondido
 * atrás de "fale com vendas" contradiz uma página inteira sobre transparência.
 *
 * O plano do meio é o recomendado e é o único com contorno. Nada de "mais
 * popular" em fita colorida — se é o recomendado, o texto diz por quê.
 */
export default function Precos() {
  return (
    <PaginaPublica
      chapeu="Preço"
      titulo="Você paga, e é só isso."
      resumo="Sem comissão de corretora, sem taxa por operação, sem repasse de gestora. A única receita é a assinatura, o que mantém o incentivo do nosso lado da mesa."
    >
      <section className="grid gap-5 md:grid-cols-3">
        {PLANOS.map((p) => (
          <Cartao key={p.slug} plano={p} />
        ))}
      </section>

      <Secao titulo="O que está incluído em todos">
        <p>
          Fonte rastreável em cada número, exportação do que você vê, e o histórico completo das
          séries desde o início da publicação. Nada de dado premium escondido atrás de degrau de
          preço: o que muda entre os planos é volume e frequência, não a verdade dos números.
        </p>
      </Secao>

      <Secao titulo="Cancelamento">
        <p>
          Mensal, cancelável a qualquer momento pela própria conta, sem ligação e sem retenção.
          O acesso vai até o fim do período já pago. Anual devolvido proporcionalmente se
          cancelado nos primeiros trinta dias.
        </p>
      </Secao>

      <Nota>
        Valores em desenvolvimento e ainda não cobrados. A cobrança só começa quando o produto
        sair do modo de demonstração, e quem já tiver conta é avisado antes.
      </Nota>

      <p className="text-[16.5px] leading-relaxed text-ink-soft">
        Dúvida sobre plano, nota fiscal ou uso em equipe?{" "}
        <Link href="/contato" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
          Fale com a gente
        </Link>
        .
      </p>
    </PaginaPublica>
  );
}

function Cartao({ plano }: { plano: Plano }) {
  const destaque = plano.recomendado;

  return (
    <article
      className={[
        "flex flex-col gap-5 rounded-lg border p-6",
        destaque ? "border-modelo bg-modelo-lavado" : "border-rule bg-surface-2",
      ].join(" ")}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-[21px] font-semibold">{plano.nome}</h2>
        <p className="text-[13.5px] leading-snug text-ink-soft">{plano.para}</p>
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="font-heading text-[38px] font-semibold leading-none tabular">
          {plano.mensal === 0 ? "Grátis" : moeda(plano.mensal, 0)}
        </span>
        {plano.mensal > 0 ? <span className="text-[13.5px] text-ink-soft">por mês</span> : null}
      </p>

      <ul className="flex flex-col gap-2 text-[14.5px] leading-snug">
        {plano.inclui.map((linha) => (
          <li key={linha} className="flex gap-2.5">
            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-referencia" />
            <span>{linha}</span>
          </li>
        ))}
      </ul>

      <Link
        href="/criar-conta"
        className={[
          "mt-auto inline-flex h-11 items-center justify-center rounded-md px-5 text-[14.5px] font-semibold transition-colors",
          destaque
            ? "bg-modelo text-white hover:bg-modelo-forte"
            : "border border-rule bg-white text-ink hover:border-ink-soft",
        ].join(" ")}
      >
        Criar conta
      </Link>
    </article>
  );
}
