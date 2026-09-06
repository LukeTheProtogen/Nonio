import type { Metadata } from "next";
import { obterFontes } from "@/lib/api/servico";
import { BarraSuperior } from "@/components/app/barra-superior";
import type { Fonte } from "@/lib/api/contratos";
import { dataLonga, hora, idadeEmDias } from "@/lib/formato";

export const metadata: Metadata = { title: "Fontes" };

/**
 * De onde vem cada número, e quando veio.
 *
 * Esta tela mostra o que NÃO foi coletado com o mesmo destaque do que foi. É a
 * diferença entre um produto que diz "atualizado" e um que diz o que está
 * atrasado — e a segunda é a única compatível com o resto do discurso.
 *
 * Nada de bolinha verde sem data ao lado. "Operacional" sem carimbo de hora é
 * a forma mais comum de um painel de estado mentir sem tecnicamente mentir.
 */
export default async function Fontes() {
  const { fontes } = await obterFontes();

  const pendentes = fontes.filter((f) => f.estado !== "ok");

  return (
    <>
      <BarraSuperior titulo="Fontes">
        <span className="font-mono text-xs text-ink-soft">
          {fontes.length - pendentes.length} de {fontes.length} em dia
        </span>
      </BarraSuperior>

      <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-5 py-6 md:px-9 md:py-7">
        <header className="flex flex-col gap-2">
          <h1 className="t-tela">
            Tudo que entra, e quando entrou
          </h1>
          <p className="max-w-[70ch] text-[14.5px] leading-relaxed text-ink-soft">
            Toda fonte é pública e conferível por qualquer pessoa. O que ainda não coletamos
            aparece aqui do mesmo tamanho do que já coletamos.
          </p>
        </header>

        {pendentes.length > 0 && (
          <p className="border-l-2 border-atencao bg-atencao-fundo px-5 py-3.5 text-[13.5px] leading-relaxed">
            {pendentes.length === 1 ? "Uma fonte precisa" : `${pendentes.length} fontes precisam`}{" "}
            de atenção. As telas que dependem delas continuam mostrando o último dado bom, com a
            data à vista.
          </p>
        )}

        <div className="flex flex-col">
          {fontes.map((f) => (
            <Linha key={f.slug} fonte={f} />
          ))}
        </div>

        <p className="border-t border-rule pt-4 text-[12.5px] leading-relaxed text-ink-soft">
          Nenhum dado exclusivo, nenhuma fonte fechada. Se um número da tela não bater com a
          origem, o erro é nosso.
        </p>
      </div>
    </>
  );
}

function Linha({ fonte: f }: { fonte: Fonte }) {
  return (
    <article className="grid grid-cols-1 items-start gap-x-8 gap-y-4 border-b border-rule py-5 first:border-t md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="t-cartao">{f.nome}</h2>
          <span className="text-[13px] text-ink-soft">{f.orgao}</span>
          <Selo estado={f.estado} />
        </div>

        <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-ink-soft">{f.descricao}</p>

        {f.observacao && (
          <p className="max-w-[70ch] text-[13px] leading-relaxed text-atencao">{f.observacao}</p>
        )}

        <a
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 pt-0.5 font-mono text-[12.5px] text-modelo hover:text-modelo-forte"
        >
          {new URL(f.url).hostname}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 2.5H2.5v9h9V9" />
            <path d="M8 2.5h3.5V6" />
            <path d="M11.5 2.5 6.5 7.5" />
          </svg>
        </a>
      </div>

      <dl className="flex shrink-0 flex-row flex-wrap items-start gap-x-8 gap-y-1.5 text-left md:flex-col md:items-end md:gap-1.5 md:text-right">
        <div>
          <dt className="eyebrow">Última coleta</dt>
          <dd className="font-mono text-[13.5px] tabular">
            {f.coletadoEm ? (
              <>
                {dataLonga(f.coletadoEm)}{" "}
                <span className="text-ink-soft">{hora(f.coletadoEm)}</span>
              </>
            ) : (
              <span className="text-referencia">nunca</span>
            )}
          </dd>
        </div>

        {f.coletadoEm && (
          <span className="font-mono text-[11.5px] text-ink-soft tabular">
            há {idadeEmDias(f.coletadoEm)} dias
          </span>
        )}

        <div className="pt-1.5">
          <dt className="eyebrow">Cadência</dt>
          <dd className="text-[12.5px] text-ink-soft">{f.cadencia}</dd>
        </div>

        {f.registros !== null && (
          <div className="pt-1.5">
            <dt className="eyebrow">Registros</dt>
            <dd className="font-mono text-[13.5px] tabular">{f.registros}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}

/**
 * O selo carrega texto, não só cor. Oito por cento dos homens não distinguem
 * verde de vermelho, e um painel de estado que só fala por cor não fala com
 * eles.
 */
function Selo({ estado }: { estado: Fonte["estado"] }) {
  const mapa = {
    ok: { rotulo: "em dia", classe: "border-positivo/30 bg-positivo/8 text-positivo" },
    atrasada: { rotulo: "atrasada", classe: "border-atencao-borda bg-atencao-fundo text-atencao" },
    falhou: { rotulo: "falhou", classe: "border-negativo/30 bg-negativo/8 text-negativo" },
    nao_coletada: { rotulo: "não coletada", classe: "border-rule bg-surface-3 text-ink-soft" },
  } as const;

  const { rotulo, classe } = mapa[estado];

  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${classe}`}>
      {rotulo}
    </span>
  );
}
