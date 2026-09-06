import { SignJWT } from "jose";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

const ISSUER = "nonio-web";
const AUDIENCE = "nonio-api";
const AUTH_SECRET_FRACO = "CHANGE-ME-dev-only-use-openssl-rand-hex-32";

/**
 * JWT curto para a FastAPI, só depois de sessão Supabase válida.
 * Pattern A: browser → Next → API (Bearer).
 */
export async function mintApiAccessToken(): Promise<string | null> {
  if (!supabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub || typeof claims.sub !== "string") return null;

  const email =
    typeof claims.email === "string"
      ? claims.email
      : undefined;
  if (!email) {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return null;
    return assinar(data.user.id, data.user.email, metaNome(data.user.user_metadata));
  }

  const nome =
    typeof claims.user_metadata === "object" &&
    claims.user_metadata &&
    "name" in claims.user_metadata &&
    typeof (claims.user_metadata as { name?: unknown }).name === "string"
      ? (claims.user_metadata as { name: string }).name
      : undefined;

  return assinar(claims.sub, email, nome);
}

function metaNome(meta: unknown): string | undefined {
  if (
    typeof meta === "object" &&
    meta &&
    "name" in meta &&
    typeof (meta as { name?: unknown }).name === "string"
  ) {
    return (meta as { name: string }).name;
  }
  return undefined;
}

async function assinar(
  sub: string,
  email: string,
  name: string | undefined,
): Promise<string> {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (!secret || secret === AUTH_SECRET_FRACO || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente, curto demais ou ainda é o placeholder — não dá para assinar o token da API.",
    );
  }

  return new SignJWT({
    email,
    name: name ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}
