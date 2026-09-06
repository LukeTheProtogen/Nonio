import Image from "next/image";

/**
 * O produto, em imagem.
 *
 * Era o buraco da página: Binance, Bitget e IQ Option mostram a tela do produto
 * na primeira rolagem, e aqui a pessoa lia sobre quatro telas sem ver nenhuma.
 *
 * São capturas reais das rotas `/macro` e `/acoes`, não maquete desenhada. Se a
 * tela mudar e a imagem não, a página passa a mentir — por isso ficam em
 * `public/produto/` com nome de rota, para ser óbvio o que precisa ser
 * recapturado. O carimbo "dados de demonstração" aparece dentro da imagem, e
 * fica: é verdade sobre o que está sendo mostrado.
 *
 * A moldura é sóbria de propósito. Barra de navegador falsa, com botões
 * vermelho-amarelo-verde, é adereço que finge um contexto que não existe.
 */
type Peca = {
  src: string;
  alt: string;
  titulo: string;
  texto: string;
  largura: number;
  altura: number;
};

const PECAS: Peca[] = [
  {
    src: "/produto/painel-macro.jpg",
    alt: "Painel macro do Nônio: quatro indicadores com a distribuição do consenso e a probabilidade do modelo ao lado.",
    titulo: "O painel macro",
    texto:
      "Quatro indicadores, a distribuição inteira de cada um, e a probabilidade do evento que importa. A citação da ata do Copom explica por que divergimos.",
    largura: 1456,
    altura: 834,
  },
  {
    src: "/produto/janela-papel.jpg",
    alt: "Janela de um papel aberta sobre a tabela de ações, mostrando retorno, o caminho do preço e a pior queda.",
    titulo: "O papel, um assunto por vez",
    texto:
      "Clique numa ação e ela abre por cima, como um aplicativo. Preço, risco e contexto em passos separados, em vez de quinze colunas lado a lado.",
    largura: 1456,
    altura: 834,
  },
];

export function Vitrine() {
  return (
    <div className="flex flex-col gap-20">
      {PECAS.map((p, i) => (
        <article
          key={p.src}
          className="revela grid items-center gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]"
        >
          <div className={`flex flex-col gap-3 ${i % 2 ? "lg:order-2" : ""}`}>
            <h3 className="max-w-[18ch] font-heading text-[28px] font-semibold leading-snug tracking-[-0.014em]">
              {p.titulo}
            </h3>
            <p className="max-w-[42ch] text-[15.5px] leading-relaxed text-ink-soft">{p.texto}</p>
          </div>

          <figure
            className={`min-w-0 overflow-hidden rounded-xl border border-rule bg-carta p-1.5 shadow-[0_22px_60px_-28px_rgb(35_43_38/0.34)] ${
              i % 2 ? "lg:order-1" : ""
            }`}
          >
            <Image
              src={p.src}
              alt={p.alt}
              width={p.largura}
              height={p.altura}
              className="aproxima block h-auto w-full rounded-lg"
              /*
               * A primeira entra com prioridade porque aparece logo abaixo da
               * dobra; a segunda fica preguiçosa. Carregar as duas de imediato
               * atrasaria o herói, que é a única coisa que precisa ser rápida.
               */
              priority={i === 0}
              sizes="(min-width: 1024px) 56vw, 100vw"
            />
          </figure>
        </article>
      ))}
    </div>
  );
}
