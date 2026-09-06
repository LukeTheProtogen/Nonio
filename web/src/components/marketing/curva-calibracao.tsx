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
 *
 * Com `animado`, a diagonal se desenha e os pontos entram um a um, da esquerda
 * para a direita — na ordem das faixas de probabilidade. A ordem importa: é a
 * mesma em que se lê o gráfico, e ver o ponto de 60% a 80% cair no chão DEPOIS
 * dos outros é o que faz o achado aparecer, em vez de estar lá desde sempre.
 * No painel `/historico` fica desligado: lá é ferramenta de consulta.
 */
export function CurvaCalibracao({
  horizonte,
  lado = 300,
  animado = false,
}: {
  horizonte: Horizonte;
  lado?: number;
  /** Só na landing. Ver o comentário do topo. */
  animado?: boolean;
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
      {/*
        A diagonal fica SEMPRE tracejada e SEMPRE parada.
        
        Cheguei a animá-la, e foi erro: a técnica de desenhar um traço usa o
        próprio `stroke-dasharray`, então a linha terminava sólida. E sólida ela
        mente — tracejado é o que distingue o ideal teórico dos pontos medidos.
        Estilo que carrega significado não pode ser gasto como mecanismo de
        animação. Quem anima aqui são os pontos, que são o dado.
      */}
      <line
        x1={m}
        y1={fim}
        x2={fim}
        y2={m}
        stroke="var(--referencia)"
        strokeDasharray="4 6"
      />
      {/*
        O marcador que percorre a diagonal. Só existe na landing (`animado`),
        e é a única coisa que se mexe aqui: os pontos são medição, e ponto de
        dado pulsando sugere valor mudando.
      */}
      {animado && (
        <g
          className="sobe-diagonal"
          style={{ ["--dx" as string]: `${fim - m}px` }}
          aria-hidden
        >
          <circle cx={m} cy={fim} r={9} fill="var(--referencia)" fillOpacity={0.18} />
          <circle cx={m} cy={fim} r={3.5} fill="var(--referencia)" />
        </g>
      )}

      <line x1={m} y1={fim} x2={fim} y2={fim} stroke="var(--rule)" />
      <line x1={m} y1={m} x2={m} y2={fim} stroke="var(--rule)" />

      {faixas.map((f, i) => (
        <g
          key={f.faixa}
          className={animado ? "surge-rolagem" : undefined}
          /* Cada ponto começa um pouco depois do anterior, medido em avanço da
             rolagem e não em milissegundos. Subir desfaz na ordem inversa. */
          style={animado ? { ["--inicio" as string]: `${16 + i * 7}%` } : undefined}
        >
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
