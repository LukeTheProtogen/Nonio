import { Cabecalho, Rodape } from "./moldura-publica";
import { sessaoAtual } from "@/lib/sessao";
import { geradoEm } from "@/lib/backtest";

/**
 * Moldura das páginas públicas de texto: sobre, preço, termos, privacidade e
 * contato.
 *
 * Coluna estreita e única. A landing usa a largura inteira porque tem gráfico;
 * texto corrido não tem, e linha de 110 caracteres não se lê — a medida aqui
 * fica perto de 70, que é onde o olho volta sem se perder.
 *
 * O cabeçalho recebe o estado da sessão pelo mesmo caminho da landing. Sem
 * isso, quem já está logado lê "Entrar" numa página de termos, clica, e é
 * desviado para o painel sem entender por quê.
 */
export async function PaginaPublica({
  titulo,
  chapeu,
  resumo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  chapeu: string;
  resumo?: string;
  /** Só nas páginas com efeito jurídico. Documento sem data não vale nada. */
  atualizadoEm?: string;
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();

  return (
    <main className="w-full">
      <Cabecalho logado={Boolean(sessao)} />

      <article className="mx-auto w-full max-w-[820px] px-8 pb-24 pt-16 md:px-10 md:pt-20">
        <p className="eyebrow">{chapeu}</p>
        <h1 className="t-titulo mt-6 text-balance">
          {titulo}
        </h1>
        {resumo ? (
          <p className="t-lead mt-6 max-w-[46ch] text-ink-soft">{resumo}</p>
        ) : null}
        {atualizadoEm ? (
          <p className="mt-7 border-t border-rule pt-4 font-mono text-xs text-ink-soft">
            Em vigor desde {atualizadoEm}
          </p>
        ) : null}

        <div className="mt-12 flex flex-col gap-12">{children}</div>
      </article>

      <Rodape geradoEm={geradoEm} />
    </main>
  );
}

/** Uma seção de texto com título. Numeração só onde a ordem importa. */
export function Secao({
  titulo,
  numero,
  children,
}: {
  titulo: string;
  numero?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="t-sub flex items-baseline gap-3">
        {numero ? (
          <span className="font-mono text-[15px] font-normal text-referencia tabular">
            {String(numero).padStart(2, "0")}
          </span>
        ) : null}
        {titulo}
      </h2>
      <div className="t-corpo flex flex-col gap-4 text-ink-soft">
        {children}
      </div>
    </section>
  );
}

/** Lista de itens curtos. Marcador discreto, sem emoji e sem ícone. */
export function Lista({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-referencia" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Aviso destacado. Petróleo lavado, nunca amarelo de alerta: o que está aqui é
 * limite do produto, não erro do sistema.
 */
export function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l-2 border-modelo bg-modelo-lavado px-5 py-4 text-[15.5px] leading-relaxed text-ink">
      {children}
    </p>
  );
}
