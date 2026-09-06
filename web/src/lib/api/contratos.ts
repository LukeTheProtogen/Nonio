import { z } from "zod";

/**
 * O contrato entre o front e a API.
 *
 * Este arquivo é a fonte da verdade sobre a FORMA de cada resposta. Hoje quem
 * preenche é mock; amanhã é o `nonio-api`. O que não pode acontecer é o formato
 * ser descoberto na integração — por isso ele está escrito aqui antes de
 * existir servidor.
 *
 * Regras que valem para toda resposta:
 *
 *   1. Envelope fixo `{ dados, meta }`. Nunca devolver array cru: o dia em que
 *      precisar de paginação ou de um aviso, o formato quebra para todo mundo.
 *   2. `meta.mock` diz se aquilo veio de dado inventado. É o que permite a tela
 *      carimbar "dados de demonstração" sem adivinhar.
 *   3. Data sempre ISO 8601. Timestamp leva fuso obrigatório; data pura só é
 *      aceita onde o pipeline realmente publica data pura (ver `zMomento`).
 *      Data sem fuso tratada como timestamp já custou uma tarde de diferença
 *      de um dia entre servidor e navegador.
 *   4. Número nulo é `null`, nunca `0`. Zero é uma medição; ausência não é.
 *
 * Validar na borda é o que transforma "o gráfico sumiu" em "o campo `mediana`
 * veio como string". O erro aparece no lugar onde foi cometido.
 */

/**
 * Instante publicado pelo pipeline.
 *
 * Aceita timestamp completo e data pura porque o pipeline publica os dois: o
 * backtest roda uma vez por dia e carimba só a data; a previsão roda com hora.
 * Forçar um formato só obrigaria a inventar uma hora que não foi medida, e
 * `lib/formato` já sabe exibir os dois sem deslocar o dia.
 */
const zMomento = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/** Metadado que acompanha toda resposta. */
export const zMeta = z.object({
  /** Quando o dado foi produzido pelo pipeline, não quando foi servido. */
  geradoEm: zMomento,
  /** Quando esta resposta foi montada. Difere de `geradoEm` em dado de cache. */
  servidoEm: z.iso.datetime({ offset: true }),
  /** Nomes das fontes públicas por trás do número. Vai para a tela. */
  fontes: z.array(z.string()).min(1),
  /** true enquanto o pipeline não publicar. A tela avisa quando é true. */
  mock: z.boolean(),
  /** Enquadramento regulatório. Viaja com o dado, não só com a página. */
  aviso: z.string(),
});

export type Meta = z.infer<typeof zMeta>;

/** Envelope. Todo endpoint devolve isto. */
export function envelope<T extends z.ZodType>(dados: T) {
  return z.object({ dados, meta: zMeta });
}

// ---------------------------------------------------------------- GET /macro

const zDistribuicao = z.object({
  mediana: z.number(),
  media: z.number(),
  dp: z.number(),
  /**
   * Nulos são reais, não descuido: o Focus não publica mínimo e máximo em ~0,8%
   * das linhas, e só passou a publicar `n` em 02-01-2014. Exigir número aqui
   * quebraria o pipeline em dado histórico legítimo.
   */
  min: z.number().nullable(),
  max: z.number().nullable(),
  /** Quantas instituições responderam. Sem isto a nuvem não se reconstrói. */
  n: z.number().int().positive().nullable(),
  /**
   * Quantis do próprio consenso, calculados pelo pipeline.
   *
   * São do CONSENSO, não nossos — é a faixa onde as instituições se concentram,
   * e a distinção precisa aparecer em todo rótulo que os use. Enquanto não
   * existir modelo macro, é a única faixa honesta que a tela pode desenhar.
   */
  quantis: z
    .object({
      q05: z.number(),
      q25: z.number(),
      q75: z.number(),
      q95: z.number(),
    })
    .nullable(),
});

export const zIndicador = z.object({
  slug: z.string(),
  nome: z.string(),
  /**
   * Ano e família vêm explícitos, e não são extraídos do slug.
   *
   * A tela agrupa por ano e compara dentro da família. Ler isso de
   * `"pib-total-2026".split("-")` funcionaria hoje e quebraria no primeiro
   * indicador com número no nome. Contrato existe justamente para isso.
   */
  ano: z.number().int(),
  familia: z.string(),
  /** O evento sobre o qual a probabilidade é calculada, em português. */
  evento: z.string(),
  unidade: z.enum(["pct", "brl"]),
  /**
   * Null quando não há limiar defensável. Só o IPCA tem: o teto do regime de
   * metas vem de série oficial. Inventar limiar para Selic ou Câmbio produziria
   * probabilidade sem significado.
   */
  consenso: zDistribuicao.extend({ pEvento: z.number().min(0).max(1).nullable() }),
  /**
   * Null enquanto não houver modelo MACRO — o modelo que existe cobre ações.
   * Preencher isto com os quantis do consenso apresentaria a leitura do Focus
   * como previsão nossa, que é a mentira que este produto existe para evitar.
   */
  modelo: z
    .object({
      mediana: z.number(),
      /** Faixa de 80%. Extremo sem par não serve para desenhar nada. */
      q10: z.number(),
      q90: z.number(),
      pEvento: z.number().min(0).max(1),
    })
    .nullable(),
  /** Falso antes de 02-01-2014, quando o Focus passou a publicar respondentes. */
  nuvemReconstruivel: z.boolean(),
});

export const zMacro = envelope(
  z.object({
    indicadores: z.array(zIndicador),
    /** Data da coleta do Focus, não a data de hoje. */
    coletadoEm: zMomento,
    /** 0 ou 1. Travado em 0 no projeto. Vem na resposta para não se perder. */
    baseCalculo: z.union([z.literal(0), z.literal(1)]),
    citacoes: z.array(
      z.object({
        trecho: z.string(),
        ata: z.number().int(),
        paragrafo: z.number().int(),
        pagina: z.number().int(),
        url: z.url(),
      }),
    ),
  }),
);

export type Indicador = z.infer<typeof zIndicador>;
export type Macro = z.infer<typeof zMacro>["dados"];

// ---------------------------------------------------------------- GET /acoes

export const zAcao = z.object({
  ticker: z.string(),
  nome: z.string(),
  setor: z.string(),

  /** Cotação. `null` quando a fonte não respondeu, nunca 0. */
  preco: z.number().nullable(),
  variacaoDiaPct: z.number().nullable(),

  // Lente RETORNO — fato medido, 12 meses, com dividendos e JCP.
  retorno12m: z.number(),
  acimaDoCdi: z.number(),

  // Lente RISCO — o caminho que o retorno percorreu.
  vol12m: z.number(),
  piorQueda: z.number(),
  /** Dias até recuperar o pico anterior. 0 = ainda no fundo. */
  diasAteOPico: z.number().int(),
  beta: z.number(),

  // Lente CONTEXTO — regressão de fatores de 3 anos.
  sensJuros100bp: z.number(),
  sensDolar1pct: z.number(),
  sensBrent10pct: z.number(),
  fatos30d: z.number().int(),

  /*
   * A probabilidade é do NOSSO modelo, e por isso mora em objeto separado com
   * versão e data. Retorno e risco são fato medido; isto é opinião calculada.
   * Achatar os dois no mesmo nível apaga a diferença, e a diferença é o
   * produto inteiro.
   */
  probabilidade: z
    .object({
      pAlta: z.number().min(0).max(1),
      horizonteMeses: z.number().int().positive(),
      modeloVersao: z.string(),
      calculadoEm: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

export const zAcoes = envelope(
  z.object({
    acoes: z.array(zAcao),
    /** CDI acumulado em 12 meses, a régua da lente de retorno. */
    cdi12m: z.number(),
    /** true quando falta BRAPI_TOKEN e só os 4 tickers livres têm preço. */
    limitadoSemToken: z.boolean(),
  }),
);

export type Acao = z.infer<typeof zAcao>;
export type Acoes = z.infer<typeof zAcoes>["dados"];

// ------------------------------------------------------- GET /acoes/[ticker]

export const zAcaoDetalhe = envelope(
  z.object({
    acao: zAcao,
    /** Série de fechamento ajustado, do mais antigo ao mais recente. */
    serie: z.array(z.object({ data: z.iso.date(), fechamento: z.number() })),
    fatos: z.array(
      z.object({
        data: z.iso.date(),
        titulo: z.string(),
        categoria: z.string(),
        url: z.url(),
      }),
    ),
  }),
);

export type AcaoDetalhe = z.infer<typeof zAcaoDetalhe>["dados"];

// -------------------------------------------------------------- GET /copom

/**
 * Reunião do Copom no formato da FastAPI (`CopomMeetingOut`).
 *
 * Snake_case de propósito: o endpoint já existia assim, e traduzir na borda
 * esconderia o contrato real. O `servico` é quem reduz para o que o gráfico
 * precisa (`CopomReuniao`). FastAPI manda `date` como "YYYY-MM-DD"; datetime
 * com hora às vezes vaza, e cortar nos dez primeiros caracteres é o que
 * `lib/formato` já faz no resto.
 */
const zDataCopom = z
  .string()
  .nullish()
  .transform((v) => {
    if (!v) return null;
    const d = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  });

export const zCopomMeetingOut = z.object({
  nro_reuniao: z.number().int(),
  data_referencia: zDataCopom,
  data_publicacao: zDataCopom,
  titulo: z.string().nullish(),
  pdf_url: z.string().nullish(),
  has_features: z.boolean(),
  decisao: z.string().nullish(),
  selic_meta_aa: z.number().nullish(),
  delta_pp: z.number().nullish(),
  datas_reuniao: z.string().nullish(),
  tom_politica: z.string().nullish(),
  tom_inflacao: z.string().nullish(),
  tom_atividade: z.string().nullish(),
  resumo: z.string().nullish(),
});

export const zCopomPage = z.object({
  items: z.array(zCopomMeetingOut),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
});

/**
 * O que o gráfico do papel realmente desenha.
 *
 * `data` é o dia da reunião (`data_referencia`), com publicação só como
 * reserva: a ata sai dias depois, e marcar no dia da publicação deslocaria o
 * ponto para um pregão que não foi o da decisão.
 */
export type CopomReuniao = {
  nro: number;
  data: string;
  pdfUrl: string | null;
  decisao: string | null;
  selic: number | null;
  delta: number | null;
  tom: string | null;
  resumo: string | null;
};

// ------------------------------------------------------------ GET /historico

export const zHistorico = envelope(
  z.object({
    indicador: z.string(),
    baseCalculo: z.union([z.literal(0), z.literal(1)]),
    horizontes: z.array(
      z.object({
        horizonteMeses: z.number().int().positive(),
        n: z.number().int(),
        periodo: z.tuple([z.iso.date(), z.iso.date()]),
        consenso: z.object({ me: z.number(), mae: z.number(), rmse: z.number() }),
        ingenuo: z.object({ mae: z.number(), rmse: z.number() }),
        meta: z.object({ mae: z.number(), rmse: z.number() }),
        skillVsIngenuo: z.number(),
        skillVsMeta: z.number(),
        mincerZarnowitz: z.object({
          alfa: z.number(),
          beta: z.number(),
          epAlfa: z.number(),
          epBeta: z.number(),
          tBetaIgual1: z.number(),
          leitura: z.string(),
        }),
        confiabilidade: z.array(
          z.object({
            faixa: z.string(),
            dissemos: z.number(),
            aconteceu: z.number(),
            n: z.number().int(),
            ep: z.number(),
          }),
        ),
        brier: z.object({
          valor: z.number(),
          climatologia: z.number(),
          skill: z.number(),
          frequenciaBase: z.number(),
        }),
      }),
    ),
  }),
);

export type Historico = z.infer<typeof zHistorico>["dados"];

// --------------------------------------------------------------- GET /fontes

export const zFonte = z.object({
  slug: z.string(),
  nome: z.string(),
  orgao: z.string(),
  descricao: z.string(),
  url: z.url(),
  /** Com que frequência a origem publica, em português. */
  cadencia: z.string(),
  /** Última coleta bem-sucedida. `null` se nunca coletou. */
  coletadoEm: zMomento.nullable(),
  estado: z.enum(["ok", "atrasada", "falhou", "nao_coletada"]),
  /** Quantos registros a última coleta trouxe. `null` quando não se aplica. */
  registros: z.number().int().nullable(),
  /** Quando `estado` não é "ok", o que aconteceu, em português. */
  observacao: z.string().nullable(),
});

export const zFontes = envelope(z.object({ fontes: z.array(zFonte) }));

export type Fonte = z.infer<typeof zFonte>;
export type Fontes = z.infer<typeof zFontes>["dados"];

// ---------------------------------------------------------------- GET /conta

export const zConta = envelope(
  z.object({
    nome: z.string(),
    email: z.email(),
    /** Nulo enquanto não houver cobrança. Vem do backend, não do front. */
    plano: z.string().nullable(),
    /** E-mail confirmado. O backend expõe; o mock não sabe e manda null. */
    verificado: z.boolean().nullable(),
    /**
     * NULO quando não se sabe.
     *
     * O fastapi-users não guarda data de criação, e o mock inventava uma. Data
     * inventada na tela de conta é pior que campo ausente: a pessoa acredita
     * nela, e é sobre a própria conta dela.
     */
    criadaEm: z.iso.datetime({ offset: true }).nullable(),
    /**
     * Sessões abertas. VAZIO enquanto não houver de onde tirar.
     *
     * O mock listava "Chrome no Windows, Porto Alegre" para todo mundo. Isso
     * não é dado ilustrativo como um gráfico de exemplo: é alarme falso de
     * segurança. Alguém vê um acesso que não reconhece, acha que foi invadido,
     * e troca a senha correndo por causa de uma linha inventada.
     */
    sessoes: z.array(
      z.object({
        id: z.string(),
        dispositivo: z.string(),
        local: z.string(),
        ultimoAcesso: z.iso.datetime({ offset: true }),
        atual: z.boolean(),
      }),
    ),
  }),
);

export type Conta = z.infer<typeof zConta>["dados"];
