import { readFile } from "node:fs/promises";

/**
 * O molde do cartão de link.
 *
 * Um molde só, um preenchimento por rota. O cartão é a primeira coisa que
 * alguém vê do Nônio — antes da landing, antes de clicar — e por isso usa a
 * mesma paleta e a mesma tipografia do produto: quem chega pelo WhatsApp já viu
 * a marca antes de abrir o site.
 *
 * ═══ AS REGRAS DO FORMATO ═══
 *
 * 1200 × 630 é o tamanho que WhatsApp, Slack, LinkedIn e iMessage entendem sem
 * recortar. Margem de 64 × 60, e NADA essencial nos 24px externos: vários
 * aplicativos cortam a borda para caber no próprio cartão, e o que estiver lá
 * some sem aviso.
 *
 * A borda de 1px não é enfeite. O fundo é claro, e em tema escuro de alguns
 * aplicativos um cartão claro se dissolve no fundo da conversa. A borda é o que
 * diz onde a imagem começa e acaba.
 *
 * Sem foto e sem gradiente, de propósito. O cartão carrega número, e número
 * sobre foto vira decoração de banco.
 *
 * ═══ SATORI, E O QUE ELE NÃO FAZ ═══
 *
 * O `ImageResponse` desenha com satori, que NÃO é um navegador:
 *
 *   · só flexbox, nada de grid;
 *   · todo elemento com mais de um filho precisa de `display: flex` explícito;
 *   · variável CSS não existe — as cores entram como literal, e é por isso que
 *     `COR` abaixo repete os valores de `globals.css` em vez de lê-los;
 *   · fonte precisa ser TTF, OTF ou WOFF. WOFF2 NÃO carrega, e é justamente o
 *     que o `next/font` guarda — daí os arquivos em `ativos/`.
 *
 * ═══ POR QUE OS ARQUIVOS VÊM POR `import.meta.url` ═══
 *
 * `process.cwd()` acha os arquivos na sua máquina e pode não achar no
 * serverless, onde só vai para o pacote o que o rastreador do Next enxergou.
 * `new URL(..., import.meta.url)` é justamente o que ele enxerga. Fonte que
 * falha em produção não quebra o cartão com erro: ele sai desenhado com a
 * fonte errada, e ninguém percebe.
 */

export const TAMANHO = { width: 1200, height: 630 };

/** Espelho literal de `globals.css`. Satori não resolve `var()`. */
export const COR = {
  papel: "#f7f6f1",
  carta: "#ffffff",
  ink: "#232b26",
  inkSoft: "#5e6a62",
  rule: "#ddd9cd",
  ruleSoft: "#e7e3d8",
  superficie: "#f1efe7",
  modelo: "#14544b",
  modeloForte: "#0c3b34",
  modeloLavado: "#e9f0ed",
  salvia: "#9dbaa7",
  consenso: "#ac6f22",
  referencia: "#9aa39a",
  positivo: "#1a6b4c",
  negativo: "#a2382c",
} as const;

/*
  Um `new URL` LITERAL por arquivo, e nunca um template com variável.

  A primeira versão fazia `new URL(`./ativos/${nome}`, import.meta.url)`. O
  rastreador do Next não consegue seguir um caminho que só existe em tempo de
  execução, e o resultado não foi erro de compilação: os seis caminhos passaram
  a apontar para o MESMO arquivo. O cartão morria com "Unsupported OpenType
  signature PNG" — o PNG da marca chegando onde se esperava uma fonte.

  Feio de repetir, e é o preço de o caminho precisar existir em tempo de
  compilação.
*/
const ATIVO = {
  "zilla-slab-600.ttf": new URL("./ativos/zilla-slab-600.ttf", import.meta.url),
  "zilla-slab-700.ttf": new URL("./ativos/zilla-slab-700.ttf", import.meta.url),
  "plex-mono-400.ttf": new URL("./ativos/plex-mono-400.ttf", import.meta.url),
  "plex-mono-500.ttf": new URL("./ativos/plex-mono-500.ttf", import.meta.url),
  "plex-sans-400.ttf": new URL("./ativos/plex-sans-400.ttf", import.meta.url),
  "plex-sans-600.ttf": new URL("./ativos/plex-sans-600.ttf", import.meta.url),
  "marca.png": new URL("./ativos/marca.png", import.meta.url),
} as const;

async function ler(nome: keyof typeof ATIVO): Promise<Buffer> {
  return readFile(ATIVO[nome]);
}

type Fonte = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
};

/**
 * As fontes do cartão.
 *
 * Zilla Slab no título e IBM Plex no resto, iguais às do produto. Com fonte de
 * sistema o cartão continua saindo, só que com outra voz — e a voz é metade do
 * que uma marca é.
 */
export async function fontes(): Promise<Fonte[]> {
  const [zilla600, zilla700, mono400, mono500, sans400, sans600] = await Promise.all([
    ler("zilla-slab-600.ttf"),
    ler("zilla-slab-700.ttf"),
    ler("plex-mono-400.ttf"),
    ler("plex-mono-500.ttf"),
    ler("plex-sans-400.ttf"),
    ler("plex-sans-600.ttf"),
  ]);

  return [
    { name: "Zilla", data: zilla600, weight: 600, style: "normal" },
    { name: "Zilla", data: zilla700, weight: 700, style: "normal" },
    { name: "Mono", data: mono400, weight: 400, style: "normal" },
    { name: "Mono", data: mono500, weight: 500, style: "normal" },
    { name: "Sans", data: sans400, weight: 400, style: "normal" },
    { name: "Sans", data: sans600, weight: 600, style: "normal" },
  ];
}

/** A marca embutida, pelo mesmo motivo das fontes. */
export async function marca(): Promise<string> {
  const png = await ler("marca.png");
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * O molde.
 *
 * `etiqueta` é a seção, em maiúsculas à direita: diz de qual tela do produto o
 * link veio antes de a pessoa ler o título. `figura` é o miolo, e é opcional —
 * cartão sem número nenhum é melhor vazio do que preenchido com enfeite.
 */
export function Cartao({
  etiqueta,
  titulo,
  apoio,
  figura,
  rodape,
  marcaSrc,
}: {
  etiqueta: string;
  titulo: string;
  apoio?: string;
  figura?: React.ReactNode;
  rodape: string;
  marcaSrc: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: COR.papel,
        border: `1px solid ${COR.rule}`,
        padding: "64px 60px",
        fontFamily: "Sans",
      }}
    >
      {/* cabeçalho: marca sempre no mesmo lugar, seção do outro lado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={marcaSrc} width={46} height={46} alt="" />
          <span style={{ fontFamily: "Zilla", fontWeight: 700, fontSize: 34, color: COR.ink, letterSpacing: -0.8 }}>
            Nônio
          </span>
        </div>
        <span
          style={{
            fontFamily: "Mono",
            fontWeight: 500,
            fontSize: 19,
            letterSpacing: 2.4,
            color: COR.referencia,
          }}
        >
          {etiqueta.toUpperCase()}
        </span>
      </div>

      {/* miolo */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", paddingTop: 30, paddingBottom: 30 }}>
        <span
          style={{
            fontFamily: "Zilla",
            fontWeight: 600,
            fontSize: 56,
            lineHeight: 1.1,
            letterSpacing: -1.4,
            color: COR.ink,
            /* Se estourar, CORTA a frase. Reduzir o corpo do título para caber
               mais texto é o começo do cartão que ninguém lê no celular. */
            display: "block",
            lineClamp: 2,
          }}
        >
          {titulo}
        </span>

        {apoio ? (
          <span style={{ fontSize: 27, lineHeight: 1.4, color: COR.inkSoft, paddingTop: 18, lineClamp: 2 }}>
            {apoio}
          </span>
        ) : null}

        {figura ? <div style={{ display: "flex", paddingTop: 34 }}>{figura}</div> : null}
      </div>

      {/* rodapé: de onde veio o número à esquerda, para onde o link leva à direita */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 1, background: COR.rule, marginBottom: 18 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 21, color: COR.inkSoft }}>{rodape}</span>
          <span style={{ fontFamily: "Mono", fontSize: 21, color: COR.modelo }}>nonio.com.br</span>
        </div>
      </div>
    </div>
  );
}
