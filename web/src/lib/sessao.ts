"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { destinoSeguro } from "@/lib/destino";
import { emailPlausivel, senhaValida } from "@/lib/senha";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const COOKIE_OAUTH_NEXT = "nonio_oauth_next";

/**
 * Sessão = Supabase Auth (e-mail/senha ou Google).
 * FastAPI só vê o JWT curto mintado depois da sessão Supabase.
 */

export type Sessao = {
  nome: string;
  email: string;
  /**
   * Plano da assinatura. NULO enquanto não houver cobrança.
   * Sem inventar rótulo fixo na tela de conta.
   */
  plano: string | null;
  /**
   * E-mail confirmado no provedor de auth. `null` se não soubermos.
   */
  verificado: boolean | null;
};

export type ResultadoEntrada = { erro: string } | undefined;

function destino(bruto: FormDataEntryValue | null | string): string {
  return destinoSeguro(bruto);
}

function nomeDoEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const primeiro = local.split(/[._-]/)[0] ?? "";
  if (!primeiro) return "Você";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

function msgErroAuth(mensagem: string | undefined): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
    return "Este e-mail já tem conta. Entre com o método que você usou (e-mail e senha ou Google).";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "E-mail ou senha não conferem.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme o e-mail antes de entrar. Olhe a caixa de entrada.";
  }
  return "Não deu para entrar agora. Tente de novo.";
}

function sessaoDeUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): Sessao | null {
  const email = user.email?.trim();
  if (!email) return null;
  const nomeMeta =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null;
  const verificado = Boolean(user.email_confirmed_at || user.confirmed_at);
  return {
    nome: nomeMeta?.trim() || nomeDoEmail(email),
    email,
    plano: null,
    verificado,
  };
}

export async function sessaoAtual(): Promise<Sessao | null> {
  if (!supabaseConfigured()) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return sessaoDeUser(data.user);
}

export async function entrarComGoogle(form: FormData): Promise<void> {
  const de = destino(form.get("de"));
  if (!supabaseConfigured()) {
    redirect("/entrar?erro=oauth");
  }

  const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";
  // `next` vai em cookie: redirectTo com ?next= NÃO está na allowlist do
  // Supabase (exact match) e cai no site_url → /?code=... sem trocar sessão.
  const jar = await cookies();
  jar.set(COOKIE_OAUTH_NEXT, de, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    redirect("/entrar?erro=oauth");
  }
  redirect(data.url);
}

/** E-mail + senha → sessão Supabase. */
export async function pedirCodigo(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const de = destino(form.get("de"));

  if (!email || !senha) {
    return { erro: "E-mail ou senha não conferem." };
  }
  if (!supabaseConfigured()) {
    return {
      erro: "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e chave).",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { erro: msgErroAuth(error.message) };
  }

  redirect(de);
}

/** Rota /entrar/codigo legada — pede login de novo. */
export async function verificarCodigo(
  _anterior: ResultadoEntrada,
  _form: FormData,
): Promise<ResultadoEntrada> {
  return { erro: "Sessão de login expirou. Entre de novo." };
}

export async function sair(): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/entrar");
}

/** Cria conta no Supabase Auth (e-mail único no projeto). */
export async function criarConta(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const de = destino(form.get("de"));

  if (!nome) return { erro: "Diga como quer ser chamado." };
  if (!emailPlausivel(email)) return { erro: "Esse e-mail não parece válido." };
  if (!senhaValida(senha)) {
    return { erro: "A senha ainda não cumpre as três regras." };
  }
  if (!supabaseConfigured()) {
    return {
      erro: "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e chave).",
    };
  }

  const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";
  const jar = await cookies();
  jar.set(COOKIE_OAUTH_NEXT, de, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { name: nome, auth_via: "password" },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
      return {
        erro: "Este e-mail já tem conta. Entre com o método que você usou (e-mail e senha ou Google).",
      };
    }
    return { erro: "Não deu para criar a conta agora. Tente de novo." };
  }

  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      erro: "Este e-mail já tem conta. Entre com o método que você usou (e-mail e senha ou Google).",
    };
  }

  if (data.session) {
    redirect(de);
  }

  redirect(`/entrar?de=${encodeURIComponent(de)}&erro=confirme-email`);
}

export async function pedirRecuperacao(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  if (!emailPlausivel(email)) return { erro: "Esse e-mail não parece válido." };

  if (supabaseConfigured()) {
    const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";
    const jar = await cookies();
    jar.set(COOKIE_OAUTH_NEXT, "/redefinir-senha", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60,
    });
    const supabase = await createClient();
    await supabase.auth
      .resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback`,
      })
      .catch(() => undefined);
  }

  redirect(`/redefinir-senha?email=${encodeURIComponent(email)}`);
}

export async function redefinirSenha(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const senha = String(form.get("senha") ?? "");
  const repetida = String(form.get("repetida") ?? "");

  if (!senhaValida(senha)) {
    return { erro: "A senha ainda não cumpre as três regras." };
  }
  if (senha !== repetida) return { erro: "As duas senhas não são iguais." };
  if (!supabaseConfigured()) {
    return {
      erro: "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e chave).",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return {
      erro: "Não deu para redefinir. Abra o link do e-mail de novo e tente outra vez.",
    };
  }

  redirect("/macro");
}
