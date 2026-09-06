import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Proxy — refresca sessão Supabase e checagem otimista de rotas protegidas.
 * Autorização de verdade: layout `(app)` + `sessaoAtual()`.
 */
const PROTEGIDAS = ["/macro", "/acoes", "/historico", "/fontes", "/conta"];

export async function proxy(req: NextRequest) {
  const { response, userId } = await updateSession(req);
  const { pathname, search } = req.nextUrl;

  const protegida = PROTEGIDAS.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  if (!protegida) return response;

  if (userId) return response;

  /*
    Modo local de desenvolvimento.

    Sem esta checagem, o proxy e a página de entrar entravam em LAÇO: /entrar via
    a sessão local e mandava para /macro; o proxy não conhecia o cookie local,
    não achava usuário do Supabase e mandava de volta para /entrar. O navegador
    ficava rodando entre as duas até travar, e a tela ficava em branco.

    A trava é a mesma de `lib/auth-local`, repetida aqui porque o proxy roda no
    Edge e não pode importar módulo que usa `next/headers`. Duas condições, e as
    duas independentes: fora de produção E a variável ligada de propósito.
  */
  const local =
    process.env.NODE_ENV !== "production" && process.env.NONIO_AUTH_LOCAL === "1";
  if (local && req.cookies.get("nonio_sessao_local")) return response;

  const login = new URL("/entrar", req.url);
  login.searchParams.set("de", pathname + search);
  const redirect = NextResponse.redirect(login);
  response.cookies.getAll().forEach((c) => {
    redirect.cookies.set(c.name, c.value);
  });
  return redirect;
}

export const config = {
  matcher: [
    "/macro/:path*",
    "/acoes/:path*",
    "/historico/:path*",
    "/fontes/:path*",
    "/conta/:path*",
    "/entrar",
    "/criar-conta",
    "/auth/callback",
  ],
};
