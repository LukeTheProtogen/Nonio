import Link from "next/link";
import { DISCLAIMER_MEDIO } from "@/lib/conformidade";

/**
 * Moldura das telas de acesso: formulário à esquerda, argumento à direita.
 *
 * A pilha inteira — marca, formulário e nota de rodapé — vive numa coluna só,
 * centralizada horizontalmente. Antes a marca ficava colada no canto e o
 * formulário começava logo abaixo dela, o que em tela larga deixava tudo órfão
 * num canto com 1500px de branco ao lado.
 *
 * A coluna da direita tem fundo próprio. Sem ele, em tela larga, os dois lados
 * viravam um campo branco único e o formulário parecia solto no meio do nada —
 * o corte precisa ser visível para a coluna da esquerda ler como painel.
 *
 * Ela some abaixo de `lg`: num celular viraria rolagem antes do campo de
 * e-mail, que é o oposto do objetivo da tela.
 */
export function MolduraAcesso({
  children,
  lateral,
  rodape,
}: {
  children: React.ReactNode;
  lateral: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-1">
      <div className="flex flex-1 justify-center px-8 py-12 md:px-20">
        <div className="flex w-full max-w-[560px] flex-col">
          <Link
            href="/"
            className="self-start font-heading text-[22px] font-semibold tracking-tight"
          >
            Nônio
          </Link>

          <div className="my-auto w-full py-14">{children}</div>

          {rodape ? (
            <p className="text-[12.5px] leading-relaxed text-ink-soft">{rodape}</p>
          ) : null}

          {/* Enquadramento em TODA tela de acesso, independente da prop acima:
              a resposta ensaiada promete "no rodapé de cada tela". */}
          <p className="pt-4 text-[12px] leading-relaxed text-ink-soft">{DISCLAIMER_MEDIO}</p>
        </div>
      </div>

      <aside className="hidden w-[40%] max-w-[720px] min-w-[440px] shrink-0 flex-col justify-center gap-7 border-l border-rule bg-surface-3 px-16 py-12 lg:flex">
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-7">{lateral}</div>
      </aside>
    </div>
  );
}

export function ItemLateral({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-rule-soft py-4 first:border-rule">
      <span className="text-[15px] font-semibold">{titulo}</span>
      <span className="text-[13.5px] leading-relaxed text-ink-soft">{texto}</span>
    </div>
  );
}
