"use client";

import { useState } from "react";
import { entrada } from "./estilos";
import { REGRAS, forca } from "@/lib/senha";

/** Rótulo, campo e, quando há, um link à direita do rótulo. */
export function Campo({
  rotulo,
  children,
  aoLado,
  erro,
  ajuda,
}: {
  rotulo: string;
  children: React.ReactNode;
  aoLado?: React.ReactNode;
  erro?: boolean;
  ajuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`text-[13.5px] font-medium ${erro ? "text-negativo" : ""}`}>{rotulo}</span>
        {aoLado}
      </span>
      {children}
      {ajuda ? <span className="text-xs leading-relaxed text-ink-soft">{ajuda}</span> : null}
    </label>
  );
}

export function CampoTexto({
  nome,
  tipo = "text",
  placeholder,
  autoComplete,
  erro,
  autoFocus,
  maxLength,
  inputMode,
  pattern,
}: {
  nome: string;
  tipo?: string;
  placeholder?: string;
  autoComplete?: string;
  erro?: boolean;
  autoFocus?: boolean;
  /** Campos de formato fixo (código, CPF) precisam limitar na origem. */
  maxLength?: number;
  inputMode?: "numeric" | "text" | "email" | "tel";
  pattern?: string;
}) {
  return (
    <input
      name={nome}
      type={tipo}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      maxLength={maxLength}
      inputMode={inputMode}
      pattern={pattern}
      required
      className={entrada(erro)}
    />
  );
}

/**
 * Campo de senha com as três regras à vista enquanto se digita.
 *
 * Mostrar a lista desde o início, e não só depois do erro, é o que evita a
 * pessoa tentar três vezes até adivinhar o que falta. As regras vêm de
 * lib/senha, as mesmas que o servidor usa.
 */
export function CampoSenha({
  nome = "senha",
  rotulo = "Senha",
  erro,
  comRegras = true,
  autoComplete = "new-password",
  aoLado,
}: {
  nome?: string;
  rotulo?: string;
  erro?: boolean;
  comRegras?: boolean;
  autoComplete?: string;
  aoLado?: React.ReactNode;
}) {
  const [valor, setValor] = useState("");
  const [visivel, setVisivel] = useState(false);
  const nivel = forca(valor);

  return (
    <div className="flex flex-col gap-2">
      <Campo rotulo={rotulo} erro={erro} aoLado={aoLado}>
        <div className="relative">
          <input
            name={nome}
            type={visivel ? "text" : "password"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoComplete={autoComplete}
            required
            className={`${entrada(erro)} pr-13`}
          />
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-0 top-0 flex h-13 w-13 items-center justify-center text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
          >
            <Olho aberto={visivel} />
          </button>
        </div>
      </Campo>

      {comRegras && (
        <>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i < nivel ? "bg-positivo" : "bg-rule-soft"}`}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-1.5">
            {REGRAS.map((r) => {
              const ok = r.cumpre(valor);
              return (
                <li key={r.id} className="flex items-center gap-2 text-xs text-ink-soft">
                  {ok ? <Certo /> : <Circulo />}
                  <span className={ok ? "text-ink" : undefined}>{r.rotulo}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Olho({ aberto }: { aberto: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1.8 10S4.7 4.7 10 4.7 18.2 10 18.2 10 15.3 15.3 10 15.3 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
      {!aberto && <path d="M3.5 3.5 16.5 16.5" />}
    </svg>
  );
}

function Certo() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--positivo)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  );
}

function Circulo() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--referencia)" strokeWidth={2} className="shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}
