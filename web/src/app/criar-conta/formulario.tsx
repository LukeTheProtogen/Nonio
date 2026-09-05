"use client";

import { useActionState } from "react";
import { criarConta, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario } from "@/components/acesso/estilos";
import { Campo, CampoTexto, CampoSenha } from "@/components/acesso/campos";

const inicial: ResultadoEntrada = undefined;

export function FormularioCriarConta({ de }: { de: string }) {
  const [estado, acao, pendente] = useActionState(criarConta, inicial);
  const erro = Boolean(estado?.erro);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="de" value={de} />
      <Campo rotulo="Como quer ser chamado">
        <CampoTexto nome="nome" autoComplete="given-name" placeholder="Guilherme" autoFocus />
      </Campo>

      <Campo rotulo="E-mail" ajuda="É para cá que vai o código de entrada.">
        <CampoTexto nome="email" tipo="email" autoComplete="email" placeholder="voce@empresa.com.br" />
      </Campo>

      <CampoSenha erro={erro} />

      {estado?.erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" disabled={pendente} className={botaoPrimario}>
        {pendente ? "Criando…" : "Criar conta"}
      </button>
    </form>
  );
}
