import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sair, sessaoAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Sair" };

/**
 * Saída em um clique, com botão em vez de link.
 *
 * Encerrar sessão por GET seria CSRF: bastaria alguém colocar
 * <img src="/sair"> num fórum para derrubar a sessão de quem lesse a página.
 * Não é grave, mas é gratuito de evitar — o formulário faz POST e resolve.
 */
export default async function Sair() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="flex w-full max-w-[380px] flex-col gap-6">
        <Link href="/" className="font-heading text-[21px] font-semibold tracking-tight">
          Nônio
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[30px] font-semibold leading-tight">Sair da conta</h1>
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            Você está entrando como{" "}
            <span className="font-mono text-ink">{sessao.email}</span>. Sair não apaga nada do que
            você escreveu.
          </p>
        </div>

        <form action={sair}>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-modelo px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-modelo-forte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
          >
            Sair
          </button>
        </form>

        <Link href="/macro" className="text-[13.5px] text-modelo hover:text-modelo-forte">
          Voltar para o painel
        </Link>
      </div>
    </div>
  );
}
