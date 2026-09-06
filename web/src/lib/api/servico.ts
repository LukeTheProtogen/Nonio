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

/**
 * A única porta por onde a interface pega dado.
 *
 * Uma chave decide de onde vem:
 *
 *   NONIO_API_URL definida  →  busca no `nonio-api`
 *   NONIO_API_URL vazia     →  monta aqui, do mock e do que o pipeline já publica
 *
 * Os dois caminhos passam pelo MESMO schema de `contratos.ts`. É isso que
 * impede o mock de derivar: se ele deixar de caber no contrato, quebra em
 * desenvolvimento, não na integração.
 *
 * Nenhuma página busca a própria rota `/api/...` por HTTP. Componente de
 * servidor chamando o próprio servidor é uma volta de rede a troco de nada, e
 * ainda obriga a repassar cookie na mão. As rotas em `src/app/api/` existem
 * para o contrato ser inspecionável com curl e para um front separado poder
 * consumir; internamente todo mundo chama as funções daqui.
 */

const BASE = process.env.NONIO_API_URL?.replace(/\/$/, "") ?? "";

/** Segundos de cache por recurso. Espelha a cadência real da fonte. */
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

/**
 * Busca no backend e valida. O `parse` é proposital: resposta fora do contrato
 * tem que estourar aqui, com o nome do campo, e não trinta linhas adiante como
 * `undefined` renderizado em branco.
 */
async function doBackend<T extends z.ZodType>(
  rota: string,
  schema: T,
  revalidate: number,
): Promise<z.infer<T>> {
  const resposta = await fetch(`${BASE}${rota}`, {
    headers: { accept: "application/json" },
    next: { revalidate },
  });

  if (!resposta.ok) {
    throw new ErroApi(rota, resposta.status, `${rota} respondeu ${resposta.status}`);
  }

  return schema.parse(await resposta.json());
}

export async function obterMacro(): Promise<Macro> {
  const r = usandoBackend
    ? await doBackend("/macro", zMacro, CACHE.macro)
    : zMacro.parse(local.macro());
  return r.dados;
}

export async function obterAcoes(): Promise<Acoes> {
  const r = usandoBackend
    ? await doBackend("/acoes", zAcoes, CACHE.acoes)
    : zAcoes.parse(await local.acoes());
  return r.dados;
}

export async function obterAcao(ticker: string): Promise<AcaoDetalhe | null> {
  const t = ticker.toUpperCase();

  if (usandoBackend) {
    try {
      const r = await doBackend(`/acoes/${t}`, zAcaoDetalhe, CACHE.acoes);
      return r.dados;
    } catch (erro) {
      // 404 é resposta válida da API, não falha: o papel não está no universo.
      if (erro instanceof ErroApi && erro.status === 404) return null;
      throw erro;
    }
  }

  const bruto = await local.acao(t);
  return bruto ? zAcaoDetalhe.parse(bruto).dados : null;
}

export async function obterHistorico(): Promise<Historico> {
  const r = usandoBackend
    ? await doBackend("/historico", zHistorico, CACHE.historico)
    : zHistorico.parse(local.historico());
  return r.dados;
}

export async function obterFontes(): Promise<Fontes> {
  const r = usandoBackend
    ? await doBackend("/fontes", zFontes, CACHE.fontes)
    : zFontes.parse(local.fontes());
  return r.dados;
}

/**
 * A conta é a única que não tem versão de backend por enquanto: enquanto a
 * autenticação for mock, não existe usuário do outro lado para consultar.
 */
export async function obterConta(nome: string, plano: string): Promise<Conta> {
  return zConta.parse(local.conta(nome, plano)).dados;
}
