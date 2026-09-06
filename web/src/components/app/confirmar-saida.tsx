"use client";

import { useRef } from "react";
import { sair } from "@/lib/sessao";

/**
 * Confirmação antes de encerrar a sessão.
 *
 * Sair é barato de desfazer — basta entrar de novo — mas caro no meio de uma
 * leitura: quem estava comparando papéis perde a tela, os filtros e o lugar. O
 * diálogo custa um clique e evita esse tipo de perda.
 *
 * `<dialog>` NATIVO, não uma div posicionada.
 *
 * O elemento traz de graça três coisas que uma div exige escrever à mão e que
 * quase sempre saem erradas: o foco fica preso dentro do diálogo enquanto ele
 * está aberto, Esc fecha, e o resto da página vira inerte para leitor de tela.
 * O `::backdrop` também é do navegador, e é onde mora o desfoque.
 *
 * "Não" é o botão em foco ao abrir. Numa pergunta destrutiva, o Enter distraído
 * tem que cair na opção que não destrói nada.
 */
export function ConfirmarSaida({
  children,
  className,
}: {
  children: React.ReactNode;
  /**
   * O gatilho aparece em dois lugares com pesos diferentes: um "Sair" discreto
   * no pé da barra lateral e um botão de tamanho normal na tela de conta. O
   * estilo vem de fora para o diálogo ser um só; o padrão é o discreto.
   */
  className?: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          className ??
          "cursor-pointer rounded-sm px-1.5 py-1 text-[11px] text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
        }
      >
        {children}
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-saida"
        /*
          `m-auto` centraliza: o padrão do <dialog> é colar no topo. E o
          backdrop-blur vive no `backdrop:` — a tela de trás continua visível,
          só desfocada, o que mantém a noção de que nada foi perdido ainda.
        */
        className="m-auto w-[min(400px,calc(100vw-2rem))] rounded-xl border border-rule bg-carta p-0 text-ink shadow-[0_24px_64px_-16px_rgb(35_43_38/0.3)] backdrop:bg-ink/25 backdrop:backdrop-blur-[3px]"
      >
        <div className="flex flex-col gap-5 p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 id="titulo-saida" className="t-sub">
              Você realmente deseja sair?
            </h2>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              aria-label="Fechar"
              className="-mt-1 -mr-1.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" aria-hidden>
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>

          <p className="t-rotulo text-ink-soft">
            Nada do que você viu se perde. É só entrar de novo com o mesmo e-mail.
          </p>

          <div className="flex justify-end gap-2.5 pt-1">
            {/*
              `autoFocus` no "Não": numa pergunta destrutiva, o Enter distraído
              tem que cair na opção que não destrói nada.
            */}
            <button
              type="button"
              autoFocus
              onClick={() => dialogo.current?.close()}
              className="inline-flex h-10 cursor-pointer items-center rounded-md border border-rule px-5 text-[14px] font-medium transition-colors hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
            >
              Não
            </button>

            {/*
              Sair continua sendo POST via ação de servidor, dentro do diálogo:
              um GET que encerra sessão é derrubado pelo pré-carregamento do
              próprio navegador.
            */}
            <form action={sair}>
              <button
                type="submit"
                className="inline-flex h-10 cursor-pointer items-center rounded-md bg-modelo px-5 text-[14px] font-semibold text-white transition-colors hover:bg-modelo-forte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
              >
                Sim, sair
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
