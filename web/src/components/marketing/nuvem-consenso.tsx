import { caminhoNormal, dispersao, emX, tiques, type Escala } from "@/lib/curvas";
import { reconstruirNuvem } from "@/lib/macro";
import type { Indicador } from "@/lib/api/contratos";
import { num } from "@/lib/formato";

/**
 * O gráfico-assinatura: a discordância inteira, com o nosso ponto dentro dela.
 *
 * Consenso é área ocre, modelo é linha petróleo, faixa da meta é surface-2 e a
 * linha do teto é tracejada cinza. Nenhuma cor aqui é decoração.
 *
 * Com `animado`, a curva do CONSENSO se desenha, a área varre da esquerda para
 * a direita, a mediana cresce do eixo e os pontos surgem um a um. O
 * movimento não é enfeite: cada ponto é uma instituição respondendo, e vê-los
 * entrar diz o que "118 projeções" não diz sozinho. No painel `/macro` fica
 * desligado, porque lá o gráfico é ferramenta de consulta e quem volta cinco
 * vezes por dia não quer esperar animação nenhuma.
 */
export function NuvemConsenso({
  indicador,
  larguraViewBox = 1040,
  compacto = false,
  animado = false,
}: {
  indicador: Indicador;
  larguraViewBox?: number;
  /** Versão de cartão: sem eixo, sem nuvem, sem rótulos. Só as duas curvas. */
  compacto?: boolean;
  /** Só no herói da landing. Ver o comentário do topo. */
  animado?: boolean;
}) {
  const c = indicador.consenso;
  // Null enquanto não houver modelo macro. Todo traço do modelo fica atrás
  // desta guarda: a curva deixa de ser desenhada, em vez de ser inventada.
  const m = indicador.modelo;

  // O Focus não publica mínimo e máximo em toda linha; quando faltam, o
  // domínio vem da própria dispersão.
  const cMin = c.min ?? c.mediana - 3 * c.dp;
  const cMax = c.max ?? c.mediana + 3 * c.dp;

  // Domínio com folga de 2,5 desvios para as caudas não serem cortadas.
  const margem = Math.max(c.dp, m ? (m.q90 - m.q10) / 2 : 0) * 2.6;
  const escala: Escala = {
    x0: Math.min(cMin, m?.q10 ?? cMin) - margem,
    x1: Math.max(cMax, m?.q90 ?? cMax) + margem,
    px0: 40,
    px1: larguraViewBox - 40,
  };

  const base = compacto ? 78 : 290;
  const altura = compacto ? 62 : 235;
  const pico = 1 / (c.dp * Math.SQRT2 * Math.sqrt(Math.PI));

  // Centrada na MEDIANA, não na média: a mediana é a linha rotulada, e com a
  // média o pico caía ao lado dela, sugerindo um terceiro número que não existe.
  const cons = caminhoNormal(c.mediana, c.dp, escala, base, altura, { picoRef: pico });
  // Sem assimetria de propósito: com skew o pico visual sai do lugar da mediana,
  // e o leitor passa a ler o topo da curva como se fosse o nosso número.
  const mod = m
    ? caminhoNormal(m.mediana, (m.q90 - m.q10) / 2.56, escala, base, altura, { picoRef: pico })
    : null;

  // O limiar do evento, extraído do texto ("acima de 4,5%" → 4.5).
  const limiar = Number(indicador.evento.replace(/[^\d,.]/g, "").replace(",", ".")) || null;
  const pxLimiar = limiar === null ? null : emX(limiar, escala);

  const pontos =
    !compacto && indicador.nuvemReconstruivel
      ? dispersao(reconstruirNuvem(c), escala, 334, 360)
      : [];
  const passoTique = escala.x1 - escala.x0 > 8 ? 1 : 0.5;

  return (
    <svg
      viewBox={`0 0 ${larguraViewBox} ${compacto ? 90 : 392}`}
      preserveAspectRatio={compacto ? "none" : "xMidYMid meet"}
      className="block h-full w-full"
      role="img"
      aria-label={
        m
          ? `Distribuição das projeções para ${indicador.nome}. Consenso em ${num(c.mediana)}, nosso modelo em ${num(m.mediana)}.`
          : `Distribuição das projeções para ${indicador.nome}. Consenso em ${num(c.mediana)}. Ainda não há modelo próprio para macro.`
      }
    >
      {/* faixa até o limiar do evento */}
      {pxLimiar !== null && !compacto && (
        <>
          <rect x={40} y={30} width={pxLimiar - 40} height={260} fill="var(--surface-2)" />
          <line
            x1={pxLimiar}
            y1={24}
            x2={pxLimiar}
            y2={base}
            stroke="var(--referencia)"
            strokeDasharray="3 5"
            className={animado ? "cresce" : undefined}
            style={animado ? { ["--atraso" as string]: "1.15s" } : undefined}
          />
          <text
            x={pxLimiar}
            y={16}
            textAnchor="middle"
            className="fill-ink-soft font-mono"
            fontSize={12}
          >
            {indicador.evento.replace("acima de ", "").replace("abaixo de ", "")}
          </text>
        </>
      )}

      {/*
        Consenso: área preenchida mais o contorno.

        O contorno é novo. Sem modelo macro, a área chapada era a única forma no
        gráfico e não tinha borda para o olho seguir — parecia mancha, não
        distribuição. Com traço, ela vira curva outra vez.

        Os dois animam juntos: a área varre da esquerda para a direita e o
        contorno se desenha no mesmo sentido, então a distribuição se CONSTRÓI
        em vez de aparecer por transparência.
      */}
      <g className={animado ? "revela-area" : undefined}>
        <path d={cons.area} fill="var(--consenso)" fillOpacity={0.13} />
      </g>
      <path
        d={cons.linha}
        fill="none"
        stroke="var(--consenso)"
        strokeWidth={compacto ? 1.4 : 1.8}
        strokeOpacity={0.85}
        pathLength={animado ? 1 : undefined}
        className={animado ? "desenha" : undefined}
      />
      {/* modelo: linha — só existe quando existe modelo */}
      {mod && (
      <path
        d={mod.linha}
        fill="none"
        stroke="var(--modelo)"
        strokeWidth={2.6}
        /* pathLength=1 normaliza o traço: o dasharray da classe .desenha vale
           para qualquer curva, sem medir comprimento em JavaScript. */
        pathLength={animado ? 1 : undefined}
        className={animado ? "desenha" : undefined}
      />
      )}
      {/*
        Segunda passada da MESMA curva, só para o brilho percorrer. Duplicar o
        caminho é mais barato que animar um gradiente ao longo dele, e mantém a
        linha de baixo intacta caso a animação não rode.
      */}
      {animado && mod && (
        <path
          d={mod.linha}
          fill="none"
          stroke="var(--modelo)"
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          className="percorre"
          opacity={0}
        />
      )}

      {/* medianas */}
      <line
        x1={emX(c.mediana, escala)}
        y1={compacto ? 22 : 86}
        x2={emX(c.mediana, escala)}
        y2={base}
        stroke="var(--consenso)"
        strokeWidth={1.4}
        className={animado ? "cresce" : undefined}
        style={animado ? { ["--atraso" as string]: "1s" } : undefined}
      />

      {/*
        A faixa onde o consenso se concentra, no lugar que era da faixa de 80%
        do modelo.

        NÃO é a nossa previsão, e o rótulo diz isso: é o intervalo interquartil
        do próprio Focus — metade das instituições projeta dentro dele. Deixar o
        espaço vazio porque o modelo não existe desperdiçaria informação que já
        está publicada; preenchê-lo com algo nosso seria invenção. Isto é o
        consenso descrevendo a si mesmo.
      */}
      {!compacto && c.quantis && (
        <g className={animado ? "surge" : undefined} style={animado ? { ["--atraso" as string]: "1.3s" } : undefined}>
          {/* 90% das projeções: traço fino */}
          <line
            x1={emX(c.quantis.q05, escala)}
            y1={base + 3}
            x2={emX(c.quantis.q95, escala)}
            y2={base + 3}
            stroke="var(--consenso)"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />
          {/* metade central: traço grosso */}
          <line
            x1={emX(c.quantis.q25, escala)}
            y1={base + 3}
            x2={emX(c.quantis.q75, escala)}
            y2={base + 3}
            stroke="var(--consenso)"
            strokeWidth={4}
          />
        </g>
      )}
      {m && (
        <>
          <line
            x1={emX(m.mediana, escala)}
            y1={compacto ? 14 : 56}
            x2={emX(m.mediana, escala)}
            y2={base}
            stroke="var(--modelo)"
            strokeWidth={1.6}
          />
          {/* faixa de 80% do modelo */}
          <line
            x1={emX(m.q10, escala)}
            y1={base + 2}
            x2={emX(m.q90, escala)}
            y2={base + 2}
            stroke="var(--modelo)"
            strokeWidth={2.5}
          />
        </>
      )}

      <line x1={40} y1={base} x2={larguraViewBox - 40} y2={base} stroke="var(--rule)" />

      {pontos.map((p, i) => (
        <circle
          key={i}
          cx={p.cx}
          cy={p.cy}
          r={3}
          fill="var(--consenso)"
          fillOpacity={0.5}
          className={animado ? "surge" : undefined}
          /* Escalonado pelo índice, com teto: 118 pontos a 12ms levariam
             1,4s só para terminar de aparecer, e ninguém espera isso. */
          style={animado ? { ["--atraso" as string]: `${Math.min(i * 9, 900)}ms` } : undefined}
        />
      ))}

      {!compacto &&
        tiques(escala, passoTique).map((t) => (
          <g key={t.valor}>
            <line x1={t.px} y1={base} x2={t.px} y2={base + 6} stroke="var(--rule)" />
            <text
              x={t.px}
              y={base + 24}
              textAnchor="middle"
              className="fill-ink-soft font-mono"
              fontSize={12}
            >
              {num(t.valor, passoTique < 1 ? 1 : 0)}
              {indicador.unidade === "pct" ? "%" : ""}
            </text>
          </g>
        ))}
    </svg>
  );
}
