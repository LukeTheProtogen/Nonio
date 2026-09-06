import { cookies } from "next/headers";
import type { Sessao } from "@/lib/sessao";

/**
 * Sessão local de desenvolvimento, sem Supabase.
 *
 * Existe porque o front deixou de rodar sozinho quando a autenticação virou
 * Supabase: sem `NEXT_PUBLIC_SUPABASE_URL` e a chave, toda rota do produto
 * redireciona para /entrar e não há como entrar. Isso trava quem quer mexer em
 * UI, em gráfico ou em texto, e é a maioria do trabalho no front.
 *
 * ═══ A TRAVA ═══
 *
 * Isto é um atalho de autenticação. Um atalho de autenticação que vaza para
 * produção não é bug: é porta dos fundos aberta para qualquer pessoa que
 * descubra o nome da variável.
 *
 * Por isso são DUAS condições, e as duas independentes:
 *
 *   1. `NODE_ENV !== "production"`. O `next build` fixa isso em produção, e
 *      não há variável de ambiente que faça a Vercel rodar como development.
 *      Sozinha, esta condição já bastaria.
 *   2. `NONIO_AUTH_LOCAL=1` precisa estar ligada de propósito. Sozinha, ela
 *      nunca liga nada em produção, por causa da condição 1.
 *
 * Uma trava só seria suficiente. São duas porque o custo de errar aqui é
 * autenticação inteira, e o custo de uma linha a mais é uma linha.
 *
 * O cookie guarda o objeto da sessão em texto, e isso é aceitável SÓ porque
 * este caminho nunca existe em produção. Em produção quem responde quem é o
 * dono da sessão é o Supabase.
 */
const COOKIE = "nonio_sessao_local";

export function authLocalLigada(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NONIO_AUTH_LOCAL === "1";
}

export async function sessaoLocal(): Promise<Sessao | null> {
  if (!authLocalLigada()) return null;

  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;

  try {
    return JSON.parse(decodeURIComponent(bruto)) as Sessao;
  } catch {
    return null;
  }
}

export async function abrirSessaoLocal(nome: string, email: string): Promise<void> {
  if (!authLocalLigada()) return;

  const sessao: Sessao = {
    nome: nome.trim() || email.split("@")[0] || "Você",
    email,
    plano: null,
    // `false`, não `null`: em desenvolvimento ninguém confirma e-mail, e a tela
    // de conta precisa exercitar o estado "não confirmado" que existe de
    // verdade em produção.
    verificado: false,
  };

  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(sessao)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function fecharSessaoLocal(): Promise<void> {
  // Sem a guarda: apagar cookie é seguro em qualquer ambiente, e deixar
  // resíduo de um modo desligado é pior que apagar à toa.
  (await cookies()).delete(COOKIE);
}
