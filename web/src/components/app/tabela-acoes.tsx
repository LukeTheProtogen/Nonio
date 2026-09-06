"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Acao } from "@/lib/api/contratos";
import { LENTES, type Lente } from "@/mock/acoes";
import { num, pctSinal, pp, moeda, probabilidade, corDelta } from "@/lib/formato";

/**
 * O universo em três lentes.
 *
 * Uma pergunta por vista, nunca as três ao mesmo tempo. A versão anterior
 * mostrava quinze colunas e obrigava a rolar para o lado; ninguém compara
 * quinze números, então na prática ela não respondia a pergunta nenhuma.
 *
 * A probabilidade fica FORA das lentes, numa coluna própria à direita, sempre
 * visível. Retorno e risco são fato medido; a probabilidade é o nosso modelo
 * opinando. Enfileirar as duas na mesma régua apagaria a diferença, e a
 * diferença é o produto.
 */

const COLUNAS: Record<Lente, { rotulo: string; dica?: string; largura?: string }[]> = {
  retorno: [
    {
      rotulo: "Retorno em 12 meses, contra o CDI",
      dica: "Barra é o papel, traço é o CDI no mesmo período",
      largura: "w-[280px]",
    },
    { rotulo: "Acima do CDI", dica: "Diferença em pontos percentuais", largura: "w-[124px] pr-6" },
  ],
  risco: [
    { rotulo: "Volatilidade", dica: "Desvio anualizado dos retornos diários" },
    { rotulo: "Pior queda", dica: "Do topo ao fundo, no período" },
    {
      rotulo: "Recuperou em",
      dica: "Pregões até voltar ao topo anterior",
      largura: "w-[130px] pr-6",
    },
  ],
  contexto: [
    { rotulo: "Juros +1 p.p.", dica: "Resposta estimada a uma alta de 100 pontos-base" },
    { rotulo: "Dólar +1%", dica: "Resposta estimada a uma alta de 1% no câmbio" },
    {
      rotulo: "Fatos em 30d",
      dica: "Comunicados obrigatórios no último mês",
      largura: "w-[110px] pr-6",
    },
  ],
};

export function TabelaAcoes({
  acoes,
  lente,
  cdi12m,
  selecionado,
}: {
  acoes: Acao[];
  lente: Lente;
  cdi12m: number;
  selecionado?: string;
}) {
  const router = useRouter();

  /*
    Uma escala só para a coluna inteira. Se cada linha normalizasse pelo próprio
    valor, todas as barras teriam o mesmo tamanho e a coluna não compararia
    nada — que é o único motivo de a barra existir.
  */
  const escala = Math.max(
    ...acoes.map((a) => Math.abs(a.retorno12m)),
    Math.abs(cdi12m),
  ) * 1.08;

  return (
    <div className="min-w-0">
      {/*
        No celular a tabela vira LISTA DE CARTÕES.

        Doze colunas em 390px não cabem, e rolar de lado numa tabela é o pior
        dos dois mundos: some o papel ao ver o número, some o número ao ver o
        papel. O cartão põe ticker e valores da lente na vertical, e cada linha
        vira uma unidade que se lê sem mover a tela.

        A tabela continua a partir de `md`, onde comparar coluna a coluna é o
        gesto certo e há largura para isso.
      */}
      <ul className="flex flex-col md:hidden">
        {acoes.map((a) => (
          <CartaoAcao key={a.ticker} acao={a} lente={lente} selecionado={selecionado === a.ticker} />
        ))}
      </ul>

      <div className="hidden min-w-0 overflow-x-auto md:block">
      <table className="w-full min-w-[860px] border-collapse text-[14px]">
        <thead>
          <tr className="border-y border-rule text-left">
            <Th className="w-[210px]">Papel</Th>
            <Th className="w-[110px] text-right">Preço</Th>
            {COLUNAS[lente].map((c) => (
              <Th
                key={c.rotulo}
                /*
                  `whitespace-nowrap` e largura própria: "Contra o CDI" quebrava
                  em duas linhas e a segunda saía cortada pela borda da célula.
                  Cabeçalho de coluna não quebra — ou cabe, ou encurta.
                */
                className={`whitespace-nowrap text-right ${c.largura ?? ""}`}
                title={c.dica}
              >
                {c.rotulo}
              </Th>
            ))}
            <Th className="w-[112px] border-l border-rule text-right" title="Do nosso modelo, não do mercado">
              Probabilidade
            </Th>
          </tr>
        </thead>

        <tbody>
          {acoes.map((a) => (
            <tr
              key={a.ticker}
              /*
                A LINHA INTEIRA abre a janela, do ticker até a probabilidade.

                Antes só o ticker era clicável: quem estava lendo a coluna de
                risco tinha que voltar o mouse quinze centímetros para a
                esquerda só para abrir o papel que já estava olhando. Alvo de
                clique tem que ficar onde o olho está.
              */
              onClick={(e) => {
                /*
                  Clique com modificador é "abrir em outra aba", e quem trata
                  isso é o link do ticker, com href de verdade. Empurrar a rota
                  aqui roubaria o gesto e abriria na mesma aba.
                */
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if ((e.target as HTMLElement).closest("a")) return;
                router.push(`/acoes?lente=${lente}&papel=${a.ticker}`, { scroll: false });
              }}
              className={`cursor-pointer border-b border-rule-soft transition-colors hover:bg-surface-2 ${
                selecionado === a.ticker ? "bg-modelo-lavado" : ""
              }`}
            >
              <td className="py-2.5 pr-4">
                {/*
                  A linha inteira abre a janela, mas quem clica é um link de
                  verdade: dá para abrir em nova aba, copiar o endereço e voltar
                  pelo botão do navegador. Div com onClick não faz nada disso.
                */}
                <Link
                  href={`/acoes?lente=${lente}&papel=${a.ticker}`}
                  scroll={false}
                  className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
                >
                  <span className="font-mono font-medium">{a.ticker}</span>
                  <span className="text-[12px] text-ink-soft">
                    {a.nome} · {a.setor}
                  </span>
                </Link>
              </td>

              <td className="py-2.5 text-right font-mono tabular">
                {a.preco === null ? (
                  <span className="text-referencia" title="Sem BRAPI_TOKEN esta cotação não vem">
                    —
                  </span>
                ) : (
                  <span className="flex flex-col items-end">
                    <span>{moeda(a.preco)}</span>
                    {a.variacaoDiaPct !== null && (
                      <span className={`text-[11.5px] ${corDelta(a.variacaoDiaPct)}`}>
                        {pctSinal(a.variacaoDiaPct)}
                      </span>
                    )}
                  </span>
                )}
              </td>

              {lente === "retorno" && (
                <>
                  <td className="py-2.5 pl-6">
                    <BarraCdi retorno={a.retorno12m} cdi={cdi12m} escala={escala} />
                  </td>
                  {/* `pr-6`: o número encostava na borda da coluna seguinte, e
                      dígito colado em régua vertical fica ilegível. */}
                  <td
                    className={`py-2.5 pr-6 text-right font-mono tabular ${corDelta(a.acimaDoCdi)}`}
                  >
                    {pp(a.acimaDoCdi)}
                  </td>
                </>
              )}

              {lente === "risco" && (
                <>
                  <Num v={a.vol12m} formato={(v) => `${num(v, 0)}%`} />
                  <Num v={a.piorQueda} formato={(v) => `${num(v, 1)}%`} colorir />
                  {/* `pr-6` na última célula da lente: sem ele o texto encosta
                      na régua da coluna seguinte e fica ilegível. */}
                  <td className="py-2.5 pr-6 text-right font-mono tabular">
                    {a.diasAteOPico === 0 ? (
                      <span className="text-negativo" title="Ainda abaixo do topo anterior">
                        ainda não
                      </span>
                    ) : (
                      `${a.diasAteOPico} pregões`
                    )}
                  </td>
                </>
              )}

              {lente === "contexto" && (
                <>
                  <Num v={a.sensJuros100bp} formato={(v) => `${num(v, 1)}%`} colorir />
                  <Num v={a.sensDolar1pct} formato={(v) => `${num(v, 1)}%`} colorir />
                  <td className="py-2.5 pr-6 text-right font-mono tabular">
                    {a.fatos30d === 0 ? <span className="text-referencia">—</span> : a.fatos30d}
                  </td>
                </>
              )}

              <td className="border-l border-rule py-2.5 text-right font-mono font-medium text-modelo tabular">
                {a.probabilidade ? (
                  probabilidade(a.probabilidade.pAlta)
                ) : (
                  <span
                    className="font-normal text-referencia"
                    title="O modelo ainda não publicou previsão para este papel"
                  >
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="pt-3.5 text-[12.5px] leading-relaxed text-ink-soft">
        {LENTES[lente].descricao}
        {lente === "retorno" && (
          <>
            {" "}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-4 bg-ink" /> o papel
            </span>
            {"  "}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-px bg-consenso" /> CDI no período,{" "}
              {num(cdi12m)}%
            </span>
          </>
        )}
        {lente === "contexto" &&
          " Sensibilidade estimada por regressão de fatores de três anos, não é previsão."}
      </p>
    </div>
  );
}

/**
 * Retorno do papel contra o CDI, na mesma régua.
 *
 * A barra é o papel; o traço vertical é o CDI. Barra passando do traço quer
 * dizer que rendeu mais que a renda fixa, e é a leitura que a coluna existe
 * para dar em um relance — o número ao lado confirma, não substitui.
 *
 * O zero fica fixo no mesmo lugar em todas as linhas, senão papéis com retorno
 * negativo desalinhariam a coluna e a comparação visual morreria.
 */
function BarraCdi({
  retorno,
  cdi,
  escala,
}: {
  retorno: number;
  cdi: number;
  escala: number;
}) {
  // Metade da largura para cada lado do zero, para caber retorno negativo.
  const meio = 50;
  const larguraBarra = (Math.abs(retorno) / escala) * meio;
  const positivo = retorno >= 0;
  const posCdi = meio + (cdi / escala) * meio;

  return (
    <div className="relative h-4 w-full min-w-[180px]" title={`CDI no período: ${num(cdi)}%`}>
      {/* zero */}
      <span className="absolute inset-y-0 left-1/2 w-px bg-rule" />

      <span
        className="absolute top-1 h-2.5 rounded-[1px]"
        style={{
          left: positivo ? `${meio}%` : `${meio - larguraBarra}%`,
          width: `${Math.max(larguraBarra, 0.6)}%`,
          background: positivo ? "var(--ink)" : "var(--negativo)",
        }}
      />

      {/* O CDI: traço fino e alto, para não ser lido como parte da barra. */}
      <span
        className="absolute -top-0.5 h-5 w-px bg-consenso"
        style={{ left: `${posCdi}%` }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Um papel, no celular.
 *
 * O que aparece é decidido pela lente, igual à tabela: mesma informação, outra
 * disposição. A probabilidade fica sempre à direita do ticker porque é a coluna
 * que não pertence a lente nenhuma — é o nosso modelo, e ela acompanha o papel
 * em qualquer vista.
 *
 * O cartão inteiro é link. Alvo de toque de 44px é o mínimo do iOS, e uma
 * linha de tabela com 20px de altura não é tocável com o polegar.
 */
function CartaoAcao({
  acao: a,
  lente,
  selecionado,
}: {
  acao: Acao;
  lente: Lente;
  selecionado: boolean;
}) {
  const campos: { rotulo: string; valor: React.ReactNode }[] =
    lente === "retorno"
      ? [
          { rotulo: "12 meses", valor: <Cor v={a.retorno12m}>{pctSinal(a.retorno12m)}</Cor> },
          { rotulo: "Acima do CDI", valor: <Cor v={a.acimaDoCdi}>{pp(a.acimaDoCdi)}</Cor> },
        ]
      : lente === "risco"
        ? [
            { rotulo: "Volatilidade", valor: `${num(a.vol12m, 0)}%` },
            { rotulo: "Pior queda", valor: <Cor v={a.piorQueda}>{num(a.piorQueda, 1)}%</Cor> },
            {
              rotulo: "Recuperou em",
              valor:
                a.diasAteOPico === 0 ? (
                  <span className="text-negativo">ainda não</span>
                ) : (
                  `${a.diasAteOPico} pregões`
                ),
            },
          ]
        : [
            { rotulo: "Juros +1 p.p.", valor: <Cor v={a.sensJuros100bp}>{num(a.sensJuros100bp, 1)}%</Cor> },
            { rotulo: "Dólar +1%", valor: <Cor v={a.sensDolar1pct}>{num(a.sensDolar1pct, 1)}%</Cor> },
            {
              rotulo: "Fatos em 30d",
              valor: a.fatos30d === 0 ? <span className="text-referencia">—</span> : a.fatos30d,
            },
          ];

  return (
    <li>
      <Link
        href={`/acoes?lente=${lente}&papel=${a.ticker}`}
        scroll={false}
        className={`flex flex-col gap-3 border-b border-rule-soft py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-modelo ${
          selecionado ? "bg-modelo-lavado" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 flex-col">
            <span className="font-mono text-[15px] font-medium">{a.ticker}</span>
            <span className="truncate text-[12.5px] text-ink-soft">
              {a.nome} · {a.setor}
            </span>
          </span>

          <span className="flex shrink-0 flex-col items-end">
            <span className="font-mono text-[15px] font-medium text-modelo tabular">
              {a.probabilidade ? (
                probabilidade(a.probabilidade.pAlta)
              ) : (
                <span className="font-normal text-referencia">—</span>
              )}
            </span>
            <span className="text-[11px] text-ink-soft">probabilidade</span>
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Campo rotulo="Preço">
            {a.preco === null ? (
              <span className="text-referencia">—</span>
            ) : (
              <>
                {moeda(a.preco)}
                {a.variacaoDiaPct !== null && (
                  <span className={`pl-1.5 text-[12px] ${corDelta(a.variacaoDiaPct)}`}>
                    {pctSinal(a.variacaoDiaPct)}
                  </span>
                )}
              </>
            )}
          </Campo>
          {campos.map((c) => (
            <Campo key={c.rotulo} rotulo={c.rotulo}>
              {c.valor}
            </Campo>
          ))}
        </div>
      </Link>
    </li>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[10.5px] tracking-[0.06em] text-ink-soft uppercase">{rotulo}</span>
      <span className="font-mono text-[13.5px] tabular">{children}</span>
    </span>
  );
}

/** Verde e vermelho só onde o sinal significa alguma coisa. */
function Cor({ v, children }: { v: number; children: React.ReactNode }) {
  return <span className={corDelta(v)}>{children}</span>;
}

function Th({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={`py-2.5 text-[11px] font-medium uppercase tracking-[0.07em] text-ink-soft ${className}`}
    >
      {children}
    </th>
  );
}

/** Célula numérica. Verde e vermelho só onde o sinal significa alguma coisa. */
function Num({
  v,
  formato,
  colorir,
}: {
  v: number;
  formato: (v: number) => string;
  colorir?: boolean;
}) {
  return (
    <td className={`py-2.5 text-right font-mono tabular ${colorir ? corDelta(v) : ""}`}>
      {formato(v)}
    </td>
  );
}
