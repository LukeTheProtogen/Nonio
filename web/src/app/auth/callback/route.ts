import { NextResponse } from "next/server";
import { destinoSeguro } from "@/lib/destino";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o ?code= do OAuth Google (Supabase) por sessão em cookie.
 * Se o e-mail já tinha senha e o projeto linkou identities, bloqueamos.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = destinoSeguro(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?erro=oauth", url.origin));
  }

  const supabase = await createClient();
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
    return NextResponse.redirect(
      new URL("/entrar?erro=email-senha", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
