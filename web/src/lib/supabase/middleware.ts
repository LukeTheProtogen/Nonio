import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Refresca a sessão Supabase no proxy (Next 16) e devolve a response
 * com cookies atualizados — padrão oficial @supabase/ssr.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    return { response: supabaseResponse, userId: null as string | null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Não colocar lógica entre createServerClient e getClaims/getUser.
  const { data } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  return { response: supabaseResponse, userId };
}
