import { ImageResponse } from "next/og";
import { Cartao, COR, TAMANHO, fontes, marca } from "@/lib/og/cartao";

/**
 * Cartão de link da landing, e o padrão de todas as rotas públicas.
 *
 * Vale por herança de segmento: /sobre, /precos, /termos e as demais caem aqui
 * enquanto não tiverem o que dizer de próprio. Cartão por rota só se paga
 * quando a rota tem número próprio — seis variações do mesmo texto é
 * manutenção sem retorno.
 *
 * ESTÁTICO, ao contrário dos de /acoes, /macro e /historico. Nada aqui depende
 * de dado do dia, então o arquivo é gerado uma vez no build.
 *
 * A versão anterior desenhava tudo à mão neste arquivo, com fonte de sistema e
 * uma marca que não existe mais. O molde compartilhado resolveu as duas coisas:
 * a fonte é a do produto, e a marca é uma só para os quatro cartões.
 */
export const alt = "Nônio — pesquisa e probabilidade sobre dados públicos";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem() {
  return new ImageResponse(
    (
      <Cartao
        etiqueta="Pesquisa · Probabilidade"
        titulo="A decisão é sua."
        apoio="Nosso trabalho é não esconder nada dela."
        figura={<Nuvem />}
        rodape="Banco Central · CVM · IBGE · Tesouro · B3"
        marcaSrc={await marca()}
      />
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}

/**
 * A discordância, desenhada.
 *
 * Cada ponto é uma instituição projetando; o traço é a mediana que sai na
 * imprensa. O desenho existe para mostrar o que a mediana esconde, então os
 * pontos precisam MESMO se espalhar — uma nuvem apertada contaria a história
 * errada.
 *
 * Semente fixa, e não `Math.random()`: o cartão é regerado a cada build, e uma
 * nuvem diferente a cada vez faria o mesmo link parecer outro produto. É
 * ilustração de um formato, não amostra de um dado — por isso não leva número,
 * nem eixo, nem legenda que sugira leitura de valor.
 */
function Nuvem() {
  const rnd = prng(20260907);
  const LARGURA = 1080;
  const ALTURA = 128;

  const pontos = Array.from({ length: 132 }, () => ({
    x: 0.5 + normal(rnd) * 0.135,
    y: 0.5 + normal(rnd) * 0.26,
    r: 3 + rnd() * 4.5,
  })).filter((p) => p.x > 0.02 && p.x < 0.98);

  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: ALTURA }}>
      {pontos.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: p.x * LARGURA,
            top: Math.max(0, Math.min(ALTURA - p.r * 2, p.y * ALTURA)),
            width: p.r * 2,
            height: p.r * 2,
            borderRadius: p.r,
            background: COR.consenso,
            opacity: 0.42,
          }}
        />
      ))}

      {/* a mediana: o único número que costuma sair na imprensa */}
      <div
        style={{
          position: "absolute",
          left: LARGURA / 2,
          top: 0,
          width: 2,
          height: ALTURA,
          background: COR.modelo,
        }}
      />
    </div>
  );
}

/* Gerador com semente, para a nuvem sair igual em todo build. */
function prng(s: number) {
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function normal(r: () => number) {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
