import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Cookies da sessão Auth; refresh real acontece no proxy.
 */
export async function createClient() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado (NEXT_PUBLIC_SUPABASE_URL e chave publishable/anon).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component não escreve cookie — o proxy refresca.
        }
      },
    },
  });
}
