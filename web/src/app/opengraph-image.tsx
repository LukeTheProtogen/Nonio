import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Imagem de compartilhamento.
 *
 * Vale para todas as rotas por herança de segmento: um cartão só, com a marca e
 * a tese. Cartão por rota vem quando cada rota tiver o que dizer de próprio —
 * até lá, seis variações do mesmo texto é manutenção sem retorno.
 *
 * Sem fonte externa de propósito. Buscar Zilla Slab aqui adiciona uma chamada
 * de rede na geração da imagem, e quando ela falha o cartão sai quebrado no
 * WhatsApp sem ninguém perceber. A fonte do sistema não quebra.
 */
export const alt = "Nônio — pesquisa e probabilidade sobre dados públicos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/*
  A marca vem do DISCO, embutida como data URI, e não de uma URL.

  O `ImageResponse` roda no servidor e buscaria a imagem pela rede. Numa
  geração de cartão isso significa depender do próprio site estar de pé e
  respondendo — e quando falha, o cartão sai sem a marca no WhatsApp e ninguém
  percebe. É o mesmo motivo de não buscar fonte externa aqui.
*/
const MARCA = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/marca/nonio-caixa.png"),
).toString("base64")}`;

const PETROLEO = "#0a6560";
const TINTA = "#0e1616";
const SUAVE = "#55625f";
const REGUA = "#dee5e5";

export default async function Imagem() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARCA} width={52} height={52} alt="" />
          <span style={{ fontSize: 34, fontWeight: 600, color: TINTA, letterSpacing: -0.5 }}>
            Nônio
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <span
            style={{
              fontSize: 82,
              fontWeight: 600,
              color: TINTA,
              letterSpacing: -2.4,
              lineHeight: 1.02,
            }}
          >
            A decisão é sua.
          </span>
          <span style={{ fontSize: 34, color: PETROLEO, letterSpacing: -0.6 }}>
            Nosso trabalho é não esconder nada dela.
          </span>
        </div>

        {/* A régua de baixo é o nônio: escala principal, escala auxiliar, um traço que coincide. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 0, height: 34 }}>
            {Array.from({ length: 41 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  marginRight: 24,
                  height: i % 5 === 0 ? 34 : 18,
                  background: i === 15 ? PETROLEO : REGUA,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 23,
              color: SUAVE,
              borderTop: `1px solid ${REGUA}`,
              paddingTop: 26,
            }}
          >
            <span>Banco Central · CVM · IBGE · Tesouro · B3</span>
            <span>Não é recomendação de investimento</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
