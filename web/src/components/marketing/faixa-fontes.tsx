/**
 * Faixa de procedência, logo abaixo da dobra.
 *
 * É o lugar que Binance e IQ Option ocupam com Forbes, CNBC e Trustpilot: prova
 * de confiança no primeiro rolar. Só que a prova deles é reputação de terceiro,
 * e a nossa é a origem do dado — que é mais forte, porque o leitor pode ir lá
 * conferir sozinho.
 *
 * Sem logotipo. Marca de órgão público num site privado sugere endosso que não
 * existe, e é o tipo de sugestão que a CVM lê como quem não é.
 */
const FONTES = [
  { nome: "Banco Central", detalhe: "Focus, SGS, atas do Copom" },
  { nome: "IBGE", detalhe: "IPCA e séries de preços" },
  { nome: "Tesouro Nacional", detalhe: "curva de juros" },
  { nome: "CVM", detalhe: "informes e fatos relevantes" },
  { nome: "B3", detalhe: "cotações e futuros" },
];

export function FaixaFontes() {
  return (
    <section className="border-y border-rule bg-carta">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-10 py-9 md:px-20">
        <p className="eyebrow">Tudo daqui é público, e conferível por você</p>

        <ul className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {FONTES.map((f, i) => (
            <li
              key={f.nome}
              className="revela flex flex-col gap-0.5"
              style={{ ["--atraso" as string]: `${i * 70}ms` }}
            >
              <span className="font-heading text-[17px] font-semibold leading-tight">
                {f.nome}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-soft">{f.detalhe}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
