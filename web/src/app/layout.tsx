import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Zilla_Slab } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

/*
 * Três famílias, sem exceção.
 *
 *   Zilla Slab   título, citação e número de prova
 *   Plex Sans    todo o resto do texto
 *   Plex Mono    qualquer dígito que possa ser comparado com outro dígito
 *
 * O mono é obrigatório em coluna de número: sem tabular-nums as colunas dançam
 * a cada atualização de cotação.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const zilla = Zilla_Slab({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-zilla",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nônio",
    template: "%s · Nônio",
  },
  description:
    "Ferramenta de pesquisa e probabilidade sobre dados públicos do Banco Central e da CVM. Não é recomendação de investimento.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={cn(
        "h-full",
        plexSans.variable,
        plexMono.variable,
        zilla.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
