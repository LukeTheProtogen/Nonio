import type { MetadataRoute } from "next";
import { SITE, ROTAS_PUBLICAS } from "@/lib/site";

/**
 * Sitemap.
 *
 * Só o que é público e vale ser encontrado. Entrar, criar conta e recuperar
 * senha ficam de fora: são passagem, não destino, e não têm o que ranquear.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ROTAS_PUBLICAS.map((r) => ({
    url: `${SITE.url}${r.href}`,
    lastModified: new Date(),
    changeFrequency: r.frequencia,
    priority: r.prioridade,
  }));
}
