"use client";

import { useActionState } from "react";
import { redefinirSenha, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario } from "@/components/acesso/estilos";
import { CampoSenha } from "@/components/acesso/campos";

const inicial: ResultadoEntrada = undefined;

export function FormularioRedefinir({ email }: { email: string }) {
  const [estado, acao, pendente] = useActionState(redefinirSenha, inicial);
  const erro = Boolean(estado?.erro);

  return (
    <form action={acao} className="flex flex-col gap-5">
      <input type="hidden" name="email" value={email} />

      <p className="text-[13px] leading-relaxed text-ink-soft">
        Abra o link do e-mail de recuperação neste mesmo navegador. Depois escolha a senha nova.
      </p>

      <CampoSenha nome="senha" rotulo="Nova senha" erro={erro} />
      <CampoSenha nome="repetida" rotulo="Repita a nova senha" erro={erro} comRegras={false} />

      {estado?.erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" disabled={pendente} className={botaoPrimario}>
        {pendente ? "Salvando…" : "Salvar e entrar"}
      </button>
    </form>
  );
}
