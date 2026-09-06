import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/destino";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

const COOKIE_NEXT = "nonio_oauth_next";

/**
 * Troca o ?code= do OAuth Google (Supabase) por sessão em cookie.
 *
 * Os cookies da sessão TÊM que ir no próprio `NextResponse.redirect`.
 * Escrever só em `cookies()` do next/headers e redirecionar em seguida
 * perde o Set-Cookie na prática — a pessoa volta pro /entrar sem sessão.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");

  const jar = await cookies();
  const next = destinoSeguro(
    url.searchParams.get("next") ?? jar.get(COOKIE_NEXT)?.value,
  );

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?erro=oauth", url.origin));
  }

  const supabaseHost = supabaseUrl();
  const supabaseKey = supabasePublishableKey();
  if (!supabaseHost || !supabaseKey) {
    return NextResponse.redirect(new URL("/entrar?erro=oauth", url.origin));
  }

  let response = NextResponse.redirect(new URL(next, url.origin));
  response.cookies.delete(COOKIE_NEXT);

  const supabase = createServerClient(supabaseHost, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("identity") ||
      msg.includes("already") ||
      msg.includes("linked") ||
      msg.includes("manual")
    ) {
      return NextResponse.redirect(
        new URL("/entrar?erro=email-senha", url.origin),
      );
    }
    return NextResponse.redirect(new URL("/entrar?erro=oauth", url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const providers = new Set(
    (user?.identities ?? []).map((i) => i.provider).filter(Boolean),
  );
  // Regra de produto: senha e Google não compartilham o mesmo e-mail.
  if (providers.has("email") && providers.has("google")) {
    await supabase.auth.signOut();
    const bloqueado = NextResponse.redirect(
      new URL("/entrar?erro=email-senha", url.origin),
    );
    response.cookies.getAll().forEach((c) => {
      bloqueado.cookies.set(c.name, c.value);
    });
    return bloqueado;
  }

  return response;
}
