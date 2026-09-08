import { ImageResponse } from "next/og";
import { Cartao, COR, TAMANHO, fontes, marca } from "@/lib/og/cartao";
import { obterAcoes } from "@/lib/api/servico";
import { num } from "@/lib/formato";

/**
 * Cartão de link de /acoes.
 *
 * GERADO, não estático: o número de papéis e o CDI do período mudam, e cartão
 * com número velho circulando no WhatsApp é mentira antiga com cara de dado.
 *
 * O que ele afirma é agregado e verificável na própria tela: quantos papéis
 * existem, qual foi o CDI no período e quantos renderam acima dele. Nenhum
 * papel é destacado, e isso é decisão, não descuido — apontar "o que mais
 * subiu" num cartão é o primeiro passo para virar recomendação, e o produto
 * inteiro é construído para não ser (Res. CVM 19 e 20).
 */
export const alt = "Ações no Nônio: retorno de doze meses contra o CDI, risco e probabilidade";
export const size = TAMANHO;
export const contentType = "image/png";

/*
  Uma vez por dia. A cotação se move em pregão, mas o cartão não: o que ele
  conta é o retorno de doze meses e o CDI do período, e nenhum dos dois muda
  dentro do dia a ponto de valer regerar a imagem.
*/
export const revalidate = 86400;

export default async function Imagem() {
  const { acoes, cdi12m } = await obterAcoes();

  const retornos = acoes.map((a) => a.retorno12m).sort((x, y) => y - x);
  const acimaDoCdi = retornos.filter((r) => r > cdi12m).length;

  return new ImageResponse(
    (
      <Cartao
        etiqueta="Ações"
        titulo={`${acoes.length} papéis, com o retorno dito por inteiro`}
        apoio={`${acimaDoCdi} renderam acima do CDI em doze meses. Os outros ${
          acoes.length - acimaDoCdi
        } aparecem do mesmo tamanho.`}
        figura={<Barras retornos={retornos} cdi={cdi12m} />}
        rodape={`Retorno de 12 meses · CDI do período ${num(cdi12m)}%`}
        marcaSrc={await marca()}
      />
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}

/**
 * Cada papel é uma barra, e o EIXO É O CDI.
 *
 * A primeira versão ancorava as barras no zero e cruzava o CDI por cima. Não
 * funcionou: HAPV3 caiu 82% no período, e um extremo desses come a escala
 * inteira — o CDI ficava a dezessete pixels do zero e os nove papéis que o
 * superaram viravam degraus quase iguais. A figura tinha um eixo que não era o
 * do argumento.
 *
 * Ancorada no CDI, a barra mede a única coisa que o cartão afirma: quanto
 * passou, ou quanto faltou. Para cima é acima do CDI, para baixo é abaixo, e a
 * linha em si não precisa mais ser explicada.
 *
 * A cor guarda a segunda leitura, que o eixo perdeu. Ficar abaixo do CDI e
 * PERDER VALOR não são a mesma coisa, e as duas apontam para baixo: sálvia é
 * quem rendeu menos que a renda fixa, vermelho é quem terminou com menos do
 * que começou.
 *
 * A escala para cima e para baixo é a mesma, e por isso o extremo negativo
 * domina o desenho. É deliberado: encolher o pior caso para o gráfico ficar
 * bonito é a forma mais silenciosa de mentir num cartão.
 */
function Barras({ retornos, cdi }: { retornos: number[]; cdi: number }) {
  const ALTURA = 154;
  const rel = retornos.map((r) => r - cdi);

  const acima = Math.max(...rel, 0);
  const abaixo = Math.min(...rel, 0);
  const faixa = acima - abaixo || 1;

  // Onde o CDI cai dentro da altura: proporcional ao quanto sobe e ao quanto desce.
  const yCdi = (acima / faixa) * ALTURA;
  const alturaDe = (v: number) => Math.max((Math.abs(v) / faixa) * ALTURA, 2);

  const cor = (r: number) =>
    r > cdi ? COR.modelo : r >= 0 ? COR.salvia : COR.negativo;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", position: "relative", height: ALTURA, width: "100%" }}>
        {retornos.map((r, i) => {
          const v = r - cdi;
          const alto = alturaDe(v);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i * 100) / retornos.length}%`,
                width: `${100 / retornos.length - 0.9}%`,
                top: v >= 0 ? yCdi - alto : yCdi,
                height: alto,
                background: cor(r),
                borderRadius: 2,
              }}
            />
          );
        })}

        {/* o CDI: o eixo, e não mais um traço a explicar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: yCdi,
            height: 2,
            background: COR.consenso,
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, paddingTop: 16 }}>
        <Chave traco cor={COR.consenso} rotulo={`CDI, ${num(cdi)}%`} />
        <Chave cor={COR.modelo} rotulo="acima do CDI" />
        <Chave cor={COR.salvia} rotulo="abaixo" />
        <Chave cor={COR.negativo} rotulo="perdeu valor" />
      </div>
    </div>
  );
}

function Chave({ cor, rotulo, traco }: { cor: string; rotulo: string; traco?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          display: "flex",
          width: traco ? 22 : 12,
          height: traco ? 3 : 12,
          background: cor,
          borderRadius: traco ? 0 : 2,
        }}
      />
      <span style={{ fontFamily: "Mono", fontSize: 18, color: COR.inkSoft }}>{rotulo}</span>
    </div>
  );
}
