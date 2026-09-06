"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CopomReuniao } from "@/lib/api/contratos";
import { moeda, dataLonga, pctSinal, num, pp } from "@/lib/formato";

/**
 * Caminho do preço, com a pior queda marcada — e, nos recortes longos, o
 * Copom por cima.
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
 *
 * Copom só entra quando quem chama passa reuniões. Em doze meses as oito
 * atas viram ruído; em três ou cinco anos a linha da Selic é o ciclo que o
 * preço atravessou. Eixo da Selic à esquerda, preço à direita — unidades
 * diferentes não compartilham régua.
 */

type Ponto = { data: string; fechamento: number };

const MARGEM = { topo: 16, base: 30, esq: 8, dir: 62 };
const MARGEM_COPOM_ESQ = 62;

/**
 * O viewBox acompanha a largura real, e isso não é detalhe.
 *
 * Com viewBox fixo em 1000, o SVG escala junto com a caixa: num celular de
 * 390px o desenho inteiro sai por 0,34 do tamanho, e `fontSize={13}` vira
 * quatro pixels e meio na tela. O eixo continua lá, ilegível, o que é pior do
 * que não estar.
 *
 * Medindo a caixa, uma unidade do viewBox volta a valer um pixel: o texto é
 * desenhado no tamanho em que vai ser lido, em qualquer largura. A altura
 * baixa junto no celular porque 260 de altura sobre 340 de largura é quase um
 * quadrado, e série de preço se lê deitada.
 */
const LARGURA_PADRAO = 1000;
const ESTREITO = 620;

export function GraficoPreco({
  serie,
  marcarQueda = false,
  copom = [],
}: {
  serie: Ponto[];
  /**
   * Sombreia o trecho entre o topo e o fundo.
   *
   * Desligado no passo do preço e ligado no do risco, de propósito: é a MESMA
   * figura com uma coisa a mais. Ver o caminho primeiro e a pior queda depois
   * ensina; mostrar as duas de uma vez só dá duas coisas para olhar ao mesmo
   * tempo, e repetir o gráfico inteiro em dois passos seria repetição.
   */
  marcarQueda?: boolean;
  /** Vazio = gráfico de preço puro. Quem decide o recorte é a janela. */
  copom?: CopomReuniao[];
}) {
  const [i, setI] = useState<number | null>(null);
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const caixa = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;

    /*
      A primeira medida vem do `getBoundingClientRect`, NÃO do observador.

      O ResizeObserver promete uma chamada inicial, mas ela chega no ciclo de
      pintura seguinte — e em aba em segundo plano esse ciclo pode não vir. O
      gráfico então ficava com o viewBox de desktop no celular, que é
      exatamente o defeito que este código existe para corrigir. Medir na hora
      resolve o primeiro quadro; o observador cuida do resto.
    */
    const medir = (w: number) => {
      if (w > 0) setLargura(w);
    };
    medir(el.getBoundingClientRect().width);

    const observador = new ResizeObserver(([entrada]) => {
      medir(entrada?.contentRect.width ?? 0);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const L = Math.max(largura, 240);
  // Deitado no celular, mais alto no desktop, onde há largura de sobra.
  const A = L < ESTREITO ? 190 : 260;

  const g = useMemo(() => calcular(serie, copom, L, A), [serie, copom, L, A]);
  if (!g) return null;

  const foco = i === null ? null : serie[i];
  const reuniao = foco ? copomPerto(g.copomNaJanela, foco.data) : null;
  const comCopom = g.copomNaJanela.length > 0;

  return (
    <figure
      ref={caixa}
      className="flex min-w-0 flex-col gap-2"
      onPointerLeave={() => setI(null)}
    >
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full touch-none"
        role="img"
        aria-label={
          comCopom
            ? `Preço de fechamento e decisões do Copom, de ${moeda(g.min)} a ${moeda(g.max)}`
            : `Preço de fechamento nos últimos doze meses, de ${moeda(g.min)} a ${moeda(g.max)}`
        }
        onPointerMove={(e) => {
          const caixaSvg = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - caixaSvg.left) / caixaSvg.width) * L;
          const frac = (x - g.margem.esq) / (L - g.margem.esq - g.margem.dir);
          setI(Math.min(serie.length - 1, Math.max(0, Math.round(frac * (serie.length - 1)))));
        }}
      >
        {/* Grade: quatro linhas, rótulo à direita para não empurrar o desenho. */}
        {g.ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={g.margem.esq}
              x2={L - g.margem.dir}
              y1={t.y}
              y2={t.y}
              stroke="var(--rule-soft)"
              strokeWidth={1}
            />
            <text
              x={L - g.margem.dir + 10}
              y={t.y + 4}
              fontSize={13}
              fill="var(--ink-soft)"
              fontFamily="var(--font-plex-mono)"
            >
              {moeda(t.v, 0)}
            </text>
          </g>
        ))}

        {g.ticksSelic.map((t) => (
          <text
            key={`s-${t.v}`}
            x={g.margem.esq - 8}
            y={t.y + 4}
            fontSize={13}
            fill="var(--atencao)"
            fontFamily="var(--font-plex-mono)"
            textAnchor="end"
          >
            {num(t.v, 2)}%
          </text>
        ))}

        {/* O trecho da pior queda, do topo até o fundo. */}
        {marcarQueda && g.queda && (
          <rect
            x={g.queda.x1}
            y={g.margem.topo}
            width={Math.max(g.queda.x2 - g.queda.x1, 2)}
            height={A - g.margem.topo - g.margem.base}
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

        {g.selic && (
          <path
            d={g.selic.linha}
            fill="none"
            stroke="var(--atencao)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {g.marcadores.map((m) => (
          <g key={m.nro}>
            <line
              x1={m.x}
              x2={m.x}
              y1={g.margem.topo}
              y2={A - g.margem.base}
              stroke={m.cor}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.35}
            />
            <circle
              cx={m.x}
              cy={m.y}
              r={reuniao?.nro === m.nro ? 5 : 3.5}
              fill="var(--surface-2)"
              stroke={m.cor}
              strokeWidth={1.7}
            />
          </g>
        ))}

        {/* Fecho do período: o ponto que a tabela chama de retorno de 12 meses. */}
        <circle cx={g.fim.x} cy={g.fim.y} r={4} fill="var(--modelo)" />

        {foco && i !== null && (
          <g pointerEvents="none">
            <line
              x1={g.x(i)}
              x2={g.x(i)}
              y1={g.margem.topo}
              y2={A - g.margem.base}
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
        <text
          x={g.margem.esq}
          y={A - 8}
          fontSize={13}
          fill="var(--ink-soft)"
          fontFamily="var(--font-plex-mono)"
        >
          {dataLonga(serie[0]!.data)}
        </text>
        <text
          x={L - g.margem.dir}
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
        A legenda tem altura MÍNIMA e mostra o fechamento quando não há cursor.
        Sem a altura reservada a página pulava alguns pixels toda vez que o
        mouse entrava e saía; com altura fixa, no celular a frase quebrava em
        duas linhas e a segunda ficava cortada. Mínima resolve os dois.

        "Percorra", e não "passe o cursor": no celular não há cursor nenhum, e
        o gesto é arrastar o dedo. Uma frase que serve aos dois é melhor que
        duas frases atrás de uma media query.

        O leave fica na figure, não no SVG: senão o link da ata some no instante
        em que o dedo sai do desenho para clicar.
      */}
      <figcaption className="flex min-h-6 flex-col justify-center gap-0.5 text-[13px] text-ink-soft">
        {foco ? (
          <>
            <span className="flex min-h-5 flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-ink tabular">{moeda(foco.fechamento)}</span>
              <span className="font-mono tabular">{dataLonga(foco.data)}</span>
              <span className={`font-mono tabular ${g.corDesde(foco.fechamento)}`}>
                {pctSinal((foco.fechamento / serie[0]!.fechamento - 1) * 100)} no período
              </span>
            </span>
            {comCopom && (
              <span className="flex min-h-5 flex-wrap items-baseline gap-x-3 gap-y-1">
                {reuniao ? (
                  <>
                    <span className="font-mono text-ink tabular">{rotuloCopom(reuniao)}</span>
                    {reuniao.pdfUrl && (
                      <a
                        href={reuniao.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-modelo"
                      >
                        ata
                      </a>
                    )}
                  </>
                ) : (
                  <span aria-hidden>&nbsp;</span>
                )}
              </span>
            )}
          </>
        ) : (
          <span>
            {comCopom
              ? "Linha do preço e degrau da Selic. Percorra o gráfico para ler o pregão e a reunião."
              : marcarQueda
                ? "A faixa sombreada é a pior queda. Percorra o gráfico para ler qualquer pregão."
                : "Percorra o gráfico para ler qualquer pregão."}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function calcular(serie: Ponto[], copom: CopomReuniao[], L: number, A: number) {
  if (serie.length < 2) return null;

  const inicio = serie[0]!.data;
  const fim = serie[serie.length - 1]!.data;
  const previa = [...copom].reverse().find((r) => r.data < inicio) ?? null;
  const naJanela = copom.filter((r) => r.data >= inicio && r.data <= fim);
  const comCopom = naJanela.length > 0;

  const margem = {
    ...MARGEM,
    esq: comCopom ? MARGEM_COPOM_ESQ : MARGEM.esq,
  };

  const valores = serie.map((p) => p.fechamento);
  const bruto = { min: Math.min(...valores), max: Math.max(...valores) };
  // Folga de 6% para a linha não encostar na borda do desenho.
  const folga = (bruto.max - bruto.min) * 0.06 || 1;
  const min = bruto.min - folga;
  const max = bruto.max + folga;

  const x = (i: number) =>
    margem.esq + (i / (serie.length - 1)) * (L - margem.esq - margem.dir);
  const y = (v: number) =>
    margem.topo + (1 - (v - min) / (max - min)) * (A - margem.topo - margem.base);

  const linha = serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.fechamento)}`).join(" ");
  const area = `${linha} L${x(serie.length - 1)} ${A - margem.base} L${x(0)} ${A - margem.base} Z`;

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

  const selics = [previa, ...naJanela]
    .map((r) => r?.selic)
    .filter((v): v is number => v != null);
  let ticksSelic: { v: number; y: number }[] = [];
  let selic: { linha: string } | null = null;
  let ySelic = (_v: number) => margem.topo;

  if (selics.length >= 2 || (selics.length === 1 && naJanela.length > 0)) {
    const sBruto = { min: Math.min(...selics), max: Math.max(...selics) };
    const sFolga = (sBruto.max - sBruto.min) * 0.12 || 0.25;
    const sMin = sBruto.min - sFolga;
    const sMax = sBruto.max + sFolga;
    ySelic = (v: number) =>
      margem.topo + (1 - (v - sMin) / (sMax - sMin)) * (A - margem.topo - margem.base);
    const sPasso = (sMax - sMin) / 4;
    ticksSelic = Array.from({ length: 5 }, (_, k) => {
      const v = sMin + k * sPasso;
      return { v, y: ySelic(v) };
    });

    const degraus: { x: number; selic: number }[] = [];
    if (previa?.selic != null) degraus.push({ x: x(0), selic: previa.selic });
    for (const r of naJanela) {
      if (r.selic == null) continue;
      degraus.push({ x: x(indiceMaisProximo(serie, r.data)), selic: r.selic });
    }
    if (degraus.length > 0) {
      const ultimo = degraus[degraus.length - 1]!;
      if (ultimo.x < x(serie.length - 1)) {
        degraus.push({ x: x(serie.length - 1), selic: ultimo.selic });
      }
      const d = [`M${degraus[0]!.x} ${ySelic(degraus[0]!.selic)}`];
      for (let k = 1; k < degraus.length; k++) {
        const a = degraus[k - 1]!;
        const b = degraus[k]!;
        d.push(`L${b.x} ${ySelic(a.selic)}`);
        d.push(`L${b.x} ${ySelic(b.selic)}`);
      }
      selic = { linha: d.join(" ") };
    }
  }

  const marcadores = naJanela.map((r) => {
    const xi = x(indiceMaisProximo(serie, r.data));
    const yi = r.selic != null && selic ? ySelic(r.selic) : margem.topo + 6;
    return { nro: r.nro, x: xi, y: yi, cor: corDecisao(r.decisao) };
  });

  return {
    x,
    y,
    linha,
    area,
    ticks,
    ticksSelic,
    margem,
    min: bruto.min,
    max: bruto.max,
    queda: pior < -0.02 ? { x1: x(iTopo), x2: x(iFundo) } : null,
    fim: { x: x(serie.length - 1), y: y(valores[valores.length - 1]!) },
    corDesde: (v: number) =>
      v > partida ? "text-positivo" : v < partida ? "text-negativo" : "text-ink-soft",
    copomNaJanela: naJanela,
    selic,
    marcadores,
  };
}

function ts(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(a!, m! - 1, d!);
}

function indiceMaisProximo(serie: Ponto[], iso: string): number {
  const alvo = ts(iso);
  let lo = 0;
  let hi = serie.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts(serie[mid]!.data) < alvo) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const da = Math.abs(ts(serie[lo]!.data) - alvo);
    const db = Math.abs(ts(serie[lo - 1]!.data) - alvo);
    if (db < da) return lo - 1;
  }
  return lo;
}

/** Dez dias: o Copom não cai num pregão, e oito reuniões por ano não se tocam. */
function copomPerto(reunioes: CopomReuniao[], data: string): CopomReuniao | null {
  const alvo = ts(data);
  const teto = 10 * 86_400_000;
  let melhor: CopomReuniao | null = null;
  let dist = teto;
  for (const r of reunioes) {
    const d = Math.abs(ts(r.data) - alvo);
    if (d <= dist) {
      dist = d;
      melhor = r;
    }
  }
  return melhor;
}

function corDecisao(decisao: string | null): string {
  if (decisao === "reduzir") return "var(--positivo)";
  if (decisao === "elevar") return "var(--negativo)";
  return "var(--atencao)";
}

function rotuloCopom(r: CopomReuniao): string {
  const taxa = r.selic != null ? num(r.selic) : null;
  const dpp = r.delta != null && r.delta !== 0 ? ` (${pp(r.delta)})` : "";
  let ato = "reunião";
  if (r.decisao === "reduzir" && taxa) ato = `reduziu a Selic para ${taxa}%${dpp}`;
  else if (r.decisao === "elevar" && taxa) ato = `elevou a Selic para ${taxa}%${dpp}`;
  else if (r.decisao === "manter" && taxa) ato = `manteve a Selic em ${taxa}%`;
  else if (taxa) ato = `Selic em ${taxa}%`;
  const tom = r.tom && r.tom !== "indefinido" ? ` · ${r.tom}` : "";
  return `Copom ${r.nro} · ${ato}${tom}`;
}
