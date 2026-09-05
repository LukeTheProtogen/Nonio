"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Sessão — MOCK.
 *
 * Não existe backend de autenticação ainda. Este módulo grava um cookie e
 * pronto: não valida senha de verdade, não cifra nada, não expira do lado do
 * servidor. Serve para a interface poder ser construída e navegada.
 *
 * O código de e-mail está fixo em CODIGO_MOCK. Quando o envio real existir,
 * trocar `verificarCodigo` por uma chamada ao serviço e apagar a constante — o
 * resto da interface não muda, porque só depende de `sessaoAtual()`.
 *
 * Duas regras de segurança que valem desde já, e que estão implementadas aqui
 * porque são decisão de produto e não de infraestrutura:
 *   1. a mensagem de erro nunca diz se foi o e-mail ou a senha;
 *   2. a confirmação de recuperação é idêntica exista a conta ou não.
 * As duas evitam que alguém descubra quem é cliente.
 */

const COOKIE = "nonio_sessao";

/** MOCK: qualquer e-mail entra com este código. Remover ao ligar o envio real. */
const CODIGO_MOCK = "000000";

export type Sessao = {
  nome: string;
  email: string;
  plano: string;
};

/** Lê a sessão do cookie. `null` quando não há ninguém logado. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  try {
    return JSON.parse(decodeURIComponent(bruto)) as Sessao;
  } catch {
    return null;
  }
}

export type ResultadoEntrada = { erro: string } | undefined;

/**
 * Passo 1: e-mail e senha.
 *
 * MOCK: aceita qualquer par não vazio. Não há verificação de senha porque não
 * há onde verificar — o que importa aqui é o fluxo da interface.
 */
export async function pedirCodigo(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");

  if (!email || !senha) {
    // Deliberadamente genérico: não dizemos qual dos dois faltou.
    return { erro: "E-mail ou senha não conferem." };
  }

  redirect(`/entrar/codigo?email=${encodeURIComponent(email)}`);
}

/**
 * Passo 2: o código de seis dígitos.
 *
 * MOCK: compara com CODIGO_MOCK. O código real expira em 10 minutos, vale uma
 * vez só, e três erros seguidos o invalidam — nada disso existe ainda.
 */
export async function verificarCodigo(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").replace(/\D/g, "");

  if (codigo !== CODIGO_MOCK) {
    return { erro: "Esse código não confere. Confira o e-mail mais recente." };
  }

  const sessao: Sessao = {
    nome: nomeDoEmail(email),
    email: email || "voce@exemplo.com.br",
    plano: "Assinatura",
  };

  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(sessao)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/macro");
}

export async function sair(): Promise<void> {
  (await cookies()).delete(COOKIE);
  redirect("/entrar");
}

/** "guilherme.bohrer@x.com" vira "Guilherme". Só para a interface ter um nome. */
function nomeDoEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const primeiro = local.split(/[._-]/)[0] ?? "";
  if (!primeiro) return "Você";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}
