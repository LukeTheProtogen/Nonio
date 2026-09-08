import { ImageResponse } from "next/og";
import { Cartao, COR, TAMANHO, fontes, marca } from "@/lib/og/cartao";
import { obterHistorico } from "@/lib/api/servico";
import { num } from "@/lib/formato";

/**
 * Cartão de link de /historico.
 *
 * ═══ O DESENHO ORIGINAL DIZIA OUTRA COISA ═══
 *
 * O molde no canvas trazia "Quando dissemos 70%, aconteceu em 68%". Esse cartão
 * não pode existir: ele credita ao Nônio uma calibração que o Nônio não tem. A
 * tela mede o erro do CONSENSO do Focus contra o IPCA que aconteceu, e o modelo
 * macro é `null` — não há previsão nossa publicada, então não há acerto nosso a
 * medir.
 *
 * O número real é mais interessante e é do consenso: na faixa em que ele
 * indicava cerca de 72% de chance, o evento aconteceu 0% das vezes. Trocar o
 * sujeito da frase não é detalhe de redação — é a diferença entre publicar um
 * dado e inventar um.
 *
 * No dia em que existir modelo macro com histórico, este cartão se reescreve.
 */
export const alt =
  "Histórico no Nônio: o erro medido do consenso do Focus contra o IPCA que aconteceu";
export const size = TAMANHO;
export const contentType = "image/png";

/* O backtest é regerado pelo pipeline, não por pregão. Um dia basta. */
export const revalidate = 86400;

export default async function Imagem() {
  const h = await obterHistorico();

  const doze = h.horizontes.find((x) => x.horizonteMeses === 12) ?? h.horizontes.at(-1)!;
  const ano0 = doze.periodo[0].slice(0, 4);
  const ano1 = doze.periodo[1].slice(0, 4);

  return new ImageResponse(
    (
      <Cartao
        etiqueta="Histórico"
        titulo={`O consenso erra ${num(doze.consenso.mae)} ponto a doze meses`}
        /* Uma linha só. Em duas, a figura descia e o rodapé encostava nela. */
        apoio={`Mediana do Focus contra o IPCA que aconteceu, em ${doze.n} observações.`}
        figura={<Trilha itens={h.horizontes} />}
        rodape={`Erro absoluto médio em p.p. · ${h.indicador} · ${ano0} a ${ano1}`}
        marcaSrc={await marca()}
      />
    ),
    { ...TAMANHO, fonts: await fontes() },
  );
}

/**
 * O erro por horizonte, do mês ao biênio.
 *
 * A leitura é a inclinação, não o valor: quanto mais longe o consenso tenta
 * enxergar, mais ele erra. Um número solto não diria isso, e é a curva inteira
 * que justifica a tela existir.
 *
 * O ingênuo entra atrás em cinza. Sem ele "erra 1,59" não significa nada —
 * pode ser muito ou pouco, e só a comparação com repetir o último valor separa
 * "acerta" de "acerta mais do que qualquer um acertaria sem pensar".
 */
function Trilha({
  itens,
}: {
  itens: { horizonteMeses: number; consenso: { mae: number }; ingenuo: { mae: number } }[];
}) {
  const ALTURA = 150;
  const teto = Math.max(...itens.map((x) => x.ingenuo.mae)) * 1.1;
  const largura = 100 / itens.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", position: "relative", height: ALTURA, width: "100%" }}>
        {itens.map((x, i) => {
          const hCons = (x.consenso.mae / teto) * ALTURA;
          const hIng = (x.ingenuo.mae / teto) * ALTURA;
          return (
            <div
              key={x.horizonteMeses}
              style={{
                position: "absolute",
                left: `${i * largura}%`,
                width: `${largura - 2}%`,
                top: 0,
                height: ALTURA,
                display: "flex",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", flexGrow: 1, height: hCons, background: COR.consenso, borderRadius: 2 }} />
              <div style={{ display: "flex", flexGrow: 1, height: hIng, background: COR.referencia, borderRadius: 2, opacity: 0.55 }} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", position: "relative", width: "100%", height: 26, paddingTop: 8 }}>
        {itens.map((x, i) => (
          <span
            key={x.horizonteMeses}
            style={{
              position: "absolute",
              left: `${i * largura}%`,
              width: `${largura - 2}%`,
              fontFamily: "Mono",
              fontSize: 17,
              color: COR.referencia,
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {x.horizonteMeses}m
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "flex", width: 12, height: 12, background: COR.consenso, borderRadius: 2 }} />
          <span style={{ fontFamily: "Mono", fontSize: 18, color: COR.inkSoft }}>consenso do Focus</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ display: "flex", width: 12, height: 12, background: COR.referencia, borderRadius: 2, opacity: 0.55 }} />
          <span style={{ fontFamily: "Mono", fontSize: 18, color: COR.inkSoft }}>repetir o último valor</span>
        </div>
      </div>
    </div>
  );
}
