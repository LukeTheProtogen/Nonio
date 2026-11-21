import { ImageResponse } from "next/og";
import { Cartao, COR, TAMANHO, fontes, marca } from "@/lib/og/cartao";
import { obterMacro } from "@/lib/api/servico";
import { num, dataCurta } from "@/lib/formato";

/**
 * Cartão de link de /macro.
 *
 * ═══ O DESENHO ORIGINAL NÃO PODE SER CONSTRUÍDO ═══
 *
 * O molde no canvas trazia uma tabela CONSENSO × MODELO, com uma coluna de
 * números nossos ao lado dos do Focus. Essa coluna não existe: `modelo` é
 * `null` em todo indicador macro, e a própria tela escreve "ainda não existe
 * para macro" em cada cartão. Preencher a coluna no cartão de link seria
 * inventar previsão para o lugar de maior alcance do produto — o link que
 * circula antes de qualquer pessoa abrir o site.
 *
 * O que sobra é o que a tela realmente tem, e é o argumento do produto: o Focus
 * publicado inteiro, com o DESACORDO entre as instituições, e não só a mediana
 * que sai na imprensa. O desvio é o número que ninguém mostra.
 *
 * Quando existir modelo macro, a coluna entra aqui e no cartão junto.
 */
export const alt =
  "Macro no Nônio: a distribuição inteira do Boletim Focus, não só a mediana";
export const size = TAMANHO;
export const contentType = "image/png";

/* O Focus sai toda segunda. Um dia de cache não atrasa nada e não regera à toa. */
export const revalidate = 86400;

/**
 * Os quatro que a tela mostra em destaque, na ordem em que ela mostra.
 *
 * São os nomes de exibição, não slugs: `familia` vem de `indicador` no dado
 * publicado, e ali está escrito "IPCA", não "ipca". A primeira versão filtrou
 * por slug e a tabela saiu VAZIA — cabeçalho desenhado e nada embaixo, sem
 * erro nenhum no log, porque um filtro que não casa nada é um array vazio e
 * não uma exceção.
 */
const DESTAQUE = ["IPCA", "Selic", "Câmbio", "PIB Total"];

export default async function Imagem() {
  const macro = await obterMacro();

  const ano = Math.min(...macro.indicadores.map((i) => i.ano));
  const doAno = macro.indicadores.filter((i) => i.ano === ano);

  const escolhidas = DESTAQUE.map((f) => doAno.find((i) => i.familia === f)).filter(
    (i): i is NonNullable<typeof i> => Boolean(i),
  );

  /* Rede de segurança: se os nomes mudarem de novo, o cartão mostra os quatro
     primeiros do ano em vez de uma tabela sem linha. Errar a ordem é bem menos
     grave do que publicar um quadro vazio. */
  const linhas = escolhidas.length > 0 ? escolhidas : doAno.slice(0, 4);

  return new ImageResponse(
    (
      <Cartao
        etiqueta={`Macro · ${ano}`}
        titulo="O Focus inteiro, não só a mediana"
        apoio="Onde as instituições discordam entre si, que é onde está a informação."
        figura={<Tabela linhas={linhas} />}
        rodape={`Boletim Focus de ${dataCurta(macro.coletadoEm)} · Banco Central`}
        marcaSrc={await marca()}
      />
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}

/**
 * Mediana, desvio e quantos responderam.
 *
 * A mediana é o número que circula. O DESVIO é o que o produto acrescenta, e
 * por isso está na cor do consenso enquanto a mediana fica em tinta comum:
 * quem bate o olho tem que sair sabendo que existe uma segunda coluna, não que
 * existe mais uma tabela de projeções.
 *
 * O `n` fecha a linha porque desvio sem número de respondentes é desvio de
 * amostra desconhecida, e aí não é dado, é impressão.
 */
function Tabela({
  linhas,
}: {
  linhas: {
    familia: string;
    unidade: "pct" | "brl";
    consenso: { mediana: number; dp: number; n: number | null };
  }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", paddingBottom: 10 }}>
        <span style={{ ...cabecalho, flexGrow: 1 }}>Indicador</span>
        <span style={{ ...cabecalho, width: 190, textAlign: "right", justifyContent: "flex-end" }}>
          Mediana
        </span>
        <span
          style={{ ...cabecalho, width: 190, textAlign: "right", justifyContent: "flex-end", color: COR.consenso }}
        >
          Desvio
        </span>
        <span style={{ ...cabecalho, width: 150, textAlign: "right", justifyContent: "flex-end" }}>
          Respostas
        </span>
      </div>

      {linhas.map((l) => (
        <div
          key={l.familia}
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${COR.ruleSoft}`,
            paddingTop: 11,
            paddingBottom: 11,
          }}
        >
          {/* A família, e não `nome`: `nome` é "IPCA 2026" e o ano já está na
              etiqueta do cabeçalho. Repetir encurta a coluna à toa. */}
          <span style={{ fontSize: 25, color: COR.ink, flexGrow: 1 }}>{l.familia}</span>
          <span style={{ ...celula, color: COR.ink }}>
            {l.unidade === "brl" ? num(l.consenso.mediana) : `${num(l.consenso.mediana)}%`}
          </span>
          <span style={{ ...celula, color: COR.consenso }}>{num(l.consenso.dp)}</span>
          <span style={{ ...celula, width: 150, color: COR.inkSoft }}>{l.consenso.n ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

const cabecalho = {
  display: "flex",
  fontFamily: "Mono",
  fontWeight: 500,
  fontSize: 17,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: COR.referencia,
};

const celula = {
  display: "flex",
  justifyContent: "flex-end",
  width: 190,
  fontFamily: "Mono",
  fontSize: 25,
};
