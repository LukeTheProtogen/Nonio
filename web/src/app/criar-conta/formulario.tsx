"use client";

import { useActionState, useEffect, useState } from "react";
import { criarConta, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario } from "@/components/acesso/estilos";
import { Campo, CampoTexto, CampoSenha } from "@/components/acesso/campos";

const inicial: ResultadoEntrada = undefined;

export function FormularioCriarConta({ de }: { de: string }) {
  const [estado, acao, pendente] = useActionState(criarConta, inicial);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senhaReset, setSenhaReset] = useState(0);
  const erro = Boolean(estado?.erro);

  useEffect(() => {
    if (estado?.erro) setSenhaReset((n) => n + 1);
  }, [estado]);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="de" value={de} />
      <Campo rotulo="Como quer ser chamado">
        <CampoTexto
          nome="nome"
          autoComplete="given-name"
          placeholder="Guilherme"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </Campo>

      <Campo rotulo="E-mail" ajuda="Um e-mail, uma conta. Se já entra com Google, não crie senha neste endereço.">
        <CampoTexto
          nome="email"
          tipo="email"
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Campo>

      <CampoSenha erro={erro} resetKey={senhaReset} />

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
