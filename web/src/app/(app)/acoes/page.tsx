import type { Metadata } from "next";
import Link from "next/link";
import { obterAcoes, obterAcao } from "@/lib/api/servico";
import { LENTES, ehLente, type Lente } from "@/mock/acoes";
import { TabelaAcoes } from "@/components/app/tabela-acoes";
import { JanelaPapel } from "@/components/app/janela-papel";
import { BarraSuperior } from "@/components/app/barra-superior";
import { num } from "@/lib/formato";

export const metadata: Metadata = { title: "Ações" };

/**
 * Universo de papéis.
 *
 * Lente e papel aberto moram na URL, não em estado de componente. Três coisas
 * saem de graça disso: o link pode ser mandado para outra pessoa, o botão
 * voltar do navegador funciona, e recarregar a página não perde o lugar.
 */
export default async function Acoes({ searchParams }: PageProps<"/acoes">) {
  const params = await searchParams;

  const bruto = typeof params.lente === "string" ? params.lente : undefined;
  const lente: Lente = ehLente(bruto) ? bruto : "retorno";

  const papel = typeof params.papel === "string" ? params.papel.toUpperCase() : null;

  const { acoes, cdi12m, limitadoSemToken } = await obterAcoes();
  const detalhe = papel ? await obterAcao(papel) : null;

  // Vizinhos para as setas da janela, na ordem em que a tabela está mostrando.
  const i = papel ? acoes.findIndex((a) => a.ticker === papel) : -1;
  const anterior = i > 0 ? acoes[i - 1]!.ticker : null;
  const proximo = i >= 0 && i < acoes.length - 1 ? acoes[i + 1]!.ticker : null;

  const comCotacao = acoes.filter((a) => a.preco !== null).length;

  return (
    <>
      <BarraSuperior titulo="Ações" mock>
        <span className="font-mono text-xs text-ink-soft">
          {acoes.length} papéis · {comCotacao} com cotação
        </span>
      </BarraSuperior>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-9 pt-7">
        <header className="flex flex-wrap items-end justify-between gap-6 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold leading-tight">
              Uma pergunta por vez
            </h1>
            <p className="max-w-[54ch] text-[14.5px] leading-relaxed text-ink-soft">
              Quinze colunas lado a lado não se comparam. Escolha o que quer saber, e clique no
              papel para abrir o resto.
            </p>
          </div>

          <nav className="flex gap-1 rounded-full border border-rule bg-surface-2 p-1">
            {(Object.keys(LENTES) as Lente[]).map((l) => (
              <Link
                key={l}
                href={`/acoes?lente=${l}${papel ? `&papel=${papel}` : ""}`}
                scroll={false}
                aria-current={lente === l}
                className={`inline-flex h-8 items-center rounded-full px-4 text-[13.5px] font-medium transition-colors ${
                  lente === l
                    ? "bg-modelo text-white"
                    : "text-ink-soft hover:bg-white hover:text-ink"
                }`}
              >
                {LENTES[l].rotulo}
              </Link>
            ))}
          </nav>
        </header>

        {limitadoSemToken && (
          <p className="mb-5 border-l-2 border-atencao bg-atencao-fundo px-4 py-3 text-[13px] leading-relaxed">
            Sem <span className="font-mono">BRAPI_TOKEN</span>, só PETR4, VALE3, ITUB4 e MGLU3
            têm cotação. Os outros papéis aparecem com traço no preço, e as demais colunas
            continuam válidas.
          </p>
        )}

        <TabelaAcoes acoes={acoes} lente={lente} cdi12m={cdi12m} selecionado={papel ?? undefined} />

        <footer className="mt-auto flex justify-between gap-8 border-t border-rule py-3.5 text-xs text-ink-soft">
          <span>
            Retorno, risco e contexto são descrição do passado. Probabilidade é do nosso modelo.
            Não é recomendação de investimento.
          </span>
          <span className="font-mono">CDI 12m {num(cdi12m)}%</span>
        </footer>
      </div>

      {detalhe && (
        <JanelaPapel detalhe={detalhe} lente={lente} anterior={anterior} proximo={proximo} />
      )}
    </>
  );
}
