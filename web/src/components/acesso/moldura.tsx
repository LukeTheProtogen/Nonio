import Link from "next/link";

/**
 * Moldura das telas de acesso: formulário à esquerda, argumento à direita.
 *
 * A coluna da direita some abaixo de `lg` — num celular ela viraria rolagem
 * antes do campo de e-mail, que é o oposto do objetivo da tela.
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
      <div className="flex flex-1 flex-col px-8 py-11 md:px-18">
        <Link href="/" className="font-heading text-[21px] font-semibold tracking-tight">
          Nônio
        </Link>

        <div className="my-auto w-full max-w-[400px] py-12">{children}</div>

        {rodape ? (
          <p className="max-w-[52ch] text-xs leading-relaxed text-ink-soft">{rodape}</p>
        ) : null}
      </div>

      <aside className="hidden w-[480px] shrink-0 flex-col justify-center gap-7 border-l border-rule px-12 py-11 lg:flex">
        {lateral}
      </aside>
    </div>
  );
}

export function ItemLateral({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-rule-soft py-3.5 first:border-rule">
      <span className="text-[14.5px] font-semibold">{titulo}</span>
      <span className="text-[13px] leading-relaxed text-ink-soft">{texto}</span>
    </div>
  );
}
