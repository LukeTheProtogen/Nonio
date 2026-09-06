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
