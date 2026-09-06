"use client";

import { useActionState } from "react";
import { pedirRecuperacao, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario } from "@/components/acesso/estilos";
import { Campo, CampoTexto } from "@/components/acesso/campos";

const inicial: ResultadoEntrada = undefined;

export function FormularioRecuperar() {
  const [estado, acao, pendente] = useActionState(pedirRecuperacao, inicial);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <Campo rotulo="E-mail" erro={Boolean(estado?.erro)}>
        <CampoTexto nome="email" tipo="email" autoComplete="email" placeholder="voce@empresa.com.br" autoFocus />
      </Campo>

      {estado?.erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" disabled={pendente} className={botaoPrimario}>
        {pendente ? "Enviando…" : "Enviar código"}
      </button>
    </form>
  );
}
