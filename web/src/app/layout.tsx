import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Zilla_Slab } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";

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
  /*
   * metadataBase é o que transforma "/opengraph-image" em URL absoluta. Sem
   * ela, o cartão de compartilhamento sai com caminho relativo e nenhum
   * aplicativo de mensagem consegue buscar a imagem.
   */
  metadataBase: new URL(SITE.url),
  title: {
    default: "Nônio",
    template: "%s · Nônio",
  },
  description: SITE.descricao,
  applicationName: SITE.nome,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE.nome,
    title: "Nônio — a decisão é sua",
    description: SITE.descricao,
    url: SITE.url,
  },
  twitter: {
    card: "summary_large_image",
    title: "Nônio — a decisão é sua",
    description: SITE.descricao,
  },
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
