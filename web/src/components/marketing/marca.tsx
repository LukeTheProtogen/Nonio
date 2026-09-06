/**
 * Marca do Nônio: as duas escalas do paquímetro, reduzidas ao mínimo.
 *
 * Mesma ideia da figura grande da landing — régua principal em cima, escala
 * auxiliar embaixo, deslocada, com o traço que coincide mais alto. Num quadrado
 * de 36px sobra só o gesto, que é exatamente o que uma marca precisa ser.
 */
export function Marca({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-modelo"
      style={{ width: tamanho, height: tamanho }}
      aria-hidden
    >
      <svg width={tamanho * 0.62} height={tamanho * 0.62} viewBox="0 0 24 24" fill="none">
        {/* régua principal */}
        <path d="M3 9h18" stroke="white" strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round" />
        {[3, 7.5, 12, 16.5, 21].map((x) => (
          <path
            key={`r${x}`}
            d={`M${x} 9V5.6`}
            stroke="white"
            strokeOpacity={0.55}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}
        {/* escala auxiliar, deslocada */}
        <path d="M6 15h15" stroke="white" strokeWidth={1.4} strokeLinecap="round" />
        {[6, 10, 14, 18].map((x) => (
          <path key={`n${x}`} d={`M${x} 15v3`} stroke="white" strokeWidth={1.4} strokeLinecap="round" />
        ))}
        {/* o traço que coincide */}
        <path d="M14 15v4.6" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </svg>
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
