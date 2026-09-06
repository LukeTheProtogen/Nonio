import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy — no Next 16 é o que antes se chamava middleware. Mesmo comportamento,
 * outro nome e outro arquivo (`src/proxy.ts`).
 *
 * Aqui ele faz UMA coisa: quando alguém sem sessão tenta abrir uma rota do
 * produto, guarda o destino em `?de=` antes de mandar para o login. Depois de
 * entrar, a pessoa volta para onde queria ir, em vez de cair sempre no painel.
 *
 * A verificação de verdade continua no layout de `(app)`, que roda no servidor
 * e lê o cookie. Isto aqui é checagem otimista, como a própria documentação
 * recomenda: proxy não é lugar de autorização, é lugar de desvio barato.
 */
const PROTEGIDAS = ["/macro", "/acoes", "/historico", "/fontes", "/conta"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const protegida = PROTEGIDAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!protegida) return NextResponse.next();

  if (req.cookies.get("nonio_sessao")) return NextResponse.next();

  const login = new URL("/entrar", req.url);
  login.searchParams.set("de", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/macro/:path*", "/acoes/:path*", "/historico/:path*", "/fontes/:path*", "/conta/:path*"],
};
