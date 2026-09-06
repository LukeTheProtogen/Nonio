import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPublica, Secao, Lista, Nota } from "@/components/marketing/pagina-publica";
import { porHorizonte } from "@/lib/backtest";
import { num } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "O que o Nônio é, o que não é, e por que a discordância entre instituições vale mais que a média delas.",
};

/**
 * Sobre.
 *
 * Não é página institucional. É a página que responde à pergunta que a landing
 * levanta e não termina de responder: por que olhar a discordância em vez da
 * média. Os números vêm do backtest real, os mesmos da landing — se um dia
 * divergirem, é bug.
 */
export default function Sobre() {
  const h12 = porHorizonte(12);

  return (
    <PaginaPublica
      chapeu="Sobre"
      titulo="A média esconde a discórdia."
      resumo="O Boletim Focus é público desde 2000 e quase ninguém fora do mercado o abre. Nós abrimos, e mostramos a distribuição inteira em vez do número do meio."
    >
      <Secao titulo="O nome">
        <p>
          Nônio é a escala auxiliar do paquímetro. Ela não mede nada sozinha: desliza sobre a
          escala principal e revela a fração que a principal não consegue mostrar. A leitura
          continua sendo de quem segura o instrumento.
        </p>
        <p>
          É exatamente a relação que queremos ter com quem usa o produto. O mercado é a escala
          principal. Nós somos o traço que deixa ver a casa decimal. A decisão nunca é nossa.
        </p>
      </Secao>

      <Secao titulo="O que fazemos">
        <p>
          Todo mês o Banco Central publica o que mais de cem instituições projetam para inflação,
          juros, câmbio e atividade. O que circula na imprensa é a mediana. O que quase nunca
          circula é o desvio entre elas, e é aí que está a informação.
        </p>
        <Lista
          itens={[
            "Reconstruímos a forma da discordância a partir da estatística agregada que o Banco Central publica.",
            "Medimos o erro histórico desse consenso contra o que de fato aconteceu, horizonte por horizonte.",
            "Transformamos isso em probabilidade, com a fonte de cada número a um clique.",
          ]}
        />
      </Secao>

      <Secao titulo="O que não fazemos">
        <p>
          Não indicamos compra nem venda. Não somos analista de valores mobiliários na forma da
          Resolução CVM 20, não somos consultor na forma da Resolução CVM 19 e não distribuímos
          produto financeiro. Não recebemos de corretora, gestora ou emissor.
        </p>
        <Nota>
          Não ganhamos nada quando você compra ou vende. A única receita é a assinatura de quem
          usa, e é assim que se mantém o incentivo alinhado com a leitura correta em vez do
          giro.
        </Nota>
      </Secao>

      <Secao titulo="Por que medimos o consenso, e não a nós mesmos">
        <p>
          Um modelo que ainda não publicou previsão não tem histórico para exibir, e exibir
          histórico simulado como se fosse acerto é o truque mais velho do setor. Então
          começamos pelo que já dá para medir com dado real: o quanto o consenso erra.
        </p>
        {h12 ? (
          <p>
            A doze meses do fechamento, a mediana do Focus erra o IPCA em{" "}
            <span className="font-mono text-ink tabular">{num(h12.consenso.mae)}</span> pontos
            percentuais, em média, ao longo de{" "}
            <span className="font-mono text-ink tabular">{h12.n}</span> observações entre{" "}
            {h12.periodo[0].slice(0, 4)} e {h12.periodo[1].slice(0, 4)}.
          </p>
        ) : null}
        <p>
          Quando tivermos previsão nossa em produção, ela vai ser medida com a mesma régua,
          publicamente, inclusive quando o resultado for ruim.
        </p>
      </Secao>

      <Secao titulo="De onde vêm os dados">
        <Lista
          itens={[
            "Banco Central — Boletim Focus, séries do SGS e atas do Copom.",
            "IBGE — IPCA e as demais séries de preços.",
            "Tesouro Nacional — curva de juros e títulos indexados.",
            "B3 — cotações e contratos futuros.",
            "CVM — informes e fatos relevantes.",
          ]}
        />
        <p>
          Tudo público, tudo rastreável. Nenhum dado exclusivo, nenhuma fonte que você não possa
          conferir sozinho. Se o número da tela não bate com a origem, o erro é nosso e queremos
          saber:{" "}
          <Link href="/contato" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
            fale com a gente
          </Link>
          .
        </p>
      </Secao>
    </PaginaPublica>
  );
}
