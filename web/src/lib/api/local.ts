import { buscarCotacoes, temToken } from "@/lib/brapi";
import { cotacoesCongeladas, snapshot } from "@/lib/demo";
import { emDemo } from "@/lib/demo-acoes";
import { previsaoDe, todasPrevisoes, geradoEm as previsoesGeradasEm } from "@/lib/previsoes";
import * as backtest from "@/lib/backtest";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";
import { INDICADORES, FOCUS_COLETADO_EM, BASE_CALCULO } from "@/lib/macro";
import { ACOES, CDI_12M } from "@/mock/acoes";
import { serieDe, fatosDe, metricasDaSerie } from "@/mock/serie";
import type { Meta } from "./contratos";

/**
 * Montagem local das respostas, no formato exato do contrato.
 *
 * Aqui é onde real e mock se misturam, e cada função diz qual é qual. O
 * `meta.mock` que sai daqui não é decoração: é ele que faz a tela carimbar
 * "dados de demonstração", então marcar errado é mentir na interface.
 *
 * Quando `nonio-api` subir, este arquivo some inteiro e nada mais muda —
 * é essa a razão de ele ser a única coisa que conhece os mocks.
 *
 * Modo demonstração entra AQUI, e não em cada tela: é o único ponto por onde
 * cotação passa. Em demo nenhuma chamada externa acontece, nem para falhar, e
 * `meta.fontes` diz "snapshot congelado" — dado congelado apresentado como ao
 * vivo é a desonestidade que este produto existe para não cometer.
 *
 * O modo é lido por requisição (ambiente OU cookie), então as funções que
 * dependem dele são assíncronas. Ler uma vez e guardar em módulo faria a chave
 * da barra lateral parar de funcionar depois do primeiro carregamento.
 */

function meta(p: {
  geradoEm: string;
  fontes: string[];
  mock: boolean;
}): Meta {
  return {
    geradoEm: p.geradoEm,
    servidoEm: new Date().toISOString(),
    fontes: p.fontes,
    mock: p.mock,
    aviso: DISCLAIMER_MEDIO,
  };
}

// ------------------------------------------------------------------- macro

/**
 * REAL. Vem de `data/macro.json`, publicado por `nonio.publicar` a partir do
 * Focus anual (base 0, 2000→hoje) e da série 13521 do BCB para a meta.
 *
 * Duas ausências deliberadas viajam no dado, em vez de serem preenchidas:
 * `modelo` é null porque não existe modelo macro, e `citacoes` vem vazio porque
 * as 280 atas do Copom ainda não foram processadas. A tela mostra a lacuna.
 */
export function macro() {
  return {
    dados: {
      indicadores: INDICADORES.map((i) => ({
        slug: i.slug,
        nome: i.nome,
        ano: i.ano,
        familia: i.indicador,
        evento: i.evento,
        unidade: i.unidade,
        consenso: {
          mediana: i.consenso.mediana,
          media: i.consenso.media,
          dp: i.consenso.dp,
          min: i.consenso.min,
          max: i.consenso.max,
          n: i.consenso.n,
          pEvento: i.consenso.pEvento,
        },
        modelo: i.modelo,
        nuvemReconstruivel: i.nuvemReconstruivel,
      })),
      coletadoEm: FOCUS_COLETADO_EM,
      baseCalculo: BASE_CALCULO as 0 | 1,
      // Vazio até o acervo ser processado. Citação não verificada atribuída a
      // documento oficial é pior que lacuna.
      citacoes: [],
    },
    meta: meta({
      geradoEm: FOCUS_COLETADO_EM,
      fontes: ["Banco Central — Boletim Focus (série anual, base 0)"],
      // Deixou de ser mock: este bloco é dado publicado pelo pipeline.
      mock: false,
    }),
  };
}

// ------------------------------------------------------------------- ações

/** Cotação: congelada em demo, ao vivo fora dela. Falha vira lista vazia. */
async function cotacoes(tickers: string[], demo: boolean) {
  if (demo) return cotacoesCongeladas(tickers);
  return buscarCotacoes(tickers).catch(() => []);
}

/** O nome da origem da cotação vai para a tela, e muda em demo. */
function fonteCotacao(demo: boolean): string {
  return demo
    ? `snapshot congelado em ${snapshot.capturadoEm.slice(0, 10)}`
    : "B3, via brapi.dev";
}

/**
 * Meio real, meio mock.
 *
 * Real: cotação (brapi) e probabilidade (previsoes.json, do pipeline).
 * Mock: retorno, risco e contexto, que ninguém publica ainda.
 *
 * Por isso `mock: true` mesmo tendo dado real dentro. Marcar como real porque
 * uma parte é real seria o pior dos dois mundos: a tela pararia de avisar
 * justamente sobre as colunas inventadas.
 */
export async function acoes() {
  const demo = await emDemo();
  const lista = await cotacoes(ACOES.map((a) => a.ticker), demo);
  const porTicker = new Map(lista.map((c) => [c.ticker, c]));

  return {
    dados: {
      acoes: ACOES.map((a) => montarAcao(a, porTicker.get(a.ticker))),
      cdi12m: CDI_12M,
      // Em demo o snapshot cobre todo mundo, então não há limitação a avisar.
      limitadoSemToken: demo ? false : !temToken(),
    },
    meta: meta({
      geradoEm: previsoesGeradasEm,
      fontes: [fonteCotacao(demo), "pipeline nonio.probabilidade"],
      mock: true,
    }),
  };
}


export async function acao(ticker: string) {
  const base = ACOES.find((a) => a.ticker === ticker);
  if (!base) return null;

  const demo = await emDemo();
  const [cotacao] = await cotacoes([ticker], demo);

  return {
    dados: {
      acao: montarAcao(base, cotacao),
      serie: serieDe(ticker),
      fatos: fatosDe(ticker),
    },
    meta: meta({
      geradoEm: previsoesGeradasEm,
      fontes: [fonteCotacao(demo), "CVM — pacote IPE", "pipeline nonio.probabilidade"],
      mock: true,
    }),
  };
}

function montarAcao(
  a: (typeof ACOES)[number],
  c?: { preco: number | null; variacaoPct: number | null },
) {
  const p = previsaoDe(a.ticker);

  return {
    ticker: a.ticker,
    nome: a.nome,
    setor: a.setor,
    preco: c?.preco ?? null,
    variacaoDiaPct: c?.variacaoPct ?? null,

    retorno12m: a.retorno12m,
    acimaDoCdi: a.acimaDoCdi,
    vol12m: a.vol12m,
    // Medidos na série desenhada, não em campo separado: tabela e gráfico
    // discordando sobre a mesma queda é defeito visível.
    ...metricasDaSerie(a.ticker),
    beta: a.beta,
    sensJuros100bp: a.sensJuros100bp,
    sensDolar1pct: a.sensDolar1pct,
    sensBrent10pct: a.sensBrent10pct,
    fatos30d: a.fatos30d,

    // Dado real do pipeline. Papel sem previsão publicada fica com null, e a
    // tabela mostra um traço em vez de fabricar um número plausível.
    probabilidade: p
      ? {
          pAlta: p.probabilidade,
          horizonteMeses: p.horizonte_meses,
          modeloVersao: p.modelo_versao,
          calculadoEm: p.calculado_em,
        }
      : null,
  };
}

// --------------------------------------------------------------- histórico

/** REAL, inteiro. Vem de `src/data/backtest.json`, publicado pelo pipeline. */
export function historico() {
  return {
    dados: {
      indicador: backtest.indicador,
      baseCalculo: backtest.baseCalculo as 0 | 1,
      horizontes: backtest.horizontesExibidos().map((h) => ({
        horizonteMeses: h.horizonte_meses,
        n: h.n,
        periodo: h.periodo,
        consenso: h.consenso,
        ingenuo: h.ingenuo,
        meta: h.meta,
        skillVsIngenuo: h.skill_consenso_vs_ingenuo,
        skillVsMeta: h.skill_consenso_vs_meta,
        mincerZarnowitz: {
          alfa: h.mincer_zarnowitz.alfa,
          beta: h.mincer_zarnowitz.beta,
          epAlfa: h.mincer_zarnowitz.ep_alfa,
          epBeta: h.mincer_zarnowitz.ep_beta,
          tBetaIgual1: h.mincer_zarnowitz.t_beta_igual_1,
          leitura: h.mincer_zarnowitz.leitura,
        },
        confiabilidade: h.evento_acima_teto.confiabilidade,
        brier: {
          valor: h.evento_acima_teto.brier,
          climatologia: h.evento_acima_teto.brier_climatologia,
          skill: h.evento_acima_teto.brier_skill,
          frequenciaBase: h.evento_acima_teto.frequencia_base,
        },
      })),
    },
    meta: meta({
      geradoEm: backtest.geradoEm,
      fontes: ["Banco Central — Boletim Focus", "IBGE — IPCA"],
      mock: false,
    }),
  };
}

// ------------------------------------------------------------------ fontes

/**
 * Estado da ingestão.
 *
 * As duas primeiras linhas são verdade medida: a data sai do carimbo do
 * próprio arquivo que o pipeline escreveu. O resto é mock até `nonio.ingest`
 * publicar um manifesto de coleta.
 */
export async function fontes() {
  const demo = await emDemo();
  const agora = Date.now();
  const diasDesde = (iso: string) => (agora - new Date(iso).getTime()) / 86_400_000;

  return {
    dados: {
      fontes: [
        {
          slug: "focus",
          nome: "Boletim Focus",
          orgao: "Banco Central do Brasil",
          descricao:
            "Projeções de mais de cem instituições para inflação, juros, câmbio e atividade.",
          url: "https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado",
          cadencia: "Semanal, às segundas",
          coletadoEm: backtest.geradoEm,
          estado: (diasDesde(backtest.geradoEm) > 8 ? "atrasada" : "ok") as "ok" | "atrasada",
          registros: backtest.fotoAtual.linhas.reduce((s, l) => s + l.consenso.n, 0),
          observacao:
            diasDesde(backtest.geradoEm) > 8
              ? "Última coleta há mais de uma semana. O Focus publica toda segunda."
              : null,
        },
        {
          slug: "previsoes",
          nome: "Probabilidade por papel",
          orgao: "Pipeline Nônio",
          descricao: "Saída de nonio.probabilidade para os papéis do universo.",
          url: "https://github.com/LukeTheProtogen/Nonio",
          cadencia: "Diária, 06:00 BRT",
          coletadoEm: previsoesGeradasEm,
          estado: (diasDesde(previsoesGeradasEm) > 2 ? "atrasada" : "ok") as "ok" | "atrasada",
          registros: todasPrevisoes().length,
          observacao:
            diasDesde(previsoesGeradasEm) > 2
              ? "O cron diário não publicou nas últimas 48 horas."
              : null,
        },
        {
          slug: "brapi",
          nome: "Cotações",
          orgao: demo ? "Snapshot congelado, sobre dados da B3" : "brapi.dev, sobre dados da B3",
          descricao: "Preço de fechamento e variação do dia.",
          url: "https://brapi.dev",
          cadencia: demo ? "Congelada para demonstração" : "A cada 15 minutos",
          coletadoEm: demo ? snapshot.capturadoEm : new Date().toISOString(),
          estado: "ok" as const,
          registros: demo ? snapshot.cotacoes.length : temToken() ? ACOES.length : 4,
          observacao: demo
            ? "Modo demonstração ligado: nenhuma cotação é buscada, tudo vem do snapshot versionado."
            : temToken()
              ? null
              : "Sem BRAPI_TOKEN: só PETR4, VALE3, ITUB4 e MGLU3 têm preço. Os demais aparecem sem cotação.",
        },
        {
          slug: "ipca",
          nome: "IPCA",
          orgao: "IBGE",
          descricao: "Índice oficial de inflação, a régua contra a qual o consenso é medido.",
          url: "https://sidra.ibge.gov.br/tabela/7060",
          cadencia: "Mensal, por volta do dia 10",
          coletadoEm: backtest.geradoEm,
          estado: "ok" as const,
          registros: null,
          observacao: null,
        },
        {
          slug: "copom",
          nome: "Atas do Copom",
          orgao: "Banco Central do Brasil",
          descricao: "Texto integral das atas, de onde saem as citações do painel macro.",
          url: "https://www.bcb.gov.br/publicacoes/atascopom",
          cadencia: "A cada reunião, oito por ano",
          coletadoEm: null,
          estado: "nao_coletada" as const,
          registros: null,
          observacao:
            "O módulo nonio.llm existe, mas o acervo das 280 atas ainda não foi processado. As citações do painel são ilustrativas.",
        },
        {
          slug: "ipe",
          nome: "Fatos relevantes",
          orgao: "CVM — pacote IPE",
          descricao: "Comunicados obrigatórios das companhias abertas.",
          url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
          cadencia: "Contínua",
          coletadoEm: null,
          estado: "nao_coletada" as const,
          registros: null,
          observacao:
            "Falta o cruzamento CNPJ para ticker. Sem ele não dá para ligar um comunicado a um papel.",
        },
      ],
    },
    meta: meta({
      geradoEm: backtest.geradoEm,
      fontes: ["Banco Central", "IBGE", "CVM", "B3, via brapi.dev"],
      mock: true,
    }),
  };
}

// ------------------------------------------------------------------- conta

/** MOCK. Não existe banco de usuários: a sessão inteira é cookie assinado. */
export function conta(nome: string, plano: string) {
  const agora = new Date();
  const criada = new Date(agora.getTime() - 41 * 86_400_000);

  return {
    dados: {
      nome,
      email: `${nome.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@exemplo.com.br`,
      plano,
      criadaEm: criada.toISOString(),
      sessoes: [
        {
          id: "atual",
          dispositivo: "Este navegador",
          local: "São Paulo, BR",
          ultimoAcesso: agora.toISOString(),
          atual: true,
        },
        {
          id: "s2",
          dispositivo: "Chrome no Windows",
          local: "Porto Alegre, BR",
          ultimoAcesso: new Date(agora.getTime() - 3 * 86_400_000).toISOString(),
          atual: false,
        },
      ],
    },
    meta: meta({
      geradoEm: agora.toISOString(),
      fontes: ["Sessão local"],
      mock: true,
    }),
  };
}
