import { confiabilidadeUtil, type Horizonte } from "@/lib/backtest";

/**
 * Diagrama de confiabilidade: dissemos X%, aconteceu Y%.
 *
 * A diagonal tracejada é o ideal. Colado nela, a probabilidade é honesta.
 *
 * Sem linha ligando os pontos de propósito. Os dados reais não são monótonos —
 * a faixa de 60% a 80% tem frequência observada ZERO — e uma poligonal ali
 * desenha uma tendência que não existe, além de parecer erro de renderização.
 * O tamanho do ponto é a raiz da amostra: assim a faixa com 389 observações não
 * pesa igual à de 34, e ninguém lê ruído como achado.
 *
 * A curva é a do CONSENSO, com dado medido. A nossa ainda não existe, e a
 * legenda da tela precisa dizer isso.
 */
export function CurvaCalibracao({
  horizonte,
  lado = 300,
}: {
  horizonte: Horizonte;
  lado?: number;
}) {
  const faixas = confiabilidadeUtil(horizonte);
  const m = 44;
  const fim = lado - 20;
  const emX = (p: number) => m + (fim - m) * p;
  const emY = (p: number) => fim - (fim - m) * p;

  const nMaior = Math.max(...faixas.map((f) => f.n));
  const raio = (n: number) => 4 + 7 * Math.sqrt(n / nMaior);

  return (
    <svg
      viewBox={`0 0 ${lado} ${lado}`}
      className="block w-full h-auto"
      role="img"
      aria-label="Diagrama de confiabilidade do consenso: probabilidade implícita contra frequência observada."
    >
      <line x1={m} y1={fim} x2={fim} y2={m} stroke="var(--referencia)" strokeDasharray="4 6" />
      <line x1={m} y1={fim} x2={fim} y2={fim} stroke="var(--rule)" />
      <line x1={m} y1={m} x2={m} y2={fim} stroke="var(--rule)" />

      {faixas.map((f) => (
        <g key={f.faixa}>
          {/* barra de erro: a incerteza da própria medição, não some daqui */}
          <line
            x1={emX(f.dissemos)}
            y1={emY(Math.max(0, f.aconteceu - f.ep))}
            x2={emX(f.dissemos)}
            y2={emY(Math.min(1, f.aconteceu + f.ep))}
            stroke="var(--consenso)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
          />
          <circle
            cx={emX(f.dissemos)}
            cy={emY(f.aconteceu)}
            r={raio(f.n)}
            fill="var(--consenso)"
            fillOpacity={0.75}
          />
        </g>
      ))}

      <text x={fim} y={fim + 18} textAnchor="end" className="fill-ink-soft font-mono" fontSize={11}>
        o que o consenso implicava
      </text>
      <text
        x={m - 10}
        y={m + 2}
        textAnchor="end"
        className="fill-ink-soft font-mono"
        fontSize={11}
        transform={`rotate(-90 ${m - 10} ${m + 2})`}
      >
        o que aconteceu
      </text>
    </svg>
  );
}
