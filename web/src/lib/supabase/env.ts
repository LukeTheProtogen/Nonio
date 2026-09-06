/** URL + chave públicas do projeto Supabase (Auth + Postgres hospedados). */

export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
}

/** Publishable (novo) ou anon (legado) — os dois funcionam no Auth. */
export function supabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}
