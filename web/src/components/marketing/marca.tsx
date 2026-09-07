import Image from "next/image";

/**
 * A marca do Nônio.
 *
 * Duas artes, e a escolha entre elas é o que a prop `caixa` decide:
 *
 *   · `caixa` LIGADA  → a versão em ladrilho, com o quadrado verde e a sombra
 *     já na arte. É a do cabeçalho da landing, onde a marca precisa de
 *     presença e enfrenta uma página inteira competindo por atenção.
 *   · `caixa` DESLIGADA → só as duas folhas, fundo transparente. É a de todo o
 *     resto: barra do produto e telas de acesso, onde a marca assina ao lado
 *     do nome e um bloco de cor sólida pesaria demais.
 *
 * ═══ POR QUE PNG, E NÃO SVG ═══
 *
 * A versão anterior era SVG com `fill="currentColor"`, e por isso a marca
 * trocava de cor sozinha conforme o fundo. Estas duas têm gradiente e sombra
 * assados na arte, então NÃO se recolorem: o que está no arquivo é o que
 * aparece. Refazê-las em vetor exigiria o arquivo de origem, e traçar por cima
 * do raster daria uma aproximação, não a marca.
 *
 * Consequência prática, para quem for usar em fundo novo: a folha da versão
 * sem caixa é verde-sálvia e vive bem em off-white e em verde escuro, mas some
 * em fundo claro de baixo contraste. Nesses lugares é a versão em ladrilho que
 * resolve, não uma recoloração — que não existe mais.
 *
 * `sizes` fixo no dobro do lado pedido: a marca nunca passa de 60px na tela, e
 * sem isso o Next serviria o arquivo de 512 para um quadrado de 22.
 */
export function Marca({ tamanho = 36, caixa = true }: { tamanho?: number; caixa?: boolean }) {
  const arte = caixa ? "/marca/nonio-caixa.png" : "/marca/nonio.png";

  return (
    <Image
      src={arte}
      alt=""
      aria-hidden
      width={tamanho}
      height={tamanho}
      /* `priority`: a marca está sempre na primeira dobra, nas três molduras
         que usam este componente. Carregar preguiçoso aqui só entrega um
         buraco no cabeçalho no primeiro quadro. */
      priority
      className="inline-block shrink-0 select-none"
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

/**
 * Link com seta em círculo. Padrão de leitura: o texto diz para onde vai, o
 * círculo diz que é navegação e não botão de ação.
 */
export function LinkSeta({
  href,
  children,
  claro = false,
}: {
  href: string;
  children: React.ReactNode;
  claro?: boolean;
}) {
  const cor = claro ? "text-white" : "text-modelo";
  const borda = claro ? "border-white/40" : "border-modelo/40";
  return (
    <a
      href={href}
      className={`group inline-flex items-center gap-3 text-[15px] font-medium ${cor} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo`}
    >
      {children}
      <span
        className={`inline-flex size-7 items-center justify-center rounded-full border ${borda} transition-transform duration-200 group-hover:translate-x-0.5`}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 7h9M7.5 3l4 4-4 4" />
        </svg>
      </span>
    </a>
  );
}

/**
 * Rótulo de canhoto: duas palavras na goteira esquerda de uma faixa larga,
 * a segunda em peso maior. Ancora a seção sem competir com o título.
 */
export function Canhoto({ acima, abaixo }: { acima: string; abaixo: string }) {
  return (
    <p className="text-[15px] leading-snug text-ink-soft">
      {acima}
      <br />
      <span className="font-semibold text-ink">{abaixo}</span>
    </p>
  );
}
