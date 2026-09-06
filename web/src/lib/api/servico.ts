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
 */

const BASE = process.env.NONIO_API_URL?.replace(/\/$/, "") ?? "";

const CACHE = {
  macro: 900,
  acoes: 300,
  historico: 3600,
  fontes: 300,
} as const;

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

async function doBackendOuLocal<T extends z.ZodType>(
  rota: string,
  schema: T,
  revalidate: number,
  localFn: () => unknown | Promise<unknown>,
): Promise<z.infer<T>> {
  if (!usandoBackend) {
    return schema.parse(await localFn());
  }
  try {
    return await doBackend(rota, schema, revalidate);
  } catch (erro) {
    // 401: sem NextAuth. 404: rota ainda não existe na API (/macro, /acoes…).
    if (erro instanceof ErroApi && (erro.status === 401 || erro.status === 404)) {
      return schema.parse(await localFn());
    }
    throw erro;
  }
}

export async function obterMacro(): Promise<Macro> {
  const r = await doBackendOuLocal("/macro", zMacro, CACHE.macro, () => local.macro());
  return r.dados;
}

export async function obterAcoes(): Promise<Acoes> {
  const r = await doBackendOuLocal("/acoes", zAcoes, CACHE.acoes, () => local.acoes());
  return r.dados;
}

export async function obterAcao(ticker: string): Promise<AcaoDetalhe | null> {
  const t = ticker.toUpperCase();

  if (usandoBackend) {
    try {
      const r = await doBackend(`/acoes/${t}`, zAcaoDetalhe, CACHE.acoes);
      return r.dados;
    } catch (erro) {
      if (erro instanceof ErroApi && (erro.status === 401 || erro.status === 404)) {
        const bruto = await local.acao(t);
        return bruto ? zAcaoDetalhe.parse(bruto).dados : null;
      }
      throw erro;
    }
  }

  const bruto = await local.acao(t);
  return bruto ? zAcaoDetalhe.parse(bruto).dados : null;
}

export async function obterHistorico(): Promise<Historico> {
  const r = await doBackendOuLocal("/historico", zHistorico, CACHE.historico, () =>
    local.historico(),
  );
  return r.dados;
}

export async function obterFontes(): Promise<Fontes> {
  const r = await doBackendOuLocal("/fontes", zFontes, CACHE.fontes, () => local.fontes());
  return r.dados;
}

export async function obterConta(nome: string, plano: string): Promise<Conta> {
  return zConta.parse(local.conta(nome, plano)).dados;
}
