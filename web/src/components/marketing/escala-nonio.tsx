/**
 * O nônio, desenhado.
 *
 * Nônio é a escala auxiliar do paquímetro, inventada por Pedro Nunes no século
 * XVI. Ela não mede nada sozinha: encostada na régua principal, deixa ler a
 * fração que a régua sozinha não mostra. É literalmente a tese do produto, e
 * por isso esta figura vale mais que qualquer ilustração comprada.
 *
 * A régua principal é o consenso — cinza de referência, porque é a régua que
 * todo mundo já tem. A escala auxiliar e o traço que coincide são petróleo,
 * porque somos nós. Aqui a cor continua codificando significado.
 */
export function EscalaNonio({ className }: { className?: string }) {
  const x0 = 30;
  const passo = 52; // divisão da régua principal
  const divisoes = 10;
  const larguraNonio = passo * 0.9; // dez divisões do nônio cobrem nove da régua
  const inicioNonio = x0 + 3.7 * passo;
  const coincide = 7; // o traço que alinha: leitura de 3,7

  const yRegua = 92;
  const yNonio = 126;

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 620 210"
        className="block h-auto w-full"
        role="img"
        aria-label="Uma régua principal e, encostada nela, a escala auxiliar do paquímetro. O traço que coincide marca a leitura fina."
      >
        {/* régua principal: o consenso, a escala que todo mundo já tem */}
        <line x1={x0} y1={yRegua} x2={x0 + divisoes * passo} y2={yRegua} stroke="var(--referencia)" strokeWidth={1.5} />
        {Array.from({ length: divisoes + 1 }, (_, i) => {
          const x = x0 + i * passo;
          const cheio = i % 5 === 0;
          return (
            <g key={`r-${i}`}>
              <line
                x1={x}
                y1={yRegua}
                x2={x}
                y2={yRegua - (cheio ? 30 : 18)}
                stroke="var(--referencia)"
                strokeWidth={cheio ? 1.6 : 1}
              />
              {cheio && (
                <text
                  x={x}
                  y={yRegua - 38}
                  textAnchor="middle"
                  className="fill-ink-soft font-mono"
                  fontSize={12}
                >
                  {i}
                </text>
              )}
            </g>
          );
        })}

        {/*
          Escala auxiliar, agrupada para poder deslizar inteira.

          Só ela se move: a principal é a referência, e referência que anda não
          é referência. O `transform-box: fill-box` deixa o translate percentual
          valer sobre a caixa do próprio grupo em vez do SVG inteiro.
        */}
        <g className="desliza" style={{ transformBox: "fill-box" }}>
        <line
          x1={inicioNonio}
          y1={yNonio}
          x2={inicioNonio + divisoes * larguraNonio}
          y2={yNonio}
          stroke="var(--modelo)"
          strokeWidth={1.5}
        />
        {Array.from({ length: divisoes + 1 }, (_, j) => {
          const x = inicioNonio + j * larguraNonio;
          const alinha = j === coincide;
          return (
            <g key={`n-${j}`}>
              <line
                x1={x}
                y1={yNonio}
                x2={x}
                y2={yNonio + (alinha ? 30 : 17)}
                stroke="var(--modelo)"
                strokeWidth={alinha ? 2 : 1}
                strokeOpacity={alinha ? 1 : 0.55}
              />
              {j % 5 === 0 && (
                <text
                  x={x}
                  y={yNonio + 44}
                  textAnchor="middle"
                  className="fill-ink-soft font-mono"
                  fontSize={11}
                >
                  {j}
                </text>
              )}
            </g>
          );
        })}

        </g>

        {/* o traço que coincide: onde a leitura fina aparece */}
        <line
          x1={inicioNonio + coincide * larguraNonio}
          y1={yRegua - 34}
          x2={inicioNonio + coincide * larguraNonio}
          y2={yNonio + 30}
          stroke="var(--modelo)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <text
          x={inicioNonio + coincide * larguraNonio}
          y={yRegua - 44}
          textAnchor="middle"
          className="fill-modelo font-mono"
          fontSize={13}
        >
          3,7
        </text>

        <text x={x0} y={26} className="fill-ink-soft font-mono" fontSize={11} letterSpacing="0.07em">
          RÉGUA PRINCIPAL
        </text>
        <text
          x={inicioNonio}
          y={yNonio + 62}
          className="fill-modelo font-mono"
          fontSize={11}
          letterSpacing="0.07em"
        >
          NÔNIO
        </text>
      </svg>
    </figure>
  );
}
