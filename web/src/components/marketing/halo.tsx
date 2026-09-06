/**
 * Halo ambiente atrás do herói.
 *
 * Duas manchas de sálvia, muito diluídas, respirando devagar. Substitui os
 * doze feixes que corriam no topo antes: feixe é linha, linha perto de gráfico
 * lê como série de dados, e a dobra tinha traço decorativo brigando com traço
 * medido a dez centímetros de distância.
 *
 * Mancha não briga: não tem direção, não tem escala, não pode ser confundida
 * com um valor. E é o único lugar do site onde verde aparece sem significar o
 * nosso modelo — por isso é sálvia e não petróleo.
 *
 * `radial-gradient` em div, não SVG: o navegador compõe isso na GPU e a coisa
 * não custa nada, enquanto blur de SVG repinta a cada quadro.
 */
export function Halo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="respira absolute -top-40 -left-32 size-[820px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--salvia) 55%, transparent) 0%, transparent 62%)",
        }}
      />
      <div
        className="respira absolute -top-24 right-[-12%] size-[680px] rounded-full opacity-45"
        style={{
          animationDelay: "-4.5s",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--modelo) 22%, transparent) 0%, transparent 64%)",
        }}
      />
      {/* Desvanece para o papel, senão a mancha corta reto no fim da seção. */}
      <div
        className="absolute inset-x-0 bottom-0 h-56"
        style={{ background: "linear-gradient(to bottom, transparent, var(--papel))" }}
      />
    </div>
  );
}
