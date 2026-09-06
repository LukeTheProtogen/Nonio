import { z } from "zod";

/**
 * Cliente de autenticação do `nonio-api` (fastapi-users).
 *
 * Conferido contra o servidor real, não contra a documentação. Três detalhes
 * do fastapi-users que só aparecem batendo na porta:
 *
 *  1. O login é `application/x-www-form-urlencoded`, não JSON, e o campo do
 *     e-mail chama `username`. É o padrão OAuth2 do FastAPI; mandar JSON
 *     devolve 422 sem explicar o motivo.
 *  2. O cadastro exige `name` além de e-mail e senha, porque `UserCreate`
 *     estende o schema base com esse campo.
 *  3. Domínio reservado é recusado na validação: `@nonio.local` volta 422. Vale
 *     lembrar ao testar.
 *
 * O token é JWT com sete dias de validade (`jwt_lifetime_seconds`), guardado em
 * cookie httpOnly pelo `lib/sessao`. Nunca chega ao JavaScript do navegador:
 * token legível por script é token roubável por script.
 */

const BASE = process.env.NONIO_API_URL?.replace(/\/$/, "") ?? "";

/** Com a URL vazia, todo o fluxo cai no mock. Ver `lib/sessao`. */
export const temBackendDeAuth = BASE.length > 0;

export const zUsuario = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  /** Plano da assinatura. Nulo enquanto não houver cobrança. */
  plan: z.string().nullable(),
  is_active: z.boolean(),
  is_verified: z.boolean(),
  is_superuser: z.boolean(),
});

export type Usuario = z.infer<typeof zUsuario>;

const zToken = z.object({ access_token: z.string(), token_type: z.string() });

/**
 * Erro de autenticação já traduzido.
 *
 * `motivo` existe para o chamador decidir a mensagem; `mensagem` é o texto que
 * pode ir para a tela sem revelar nada. As duas coisas separadas porque a
 * regra de produto é que a tela NUNCA diga se foi o e-mail ou a senha.
 */
export type FalhaAuth = { motivo: "credenciais" | "existe" | "invalido" | "rede"; mensagem: string };

async function pedir(rota: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE}${rota}`, {
    ...init,
    // Autenticação nunca é cacheada, nem por engano.
    cache: "no-store",
  });
}

/** POST /auth/jwt/login. Devolve o token cru; quem guarda é o `lib/sessao`. */
export async function entrarNaApi(
  email: string,
  senha: string,
): Promise<{ token: string } | FalhaAuth> {
  let r: Response;
  try {
    r = await pedir("/auth/jwt/login", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password: senha }),
    });
  } catch {
    return { motivo: "rede", mensagem: "Não conseguimos falar com o servidor. Tente de novo." };
  }

  if (r.status === 400 || r.status === 401) {
    // 400 aqui é LOGIN_BAD_CREDENTIALS. A mensagem não distingue os dois campos.
    return { motivo: "credenciais", mensagem: "E-mail ou senha não conferem." };
  }
  if (!r.ok) {
    return { motivo: "invalido", mensagem: "Não foi possível entrar agora." };
  }

  const dados = zToken.safeParse(await r.json());
  if (!dados.success) {
    return { motivo: "invalido", mensagem: "Resposta inesperada do servidor." };
  }
  return { token: dados.data.access_token };
}

/** POST /auth/register. Não abre sessão: quem entra depois é o chamador. */
export async function criarContaNaApi(
  nome: string,
  email: string,
  senha: string,
): Promise<{ ok: true } | FalhaAuth> {
  let r: Response;
  try {
    r = await pedir("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nome, email, password: senha }),
    });
  } catch {
    return { motivo: "rede", mensagem: "Não conseguimos falar com o servidor. Tente de novo." };
  }

  if (r.ok) return { ok: true };

  /*
   * 400 com REGISTER_USER_ALREADY_EXISTS diz que a conta existe.
   *
   * Isso É um vazamento: quem tenta um e-mail descobre se ele é cliente. Não dá
   * para esconder no front, porque o servidor já respondeu — a correção é no
   * backend, respondendo igual nos dois casos e mandando e-mail explicando.
   * Enquanto isso a tela devolve uma mensagem útil, porque a informação já
   * vazou de qualquer jeito e esconder só prejudicaria quem esqueceu que tinha
   * conta.
   */
  const corpo = (await r.json().catch(() => null)) as { detail?: unknown } | null;
  if (typeof corpo?.detail === "string" && corpo.detail.includes("ALREADY_EXISTS")) {
    return { motivo: "existe", mensagem: "Já existe uma conta com esse e-mail." };
  }
  if (r.status === 422) {
    return { motivo: "invalido", mensagem: "Esse e-mail não parece válido." };
  }
  return { motivo: "invalido", mensagem: "Não foi possível criar a conta agora." };
}

/** GET /users/me. Token expirado ou revogado devolve null, nunca erro. */
export async function usuarioDaApi(token: string): Promise<Usuario | null> {
  try {
    const r = await pedir("/users/me", { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const dados = zUsuario.safeParse(await r.json());
    return dados.success ? dados.data : null;
  } catch {
    // Servidor fora do ar não deve derrubar a página inteira: a guarda de
    // sessão trata `null` como "não logado" e manda para /entrar.
    return null;
  }
}
