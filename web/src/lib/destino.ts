/**
 * Destino pós-login. Só path relativo no mesmo site — bloqueia `//evil.com`.
 */
export function destinoSeguro(bruto: unknown, fallback = "/macro"): string {
  const alvo = String(bruto ?? "");
  if (!alvo.startsWith("/") || alvo.startsWith("//")) return fallback;
  return alvo;
}
