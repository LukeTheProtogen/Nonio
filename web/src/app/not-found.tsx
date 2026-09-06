import Link from "next/link";
import { EscalaNonio } from "@/components/marketing/escala-nonio";

/**
 * 404.
 *
 * Sem piada e sem ilustração de astronauta. O erro é nosso ou o link estava
 * velho; o que a pessoa precisa é de uma saída, e ela está aqui em dois links.
 */
export default function NaoEncontrada() {
  return (
    <main className="flex w-full flex-1 items-center justify-center px-8 py-20">
      <div className="flex w-full max-w-[560px] flex-col items-start gap-7">
        <p className="eyebrow">Erro 404</p>

        <h1 className="font-heading text-[46px] font-semibold leading-[1.06] tracking-[-0.02em]">
          Esta página não existe.
        </h1>

        <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-soft">
          O endereço pode ter mudado, ou o link que trouxe você até aqui estava errado. Nada foi
          perdido do seu lado.
        </p>

        <div className="w-full max-w-[420px] py-2 opacity-60">
          <EscalaNonio />
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <Link
            href="/"
            className="inline-flex h-12 items-center rounded-md bg-modelo px-6 font-semibold text-white transition-colors hover:bg-modelo-forte"
          >
            Voltar ao início
          </Link>
          <Link href="/macro" className="text-[15px] text-ink-soft underline underline-offset-4 hover:text-ink">
            Ir para o painel
          </Link>
        </div>
      </div>
    </main>
  );
}
