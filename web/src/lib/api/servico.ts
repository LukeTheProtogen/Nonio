import type { z } from "zod";
import {
  zMacro,
  zCopomMeetingOut,
  zAcoes,
  zAcaoDetalhe,
  zCopomPage,
  zHistorico,
  zFontes,
  zConta,
  type Macro,
  type Acoes,
  type AcaoDetalhe,
  type CopomReuniao,
  type Historico,
  type Fontes,
  type Conta,
} from "./contratos";
import * as local from "./local";
import { mintApiAccessToken } from "./access-token";

/**
 * A única porta por onde a interface pega dado.
 *
 *   NONIO_API_URL definida  →  FastAPI, com JWT mintado após Supabase Auth
 *   NONIO_API_URL vazia     →  mock / pipeline local
 *   Backend ligado mas sem sessão → cai no local (ex.: landing deslogada)
 *
 * `NONIO_API_URL` não significa "o backend tem tudo". Lista explícita abaixo:
 * ligar um recurso é acrescentar uma linha, sem fallback silencioso em 404.
 */

const BASE = process.env.NONIO_API_URL?.replace(/\/$/, "") ?? "";

type Recurso = "macro" | "acoes" | "historico" | "fontes" | "copom";

/**
 * O que o backend serve, POR PADRÃO.
 *
 * `acoes` está ligado porque o nonio-api publica a lowvol spine. `copom` porque
 * as atas extraídas (features.parquet) já alimentam o gráfico longo. Macro,
 * histórico e fontes ainda não existem lá.
 */
const PADRAO: Recurso[] = ["acoes", "copom"];

/**
 * Sobrescrita por ambiente: `NONIO_RECURSOS_BACKEND`.
 *
 * Existe porque "o backend serve X" depende da MÁQUINA, não do código. Quem tem
 * o parquet ingerido quer /acoes vindo da API; quem não tem quer o mock, senão
 * a tela fica vazia e o trabalho de front trava.
 *
 * Antes disso a única saída era comentar a linha e desfazer a integração de
 * quem a ligou — e aí um dos dois lados sempre quebrava a cada pull.
 *
 *   NONIO_RECURSOS_BACKEND=acoes,copom,macro   liga os três
 *   NONIO_RECURSOS_BACKEND=                    desliga tudo, cai no mock
 *   variável ausente                           usa o padrão acima
 */
const RECURSOS_NO_BACKEND = new Set<Recurso>(
  process.env.NONIO_RECURSOS_BACKEND === undefined
    ? PADRAO
    : (process.env.NONIO_RECURSOS_BACKEND.split(",")
        .map((r) => r.trim())
        .filter(Boolean) as Recurso[]),
);

function noBackend(recurso: Recurso): boolean {
  return BASE.length > 0 && RECURSOS_NO_BACKEND.has(recurso);
}

const CACHE = {
  macro: 900,
  acoes: 300,
  historico: 3600,
  fontes: 300,
  copom: 3600,
} as const;

/** Há backend configurado. Não implica que ele sirva todos os recursos. */
export const usandoBackend = BASE.length > 0;

class ErroApi extends Error {
  constructor(
    readonly rota: string,
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }
}

async function doBackend<T extends z.ZodType>(
  rota: string,
  schema: T,
  revalidate: number,
): Promise<z.infer<T>> {
  const token = await mintApiAccessToken();
  if (!token) {
    throw new ErroApi(rota, 401, `${rota} exige sessão Supabase`);
  }

  const resposta = await fetch(`${BASE}${rota}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    next: { revalidate },
  });

  if (!resposta.ok) {
    throw new ErroApi(rota, resposta.status, `${rota} respondeu ${resposta.status}`);
  }

  return schema.parse(await resposta.json());
}

export async function obterMacro(): Promise<Macro> {
  const r = noBackend("macro")
    ? await doBackend("/macro", zMacro, CACHE.macro)
    : zMacro.parse(local.macro());
  return r.dados;
}

export async function envelopeAcoes(): Promise<z.infer<typeof zAcoes>> {
  if (!noBackend("acoes")) {
    return zAcoes.parse(await local.acoes());
  }
  try {
    return await doBackend("/acoes", zAcoes, CACHE.acoes);
  } catch (erro) {
    // BFF / páginas sem JWT: ainda servem o spine publicado em previsoes.json
    if (erro instanceof ErroApi && erro.status === 401) {
      return zAcoes.parse(await local.acoes());
    }
    throw erro;
  }
}

export async function envelopeAcao(
  ticker: string,
): Promise<z.infer<typeof zAcaoDetalhe> | null> {
  const t = ticker.toUpperCase();
  if (!noBackend("acoes")) {
    const bruto = await local.acao(t);
    return bruto ? zAcaoDetalhe.parse(bruto) : null;
  }
  try {
    return await doBackend(`/acoes/${t}`, zAcaoDetalhe, CACHE.acoes);
  } catch (erro) {
    if (erro instanceof ErroApi && (erro.status === 401 || erro.status === 404)) {
      const bruto = await local.acao(t);
      return bruto ? zAcaoDetalhe.parse(bruto) : null;
    }
    throw erro;
  }
}

export async function obterAcoes(): Promise<Acoes> {
  return (await envelopeAcoes()).dados;
}

export async function obterAcao(ticker: string): Promise<AcaoDetalhe | null> {
  const env = await envelopeAcao(ticker);
  return env?.dados ?? null;
}

/**
 * Reduz o formato do backend (snake_case, 14 campos) ao que a tela usa.
 * Descarta reunião sem data em nenhum dos três campos — sem data ela não tem
 * onde ser plotada.
 */
function reduzir(itens: z.infer<typeof zCopomMeetingOut>[]): CopomReuniao[] {
  return itens
    .map((r) => {
      const data =
        r.data_referencia ??
        r.data_publicacao ??
        r.datas_reuniao?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ??
        null;
      if (!data) return null;
      return {
        nro: r.nro_reuniao,
        data,
        pdfUrl: r.pdf_url ?? null,
        decisao: r.decisao ?? null,
        selic: r.selic_meta_aa ?? null,
        delta: r.delta_pp ?? null,
        tom: r.tom_politica ?? null,
        resumo: r.resumo ?? null,
      } satisfies CopomReuniao;
    })
    .filter((r): r is CopomReuniao => r !== null)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
}

export async function obterCopom(): Promise<CopomReuniao[]> {
  // Sem backend, serve o arquivo publicado por scripts/publicar-api.sh.
  // Antes devolvia [] e a linha da Selic sumia da tela sem explicação.
  if (!noBackend("copom")) {
    return reduzir(zCopomMeetingOut.array().parse(local.copom()));
  }
  try {
    const page = await doBackend(
      "/copom?page_size=100&with_features_only=true",
      zCopomPage,
      CACHE.copom,
    );
    return reduzir(page.items);
  } catch (erro) {
    // Mesma política do envelopeAcoes: sem JWT (BFF anônimo, ?demo=1, página
    // pública) cai no arquivo publicado em vez de devolver lista vazia. Antes
    // daqui saía [] e a linha da Selic sumia da tela sem explicação.
    if (erro instanceof ErroApi && (erro.status === 401 || erro.status === 404)) {
      return reduzir(zCopomMeetingOut.array().parse(local.copom()));
    }
    throw erro;
  }
}

export async function obterHistorico(): Promise<Historico> {
  const r = noBackend("historico")
    ? await doBackend("/historico", zHistorico, CACHE.historico)
    : zHistorico.parse(local.historico());
  return r.dados;
}

export async function obterFontes(): Promise<Fontes> {
  const r = noBackend("fontes")
    ? await doBackend("/fontes", zFontes, CACHE.fontes)
    : zFontes.parse(await local.fontes());
  return r.dados;
}

/**
 * A conta.
 *
 * Recebe o que a sessão já resolveu (Supabase). O que não se sabe chega como
 * null e a tela mostra a ausência.
 */
export async function obterConta(p: {
  nome: string;
  email: string;
  plano: string | null;
  verificado: boolean | null;
}): Promise<Conta> {
  return zConta.parse(local.conta(p)).dados;
}
