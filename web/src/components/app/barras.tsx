import { num } from "@/lib/formato";

/**
 * Duas barras que a interface usa muito, no mesmo idioma dos outros gráficos:
 * SVG à mão, sem biblioteca, renderizadas no servidor.
 *
 * `BarrasErro` compara concorrentes num mesmo eixo.
 * `BarrasDivergentes` mostra sinal e magnitude em torno do zero.
 */

// -------------------------------------------------------------- erro por série

export type SerieBarra = { rotulo: string; valor: number; cor: string };

/**
 * Erro por horizonte, uma barra por método.
 *
 * O eixo começa em zero, sempre. Barra cortada embaixo é a forma clássica de
 * fazer uma diferença de 5% parecer o dobro, e numa tela sobre honestidade de
 * número isso não pode acontecer nem por descuido.
 */
export function BarrasErro({
  grupos,
  unidade = "p.p.",
}: {
  grupos: { rotulo: string; series: SerieBarra[] }[];
  unidade?: string;
}) {
  const maximo = Math.max(...grupos.flatMap((g) => g.series.map((s) => s.valor)));
  const teto = maximo * 1.15 || 1;

  return (
    <div className="flex flex-col gap-3.5">
      {grupos.map((g) => (
        <div key={g.rotulo} className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-4">
          <span className="font-mono text-[12.5px] text-ink-soft tabular">{g.rotulo}</span>
          <div className="flex flex-col gap-1">
            {g.series.map((s) => (
              <div key={s.rotulo} className="flex items-center gap-3">
                <div className="h-3.5 min-w-0 flex-1 bg-surface-3">
                  <div
                    className="h-full"
                    style={{ width: `${(s.valor / teto) * 100}%`, background: s.cor }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[12.5px] tabular">
                  {num(s.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="pl-[84px] font-mono text-[11px] text-ink-soft">em {unidade}</p>
    </div>
  );
}

// ------------------------------------------------------------------ divergente

/**
 * Barras em torno do zero: sensibilidade a juros, câmbio e petróleo.
 *
 * O zero fica no meio e é a única linha desenhada. Positivo e negativo usam a
 * paleta semântica, nunca petróleo — petróleo é o modelo, e aqui não há modelo
 * nenhum, só uma regressão descritiva.
 */
export function BarrasDivergentes({
  itens,
  sufixo = "%",
}: {
  itens: { rotulo: string; valor: number; nota?: string }[];
  sufixo?: string;
}) {
  const maximo = Math.max(...itens.map((i) => Math.abs(i.valor))) * 1.15 || 1;

  return (
    <div className="flex flex-col gap-3">
      {itens.map((i) => {
        const largura = (Math.abs(i.valor) / maximo) * 50;
        const positivo = i.valor >= 0;

        return (
          <div key={i.rotulo} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
              <span>{i.rotulo}</span>
              <span
                className={`font-mono tabular ${positivo ? "text-positivo" : "text-negativo"}`}
              >
                {positivo ? "+" : "−"}
                {num(Math.abs(i.valor))}
                {sufixo}
              </span>
            </div>

            <div className="relative h-3.5 bg-surface-3">
              <div
                className="absolute inset-y-0"
                style={{
                  left: positivo ? "50%" : `${50 - largura}%`,
                  width: `${largura}%`,
                  background: positivo ? "var(--positivo)" : "var(--negativo)",
                }}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-rule" />
            </div>

            {i.nota ? <p className="text-[12px] text-ink-soft">{i.nota}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
