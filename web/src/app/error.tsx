"use client";

import Link from "next/link";

/**
 * Erro não tratado.
 *
 * O `digest` aparece na tela de propósito: é o único identificador que liga o
 * que a pessoa viu ao que está no log do servidor. Esconder isso transforma
 * "deu erro" numa investigação de meia hora.
 *
 * O texto do erro em si nunca vai para a tela — mensagem de exceção carrega
 * caminho de arquivo, consulta e às vezes dado de outra pessoa.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex w-full flex-1 items-center justify-center px-8 py-20">
      <div className="flex w-full max-w-[560px] flex-col items-start gap-7">
        <p className="eyebrow">Erro inesperado</p>

        <h1 className="font-heading text-[46px] font-semibold leading-[1.06] tracking-[-0.02em]">
          Alguma coisa quebrou aqui.
        </h1>

        <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-soft">
          O problema é do nosso lado, não do seu. Tentar de novo costuma resolver quando a causa
          foi uma fonte pública fora do ar.
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center rounded-md bg-modelo px-6 font-semibold text-white transition-colors hover:bg-modelo-forte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
          >
            Tentar de novo
          </button>
          <Link href="/" className="text-[15px] text-ink-soft underline underline-offset-4 hover:text-ink">
            Voltar ao início
          </Link>
        </div>

        {error.digest ? (
          <p className="border-t border-rule pt-5 text-[13px] leading-relaxed text-ink-soft">
            Se acontecer de novo, mande este código para{" "}
            <a
              href="mailto:contato@nonio.com.br"
              className="text-modelo underline underline-offset-4 hover:text-modelo-forte"
            >
              contato@nonio.com.br
            </a>
            :{" "}
            <span className="font-mono text-ink tabular">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
