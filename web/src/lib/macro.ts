import macroJson from "@/data/macro.json";

/**
 * Dado macro REAL. Substituto direto de `@/mock/macro`.
 *
 * Origem: Focus (BCB Olinda, série anual, base de cálculo 0, 2000→hoje) e série
 * 13521 do BCB para a meta de inflação. Publicado por `nonio.publicar`.
 *
 * Três diferenças em relação ao mock, todas deliberadas:
 *
 *  1. `modelo` é sempre null. Existe modelo de AÇÕES; não existe modelo MACRO.
 *     Publicar os quantis do consenso como previsão nossa seria mentir sobre a
 *     origem do número. A tela mostra a ausência.
 *  2. `evento` só existe para o IPCA, onde o regime de metas dá limiar oficial.
 *     Para Selic, Câmbio e PIB não há teto defensável, e probabilidade sobre
 *     limiar inventado não significa nada. Vem string vazia.
 *  3. `CITACOES` vem VAZIO. As do mock eram frases inventadas atribuídas a uma
 *     ata real, com número de parágrafo, página e link para o PDF do Banco
 *     Central. Na tela isso vira citação falsa de documento oficial — o oposto
 *     do que este produto promete. Voltam quando o acervo for processado.
 */

export type Modelo = {
  mediana: number;
  /** Faixa de 80%: onde há 80% de chance de o número cair. */
  q10: number;
  q90: number;
  pEvento: number;
};

export type Indicador = {
  slug: string;
  nome: string;
  indicador: string;
  ano: number;
  /** Rótulo do evento, ex.: "acima de 4,50%". Vazio quando não há limiar defensável. */
  evento: string;
  eventoOficial: boolean;
  eventoFonte: string;
  unidade: "pct" | "brl";
  consenso: {
    mediana: number;
    media: number;
    dp: number;
    min: number | null;
    max: number | null;
    n: number | null;
    /** Implícita na dispersão publicada pelo BCB. Null quando não há evento. */
    pEvento: number | null;
    quantis: Record<string, number> | null;
    /** > 1 = mercado mais dividido que a média das últimas 52 semanas. */
    desacordo: number | null;
  };
  /**
   * Hoje sempre null — não existe modelo macro. Tipado como objeto opcional, e
   * não como `null` literal, para que as guardas nas telas sejam significativas
   * e nada precise ser reescrito quando o modelo passar a existir.
   */
  modelo: Modelo | null;
  modeloAusente: string;
  nuvemReconstruivel: boolean;
};

export type Citacao = {
  trecho: string;
  ata: number;
  paragrafo: number;
  pagina: number;
  url: string;
};

type Bruto = {
  coletadoEm: string;
  baseCalculo: number;
  fonte: string;
  indicadores: Array<{
    slug: string; nome: string; indicador: string; ano: number; unidade: string;
    evento: { rotulo: string; metaOficial: boolean; fonte: string } | null;
    pEvento: number | null;
    consenso: {
      mediana: number; media: number; dp: number;
      min: number | null; max: number | null; n: number | null;
      quantis: Record<string, number> | null; desacordo: number | null;
    };
    modeloAusente: string;
    nuvemReconstruivel: boolean;
  }>;
};

const bruto = macroJson as unknown as Bruto;

export const FOCUS_COLETADO_EM = bruto.coletadoEm;
export const BASE_CALCULO = bruto.baseCalculo;
export const FONTE = bruto.fonte;

export const INDICADORES: Indicador[] = bruto.indicadores.map((i) => ({
  slug: i.slug,
  nome: i.nome,
  indicador: i.indicador,
  ano: i.ano,
  evento: i.evento?.rotulo ?? "",
  eventoOficial: i.evento?.metaOficial ?? false,
  eventoFonte: i.evento?.fonte ?? "",
  unidade: i.unidade === "brl" ? "brl" : "pct",
  consenso: { ...i.consenso, pEvento: i.pEvento },
  modelo: null,
  modeloAusente: i.modeloAusente,
  nuvemReconstruivel: i.nuvemReconstruivel,
}));

/** Vazio por integridade — ver o cabeçalho. */
export const CITACOES: Citacao[] = [];
export const CITACOES_MOTIVO =
  "As 280 atas do Copom ainda não foram processadas. Preferimos a lacuna a uma citação não verificada.";

export function indicadorPorSlug(slug: string): Indicador | undefined {
  return INDICADORES.find((i) => i.slug === slug);
}

/** Só os que rendem frase de probabilidade. */
export function comEvento(): Indicador[] {
  return INDICADORES.filter((i) => i.evento !== "" && i.consenso.pEvento !== null);
}

const Phi = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
};
const PhiInv = (p: number) => {
  let lo = -8, hi = 8;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
};

/**
 * Reconstrói a nuvem como normal truncada em [min, max].
 *
 * É RECONSTRUÇÃO: o Focus publica só os agregados, nunca as projeções
 * individuais. Os pontos representam a FORMA da discordância, não instituições
 * — e a tela precisa dizer isso. Semente derivada dos próprios valores, para a
 * mesma entrada gerar sempre a mesma figura.
 */
export function reconstruirNuvem(c: {
  mediana: number;
  dp: number;
  min: number | null;
  max: number | null;
  n: number | null;
}): number[] {
  const { mediana, dp, min, max, n } = c;
  if (!n || !dp || min === null || max === null) return [];
  let semente = Math.round((mediana + dp * 1000 + n) * 7919) >>> 0;
  const aleatorio = () => {
    semente = (semente * 1664525 + 1013904223) >>> 0;
    return semente / 0x100000000;
  };
  const a = Phi((min - mediana) / dp);
  const b = Phi((max - mediana) / dp);
  return Array.from({ length: n }, () => mediana + dp * PhiInv(a + aleatorio() * (b - a)));
}
