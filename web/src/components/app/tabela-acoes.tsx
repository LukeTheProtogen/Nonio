import Link from "next/link";
import type { Acao } from "@/lib/api/contratos";
import { LENTES, type Lente } from "@/mock/acoes";
import { num, pctSinal, moeda, probabilidade, corDelta } from "@/lib/formato";

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

const COLUNAS: Record<Lente, { rotulo: string; dica?: string }[]> = {
  retorno: [
    { rotulo: "12 meses" },
    { rotulo: "Contra o CDI", dica: "Quanto rendeu além do CDI no mesmo período" },
  ],
  risco: [
    { rotulo: "Volatilidade", dica: "Desvio anualizado dos retornos diários" },
    { rotulo: "Pior queda", dica: "Do topo ao fundo, no período" },
    { rotulo: "Recuperou em", dica: "Pregões até voltar ao topo anterior" },
  ],
  contexto: [
    { rotulo: "Juros +1 p.p.", dica: "Resposta estimada a uma alta de 100 pontos-base" },
    { rotulo: "Dólar +1%", dica: "Resposta estimada a uma alta de 1% no câmbio" },
    { rotulo: "Fatos em 30d", dica: "Comunicados obrigatórios no último mês" },
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
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-[14px]">
        <thead>
          <tr className="border-y border-rule text-left">
            <Th className="w-[210px]">Papel</Th>
            <Th className="w-[110px] text-right">Preço</Th>
            {COLUNAS[lente].map((c) => (
              <Th key={c.rotulo} className="text-right" title={c.dica}>
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
              className={`border-b border-rule-soft transition-colors hover:bg-surface-2 ${
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
                  <Num v={a.retorno12m} formato={pctSinal} colorir />
                  <Num v={a.acimaDoCdi} formato={pctSinal} colorir />
                </>
              )}

              {lente === "risco" && (
                <>
                  <Num v={a.vol12m} formato={(v) => `${num(v, 0)}%`} />
                  <Num v={a.piorQueda} formato={(v) => `${num(v, 1)}%`} colorir />
                  <td className="py-2.5 text-right font-mono tabular">
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
                  <td className="py-2.5 text-right font-mono tabular">
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

      <p className="pt-3.5 text-[12.5px] leading-relaxed text-ink-soft">
        {LENTES[lente].descricao}
        {lente === "retorno" && ` CDI de ${num(cdi12m)}% no período.`}
        {lente === "contexto" &&
          " Sensibilidade estimada por regressão de fatores de três anos, não é previsão."}
      </p>
    </div>
  );
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
