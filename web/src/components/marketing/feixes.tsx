const CAMINHOS = [
  "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
  "M-336 -237C-336 -237 -268 168 196 295C660 422 728 827 728 827",
  "M-292 -285C-292 -285 -224 120 240 247C704 374 772 779 772 779",
  "M-248 -333C-248 -333 -180 72 284 199C748 326 816 731 816 731",
  "M-204 -381C-204 -381 -136 24 328 151C792 278 860 683 860 683",
  "M-160 -429C-160 -429 -92 -24 372 103C836 230 904 635 904 635",
  "M-116 -477C-116 -477 -48 -72 416 55C880 182 948 587 948 587",
  "M-72 -525C-72 -525 -4 -120 460 7C924 134 992 539 992 539",
  "M-28 -573C-28 -573 40 -168 504 -41C968 86 1036 491 1036 491",
  "M16 -621C16 -621 84 -216 548 -89C1012 38 1080 443 1080 443",
  "M60 -669C60 -669 128 -264 592 -137C1056 -10 1124 395 1124 395",
  "M104 -717C104 -717 172 -312 636 -185C1100 -58 1168 347 1168 347",
];

/**
 * Feixes de fundo da dobra.
 *
 * Atmosfera, não informação. Vive só atrás da primeira dobra e dissolve antes
 * da seção do gráfico — a regra da paleta diz que petróleo marca o modelo e o
 * que é clicável, e uma linha da mesma cor perto de um gráfico criaria
 * ambiguidade de leitura. Aqui não há gráfico nenhum, a opacidade máxima é 14%,
 * e a máscara garante que nada disso alcança a nuvem do consenso.
 *
 * Feito em CSS puro de propósito: são doze curvas decorativas, e importar uma
 * biblioteca de animação para isso custaria mais que a tela inteira pesa hoje.
 * `pathLength="1"` normaliza cada curva, então o mesmo dasharray serve para
 * todas sem medir comprimento.
 */
export function Feixes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="-40 -220 1180 780"
        fill="none"
        /* "none" estica as curvas para preencher a dobra inteira. Em desenho
           abstrato a distorção não custa nada, e o recorte uniforme deixava a
           maior parte dos feixes fora da área visível. */
        preserveAspectRatio="none"
      >
        {/* leito estático: dá profundidade sem depender de animação */}
        <g opacity={0.07}>
          {CAMINHOS.map((d, i) => (
            <path key={`leito-${i}`} d={d} stroke="var(--modelo)" strokeWidth={0.7} />
          ))}
        </g>

        {CAMINHOS.map((d, i) => (
          <path
            key={`feixe-${i}`}
            d={d}
            pathLength={1}
            stroke={`url(#feixe-grad-${i % 3})`}
            strokeWidth={1.4}
            strokeLinecap="round"
            className="feixe"
            style={{
              animationDuration: `${9 + (i % 4) * 2.5}s`,
              animationDelay: `${i * 0.9}s`,
            }}
          />
        ))}

        <defs>
          {[0, 1, 2].map((v) => (
            <linearGradient key={v} id={`feixe-grad-${v}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--modelo)" stopOpacity={0} />
              <stop offset="35%" stopColor="var(--modelo)" stopOpacity={v === 1 ? 0.55 : 0.8} />
              <stop offset="70%" stopColor="var(--feixe-claro)" stopOpacity={v === 2 ? 0.5 : 0.75} />
              <stop offset="100%" stopColor="var(--feixe-claro)" stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
      </svg>
    </div>
  );
}
