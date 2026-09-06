import type { z } from "zod";
import {
  zMacro,
  zAcoes,
  zAcaoDetalhe,
  zHistorico,
  zFontes,
  zConta,
  type Macro,
  type Acoes,
  type AcaoDetalhe,
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

const RECURSOS_NO_BACKEND = new Set<"macro" | "acoes" | "historico" | "fontes">([
  "acoes", // GET /acoes — lowvol spine via previews parquet + DuckDB
  // "macro",     ← não existe no backend ainda
  // "historico", ← não existe no backend ainda
  // "fontes",    ← não existe no backend ainda
]);

function noBackend(recurso: "macro" | "acoes" | "historico" | "fontes"): boolean {
  return BASE.length > 0 && RECURSOS_NO_BACKEND.has(recurso);
}

const CACHE = {
  macro: 900,
  acoes: 300,
  historico: 3600,
  fontes: 300,
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
