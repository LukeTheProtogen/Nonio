"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { emailPlausivel, senhaValida } from "@/lib/senha";
import {
  criarContaNaApi,
  entrarNaApi,
  temBackendDeAuth,
  usuarioDaApi,
} from "@/lib/auth-api";

/**
 * Sessão.
 *
 * Dois caminhos, decididos por `NONIO_API_URL`:
 *
 *   definida  autenticação REAL no nonio-api (fastapi-users, JWT de 7 dias).
 *             O cookie guarda o token, e `sessaoAtual` pergunta ao servidor
 *             quem é o dono dele.
 *   vazia     mock. O cookie guarda o próprio objeto de sessão e o código de
 *             e-mail é CODIGO_MOCK.
 *
 * O mock não foi apagado de propósito: sem ele, ninguém consegue mexer no front
 * sem subir o backend, e a landing e as telas públicas deixariam de rodar
 * sozinhas.
 *
 * O TOKEN NUNCA CHEGA AO NAVEGADOR como valor legível: mora em cookie
 * httpOnly, e todo uso acontece no servidor. Token que o JavaScript lê é token
 * que um script injetado rouba.
 *
 * O passo do código de seis dígitos só existe no mock. O fastapi-users
 * autentica com e-mail e senha direto; um código intermediário seria uma tela
 * pedindo algo que ninguém enviou.
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
  /**
   * E-mail confirmado. `null` no mock, que não tem como saber.
   *
   * Vem do backend e vai para a tela de conta. Distinguir "não confirmado" de
   * "não sabemos" importa: um pede ação da pessoa, o outro não pede nada.
   */
  verificado: boolean | null;
};

/** Lê a sessão. `null` quando não há ninguém logado. */
export async function sessaoAtual(): Promise<Sessao | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;

  if (temBackendDeAuth) {
    /*
     * O cookie guarda o TOKEN, e quem diz quem é o dono é o servidor. Confiar
     * no que estivesse escrito no cookie faria da sessão um campo editável:
     * o cookie é httpOnly contra script, não contra o dono da máquina.
     */
    const usuario = await usuarioDaApi(bruto);
    if (!usuario) return null;

    /*
      `name` é o que a pessoa digitou no cadastro, e é sempre melhor que qualquer
      coisa deduzida — ninguém acerta apelido a partir de endereço de e-mail.
      
      Mas ele pode chegar vazio: `UserCreate` exige o campo, e o cadastro por
      Google não passa por esse schema. Sem a rede de segurança, a barra lateral
      mostraria um nome em branco e uma inicial vazia dentro do círculo.
    */
    const nome = usuario.name.trim() || nomeDoEmail(usuario.email);
    return {
      nome,
      email: usuario.email,
      plano: "Assinatura",
      verificado: usuario.is_verified,
    };
  }

  try {
    return JSON.parse(decodeURIComponent(bruto)) as Sessao;
  } catch {
    return null;
  }
}

export type ResultadoEntrada = { erro: string } | undefined;

/**
 * Para onde ir depois de entrar.
 *
 * Só aceita caminho interno começando com uma barra. Sem essa checagem, um
 * `?de=https://outro-site` transformaria o nosso login em trampolim para
 * phishing — o usuário digita a senha aqui e é jogado em qualquer lugar.
 */
function destino(bruto: FormDataEntryValue | null): string {
  const alvo = String(bruto ?? "");
  if (!alvo.startsWith("/") || alvo.startsWith("//")) return "/macro";
  return alvo;
}

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

  const de = destino(form.get("de"));

  if (temBackendDeAuth) {
    const r = await entrarNaApi(email, senha);
    if ("motivo" in r) return { erro: r.mensagem };
    await gravarToken(r.token);
    redirect(de);
  }

  redirect(`/entrar/codigo?email=${encodeURIComponent(email)}&de=${encodeURIComponent(de)}`);
}

/**
 * Guarda o token JWT.
 *
 * `maxAge` casa com `jwt_lifetime_seconds` do backend (7 dias). Cookie que dura
 * mais que o token deixa a pessoa "logada" numa sessão que o servidor já
 * recusa, e o sintoma é uma tela que pisca e volta para o login.
 */
async function gravarToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
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
  const codigo = String(form.get("codigo") ?? "").trim();

  // Exatamente seis dígitos. Antes havia replace(/\D/g, ""), que APAGAVA o
  // lixo em vez de recusar: "000000abc" virava "000000" e entrava. O formulário
  // é controlado, mas a ação de servidor é a fronteira e não confia no cliente.
  if (!/^\d{6}$/.test(codigo)) {
    return { erro: "O código tem seis dígitos." };
  }

  if (codigo !== CODIGO_MOCK) {
    return { erro: "Esse código não confere. Confira o e-mail mais recente." };
  }

  const sessao: Sessao = {
    nome: nomeDoEmail(email),
    email: email || "voce@exemplo.com.br",
    plano: "Assinatura",
    verificado: null,
  };

  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(sessao)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(destino(form.get("de")));
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

/**
 * Cria a conta e manda para a verificação por código.
 *
 * MOCK: não persiste nada. O que vale aqui é a validação, que roda com as
 * MESMAS regras do formulário (lib/senha), para as duas pontas não divergirem.
 */
export async function criarConta(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const nome = String(form.get("nome") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");

  if (!nome) return { erro: "Diga como quer ser chamado." };
  if (!emailPlausivel(email)) return { erro: "Esse e-mail não parece válido." };
  if (!senhaValida(senha)) return { erro: "A senha ainda não cumpre as três regras." };

  const de = destino(form.get("de"));

  if (temBackendDeAuth) {
    const criada = await criarContaNaApi(nome, email, senha);
    if ("motivo" in criada) return { erro: criada.mensagem };

    // Cadastrou e já entra: mandar para a tela de login logo depois de criar a
    // conta é pedir a mesma senha duas vezes seguidas, sem ganho nenhum.
    const entrada = await entrarNaApi(email, senha);
    if ("motivo" in entrada) return { erro: entrada.mensagem };
    await gravarToken(entrada.token);
    redirect(de);
  }

  redirect(`/entrar/codigo?email=${encodeURIComponent(email)}&novo=1&de=${encodeURIComponent(de)}`);
}

/**
 * Pede o código de recuperação.
 *
 * A resposta é sempre a mesma, exista a conta ou não. É o que impede usar esta
 * tela para descobrir quem é cliente — e por isso ela nunca retorna erro de
 * "e-mail não encontrado", nem agora nem quando houver backend.
 */
export async function pedirRecuperacao(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  if (!emailPlausivel(email)) return { erro: "Esse e-mail não parece válido." };

  redirect(`/redefinir-senha?email=${encodeURIComponent(email)}`);
}

/**
 * Troca a senha e já entra.
 *
 * Trocar a senha encerra as outras sessões e avisa por e-mail — nada disso
 * existe ainda, mas a tela já promete, então o backend precisa cumprir.
 */
export async function redefinirSenha(
  _anterior: ResultadoEntrada,
  form: FormData,
): Promise<ResultadoEntrada> {
  const email = String(form.get("email") ?? "").trim();
  // Exatamente seis dígitos — mesma regra de verificarCodigo. Antes havia
  // replace(/\D/g, ""), que APAGAVA o lixo em vez de recusar: "000000abc"
  // virava "000000" e entrava, e não havia checagem de tamanho. A ação de
  // servidor é a fronteira; ela não confia no formulário.
  const codigo = String(form.get("codigo") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const repetida = String(form.get("repetida") ?? "");

  if (!/^\d{6}$/.test(codigo)) {
    return { erro: "O código tem seis dígitos." };
  }
  if (codigo !== CODIGO_MOCK) {
    return { erro: "Esse código não confere. Confira o e-mail mais recente." };
  }
  if (!senhaValida(senha)) return { erro: "A senha ainda não cumpre as três regras." };
  if (senha !== repetida) return { erro: "As duas senhas não são iguais." };

  await abrirSessao(email);
  redirect("/macro");
}

/** Grava o cookie de sessão. Único lugar que sabe o formato. */
async function abrirSessao(email: string): Promise<void> {
  const sessao: Sessao = {
    nome: nomeDoEmail(email),
    email: email || "voce@exemplo.com.br",
    plano: "Assinatura",
    verificado: null,
  };
  (await cookies()).set(COOKIE, encodeURIComponent(JSON.stringify(sessao)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
