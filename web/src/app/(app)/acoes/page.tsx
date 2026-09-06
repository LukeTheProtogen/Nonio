import type { Metadata } from "next";
import Link from "next/link";
import { obterAcoes, obterAcao, obterCopom } from "@/lib/api/servico";
import type { CopomReuniao } from "@/lib/api/contratos";
import { LENTES, ehLente, type Lente } from "@/mock/acoes";
import { TabelaAcoes } from "@/components/app/tabela-acoes";
import { JanelaPapel } from "@/components/app/janela-papel";
import { BarraSuperior } from "@/components/app/barra-superior";
import { num } from "@/lib/formato";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";

export const metadata: Metadata = { title: "Ações" };

/**
 * Copom é global, não do papel. Se a extração falhar, a janela ainda abre —
 * só sem a linha da Selic. Derrubar o painel inteiro por uma ata seria
 * punir o preço, que chegou.
 */
async function copomOuVazio(): Promise<CopomReuniao[]> {
  try {
    return await obterCopom();
  } catch {
    return [];
  }
}

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

  const [{ acoes, cdi12m, limitadoSemToken }, detalhe, copom] = await Promise.all([
    obterAcoes(),
    papel ? obterAcao(papel) : Promise.resolve(null),
    papel ? copomOuVazio() : Promise.resolve([] as CopomReuniao[]),
  ]);

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

      <div className="flex flex-1 flex-col px-5 pt-6 md:px-9 md:pt-7 lg:min-h-0 lg:overflow-y-auto">
        <header className="flex flex-wrap items-end justify-between gap-6 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="t-tela">
              Uma pergunta por vez
            </h1>
            <p className="t-rotulo max-w-[54ch] text-ink-soft">
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

        {/*
          Estado vazio explícito.
          
          Sem ele a tela mostrava cabeçalho de tabela, legenda e NADA no meio,
          o que lê como defeito de carregamento. Vazio é um resultado legítimo
          aqui — o universo vem do pipeline, e enquanto ele não publicar não há
          papel nenhum. A tela diz isso em vez de deixar o silêncio explicar.
        */}
        {acoes.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-rule bg-surface-2 px-6 py-8">
            <p className="t-cartao">Nenhum papel no universo ainda</p>
            <p className="t-rotulo max-w-[54ch] text-ink-soft">
              O universo é publicado pelo pipeline, e ele ainda não rodou nesta instância. As
              telas de macro e histórico não dependem disto e continuam com dado real.
            </p>
          </div>
        ) : (
          <TabelaAcoes
            acoes={acoes}
            lente={lente}
            cdi12m={cdi12m}
            selecionado={papel ?? undefined}
          />
        )}

        <footer className="mt-auto flex shrink-0 flex-col justify-between gap-2 border-t border-rule py-3.5 text-xs text-ink-soft md:flex-row md:gap-8">
          <span>{DISCLAIMER_MEDIO}</span>
          <span className="font-mono">CDI 12m {num(cdi12m)}%</span>
        </footer>
      </div>

      {detalhe && (
        <JanelaPapel
          detalhe={detalhe}
          lente={lente}
          anterior={anterior}
          proximo={proximo}
          copom={copom}
        />
      )}
    </>
  );
}
