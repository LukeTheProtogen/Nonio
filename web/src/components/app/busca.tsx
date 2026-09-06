"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Busca por indicador ou ticker.
 *
 * Combobox e não campo de filtro: o resultado LEVA a algum lugar, em vez de
 * esconder linhas de uma tabela. Quem digita "PETR" quer abrir a Petrobras, não
 * ver a tabela encolher.
 *
 * O atalho é `/`, convenção herdada do vi e adotada por GitHub, Slack e Linear.
 * Vale o custo de existir porque quem usa isto todo dia procura papel dezenas
 * de vezes, e tirar a mão do teclado a cada busca é o tipo de atrito que só
 * aparece no uso repetido.
 *
 * A lista vem do servidor por prop, e não de uma chamada a cada tecla: são
 * dezenas de itens, cabem todos, e filtrar em memória responde no mesmo quadro.
 */

export type Alvo = {
  rotulo: string;
  detalhe: string;
  href: string;
  /** Aparece à esquerda, em mono. Ticker ou sigla do indicador. */
  chave: string;
};

export function Busca({ alvos }: { alvos: Alvo[] }) {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const campo = useRef<HTMLInputElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const achados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return alvos.slice(0, 7);

    // Quem começa com o termo vem primeiro: digitar "VA" tem que trazer VALE3
    // antes de qualquer papel que só contenha "va" no meio do nome.
    const comeca: Alvo[] = [];
    const contem: Alvo[] = [];
    for (const a of alvos) {
      const chave = a.chave.toLowerCase();
      const rotulo = a.rotulo.toLowerCase();
      if (chave.startsWith(t) || rotulo.startsWith(t)) comeca.push(a);
      else if (chave.includes(t) || rotulo.includes(t) || a.detalhe.toLowerCase().includes(t))
        contem.push(a);
    }
    return [...comeca, ...contem].slice(0, 7);
  }, [termo, alvos]);

  /* `/` foca a busca, de qualquer lugar da tela. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "/") return;

      // Não sequestrar a barra quando a pessoa está escrevendo em outro campo.
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.isContentEditable === true;
      if (digitando) return;

      e.preventDefault();
      campo.current?.focus();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  /* Clique fora fecha. */
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberto]);

  const ir = (a: Alvo | undefined) => {
    if (!a) return;
    setAberto(false);
    setTermo("");
    campo.current?.blur();
    router.push(a.href);
  };

  return (
    <div ref={caixa} className="relative w-[290px]">
      <div className="flex h-9 items-center gap-2.5 rounded-md border border-rule bg-carta px-3">
        <IconeLupa />
        <input
          ref={campo}
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls="resultados-busca"
          aria-autocomplete="list"
          placeholder="Buscar indicador ou ticker"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
            setDestaque(0);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setDestaque((d) => Math.min(d + 1, achados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setDestaque((d) => Math.max(d - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              ir(achados[destaque]);
            } else if (e.key === "Escape") {
              setAberto(false);
              campo.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-soft"
        />
        {/* A tecla fica à vista: atalho que ninguém descobre não existe. */}
        <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft">
          /
        </kbd>
      </div>

      {aberto && (
        <ul
          id="resultados-busca"
          role="listbox"
          className="absolute top-11 right-0 left-0 z-40 overflow-hidden rounded-md border border-rule bg-carta py-1 shadow-[0_16px_40px_-16px_rgb(35_43_38/0.28)]"
        >
          {achados.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-ink-soft">
              Nada com “{termo}”. O universo tem {alvos.length} itens.
            </li>
          ) : (
            achados.map((a, i) => (
              <li key={a.href} role="option" aria-selected={i === destaque}>
                <button
                  type="button"
                  onMouseEnter={() => setDestaque(i)}
                  onClick={() => ir(a)}
                  className={`flex w-full items-baseline gap-3 px-3 py-2 text-left ${
                    i === destaque ? "bg-modelo-lavado" : ""
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-[13px] font-medium">{a.chave}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{a.rotulo}</span>
                  <span className="shrink-0 text-[11.5px] text-ink-soft">{a.detalhe}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function IconeLupa() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      className="shrink-0 text-ink-soft"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}
