/**
 * Identidade do site na web.
 *
 * A URL canônica precisa vir do ambiente: em pré-visualização cada implantação
 * tem endereço próprio, e sitemap ou imagem de compartilhamento apontando para
 * produção a partir de uma pré-visualização é o clássico link que abre a versão
 * errada.
 */
export const SITE = {
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nonio.com.br").replace(/\/$/, ""),
  nome: "Nônio",
  descricao:
    "Pesquisa e probabilidade sobre dados públicos do Banco Central e da CVM. Não é recomendação de investimento.",
} as const;

type Frequencia = "daily" | "weekly" | "monthly" | "yearly";

/** O que entra no sitemap. Rota de passagem, como /entrar, fica fora. */
export const ROTAS_PUBLICAS: {
  href: string;
  frequencia: Frequencia;
  prioridade: number;
}[] = [
  { href: "/", frequencia: "weekly", prioridade: 1 },
  { href: "/sobre", frequencia: "monthly", prioridade: 0.8 },
  { href: "/precos", frequencia: "monthly", prioridade: 0.8 },
  { href: "/contato", frequencia: "yearly", prioridade: 0.5 },
  { href: "/termos", frequencia: "yearly", prioridade: 0.3 },
  { href: "/privacidade", frequencia: "yearly", prioridade: 0.3 },
];
