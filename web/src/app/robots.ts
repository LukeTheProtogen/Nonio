import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * robots.txt.
 *
 * As telas atrás de sessão ficam fora do índice não por segredo — o guarda em
 * `src/proxy.ts` é quem protege — mas porque indexar uma rota que sempre
 * responde com redirecionamento para /entrar só suja o resultado de busca.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/macro", "/acoes", "/historico", "/fontes", "/conta", "/api/", "/sair"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
