"use client";

import { useMemo, useState } from "react";
import { moeda, dataLonga, pctSinal } from "@/lib/formato";

/**
 * Caminho do preço, com a pior queda marcada.
 *
 * SVG à mão, no mesmo idioma de `nuvem-consenso` e `curva-calibracao`. Não é
 * teimosia: uma biblioteca aqui traria outro tipo de eixo, outro tooltip e
 * outra régua de espessura, e a tela passaria a ter dois dialetos de gráfico.
 *
 * Cliente porque tem cursor. O resto da página continua servidor.
 *
 * A faixa sombreada é o trecho entre o topo e o fundo — o que a coluna "pior
 * queda" resume num número. Ver o número e ver onde ele aconteceu são leituras
 * diferentes, e a segunda é a que diz se dava para aguentar.
 */

type Ponto = { data: string; fechamento: number };

const L = 1000;
const A = 260;
const MARGEM = { topo: 16, base: 30, esq: 8, dir: 62 };

export function GraficoPreco({ serie }: { serie: Ponto[] }) {
  const [i, setI] = useState<number | null>(null);

  const g = useMemo(() => calcular(serie), [serie]);
  if (!g) return null;

  const foco = i === null ? null : serie[i];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Preço de fechamento nos últimos doze meses, de ${moeda(g.min)} a ${moeda(g.max)}`}
        onPointerMove={(e) => {
          const caixa = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - caixa.left) / caixa.width) * L;
          const frac = (x - MARGEM.esq) / (L - MARGEM.esq - MARGEM.dir);
          setI(Math.min(serie.length - 1, Math.max(0, Math.round(frac * (serie.length - 1)))));
        }}
        onPointerLeave={() => setI(null)}
      >
        {/* Grade: quatro linhas, rótulo à direita para não empurrar o desenho. */}
        {g.ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={MARGEM.esq}
              x2={L - MARGEM.dir}
              y1={t.y}
              y2={t.y}
              stroke="var(--rule-soft)"
              strokeWidth={1}
            />
            <text
              x={L - MARGEM.dir + 10}
              y={t.y + 4}
              fontSize={13}
              fill="var(--ink-soft)"
              fontFamily="var(--font-plex-mono)"
            >
              {moeda(t.v, 0)}
            </text>
          </g>
        ))}

        {/* O trecho da pior queda, do topo até o fundo. */}
        {g.queda && (
          <rect
            x={g.queda.x1}
            y={MARGEM.topo}
            width={Math.max(g.queda.x2 - g.queda.x1, 2)}
            height={A - MARGEM.topo - MARGEM.base}
            fill="var(--negativo)"
            opacity={0.06}
          />
        )}

        <path d={g.area} fill="var(--modelo)" opacity={0.07} />
        <path
          d={g.linha}
          fill="none"
          stroke="var(--modelo)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Fecho do período: o ponto que a tabela chama de retorno de 12 meses. */}
        <circle cx={g.fim.x} cy={g.fim.y} r={4} fill="var(--modelo)" />

        {foco && i !== null && (
          <g pointerEvents="none">
            <line
              x1={g.x(i)}
              x2={g.x(i)}
              y1={MARGEM.topo}
              y2={A - MARGEM.base}
              stroke="var(--ink-soft)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={g.x(i)}
              cy={g.y(foco.fechamento)}
              r={4.5}
              fill="var(--surface-2)"
              stroke="var(--modelo)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Extremos do eixo do tempo. Data no meio seria enfeite. */}
        <text x={MARGEM.esq} y={A - 8} fontSize={13} fill="var(--ink-soft)" fontFamily="var(--font-plex-mono)">
          {dataLonga(serie[0]!.data)}
        </text>
        <text
          x={L - MARGEM.dir}
          y={A - 8}
          fontSize={13}
          fill="var(--ink-soft)"
          fontFamily="var(--font-plex-mono)"
          textAnchor="end"
        >
          {dataLonga(serie[serie.length - 1]!.data)}
        </text>
      </svg>

      {/*
        A legenda tem altura fixa e mostra o fechamento quando não há cursor.
        Sem isso a página pula alguns pixels toda vez que o mouse entra e sai.
      */}
      <figcaption className="flex h-6 items-baseline gap-4 text-[13px] text-ink-soft">
        {foco ? (
          <>
            <span className="font-mono text-ink tabular">{moeda(foco.fechamento)}</span>
            <span className="font-mono tabular">{dataLonga(foco.data)}</span>
            <span className={`font-mono tabular ${g.corDesde(foco.fechamento)}`}>
              {pctSinal((foco.fechamento / serie[0]!.fechamento - 1) * 100)} no período
            </span>
          </>
        ) : (
          <span>Passe o cursor para ler qualquer pregão. A faixa é a pior queda.</span>
        )}
      </figcaption>
    </figure>
  );
}

function calcular(serie: Ponto[]) {
  if (serie.length < 2) return null;

  const valores = serie.map((p) => p.fechamento);
  const bruto = { min: Math.min(...valores), max: Math.max(...valores) };
  // Folga de 6% para a linha não encostar na borda do desenho.
  const folga = (bruto.max - bruto.min) * 0.06 || 1;
  const min = bruto.min - folga;
  const max = bruto.max + folga;

  const x = (i: number) =>
    MARGEM.esq + (i / (serie.length - 1)) * (L - MARGEM.esq - MARGEM.dir);
  const y = (v: number) =>
    MARGEM.topo + (1 - (v - min) / (max - min)) * (A - MARGEM.topo - MARGEM.base);

  const linha = serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.fechamento)}`).join(" ");
  const area = `${linha} L${x(serie.length - 1)} ${A - MARGEM.base} L${x(0)} ${A - MARGEM.base} Z`;

  // Onde a pior queda aconteceu: do topo que a causou até o fundo.
  let pico = valores[0]!;
  let iPico = 0;
  let pior = 0;
  let iTopo = 0;
  let iFundo = 0;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i]! > pico) {
      pico = valores[i]!;
      iPico = i;
    }
    const q = valores[i]! / pico - 1;
    if (q < pior) {
      pior = q;
      iTopo = iPico;
      iFundo = i;
    }
  }

  const passo = (max - min) / 4;
  const ticks = Array.from({ length: 5 }, (_, k) => {
    const v = min + k * passo;
    return { v, y: y(v) };
  });

  const partida = valores[0]!;

  return {
    x,
    y,
    linha,
    area,
    ticks,
    min: bruto.min,
    max: bruto.max,
    queda: pior < -0.02 ? { x1: x(iTopo), x2: x(iFundo) } : null,
    fim: { x: x(serie.length - 1), y: y(valores[valores.length - 1]!) },
    corDesde: (v: number) =>
      v > partida ? "text-positivo" : v < partida ? "text-negativo" : "text-ink-soft",
  };
}
