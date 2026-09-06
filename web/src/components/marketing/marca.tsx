/**
 * Marca do Nônio: as duas escalas do paquímetro, reduzidas ao mínimo.
 *
 * Mesma ideia da figura grande da landing — régua principal em cima, escala
 * auxiliar embaixo, deslocada, com o traço que coincide mais alto. Num quadrado
 * de 36px sobra só o gesto, que é exatamente o que uma marca precisa ser.
 */
/**
 * O glifo da marca.
 *
 * Uma folha e a MESMA folha girada 180 graus em torno do centro. A construção
 * é a ideia do produto em geometria: duas escalas idênticas, deslocadas uma da
 * outra, e a leitura nasce de onde elas se encontram. É o paquímetro, sem
 * desenhar um paquímetro.
 *
 * Os dois lobos são o mesmo caminho de propósito — muda um, muda o outro, e a
 * simetria nunca sai do lugar por descuido.
 *
 * `caixa` liga o quadrado arredondado. Ligado no cabeçalho, onde a marca
 * precisa de presença; desligado onde ela é assinatura ao lado de texto, e um
 * bloco de cor sólida pesaria demais.
 */
export function Marca({ tamanho = 36, caixa = true }: { tamanho?: number; caixa?: boolean }) {
  const glifo = (
    <svg
      width={caixa ? tamanho * 0.7 : tamanho}
      height={caixa ? tamanho * 0.7 : tamanho}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <path
        d="M47 8 C33 25 21 38 21 55 C21 72 32 82 47 84 Z"
        fill="currentColor"
      />
      <path
        d="M53 92 C67 75 79 62 79 45 C79 28 68 18 53 16 Z"
        fill="currentColor"
        opacity={0.62}
      />
    </svg>
  );

  if (!caixa) {
    return (
      <span className="inline-flex shrink-0 text-modelo" aria-hidden>
        {glifo}
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-modelo-forte text-white"
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      {glifo}
    </span>
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
