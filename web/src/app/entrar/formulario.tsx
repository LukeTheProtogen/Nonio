"use client";

import Link from "next/link";
import { useActionState } from "react";
import { pedirCodigo, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario, entrada } from "@/components/acesso/estilos";

const inicial: ResultadoEntrada = undefined;

export function FormularioEntrar({ de }: { de: string }) {
  const [estado, acao, pendente] = useActionState(pedirCodigo, inicial);
  const comErro = Boolean(estado?.erro);

  return (
    <form action={acao} className="flex flex-col gap-5.5">
      <input type="hidden" name="de" value={de} />
      <Campo rotulo="E-mail" erro={comErro}>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com.br"
          className={entrada(comErro)}
        />
      </Campo>

      <Campo
        rotulo="Senha"
        erro={comErro}
        aoLado={
          <Link href="/recuperar-senha" className="text-[12.5px] text-modelo hover:text-modelo-forte">
            Esqueci minha senha
          </Link>
        }
      >
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
          className={entrada(comErro)}
        />
      </Campo>

      {/*
        A mensagem é deliberadamente genérica e não diz qual dos dois campos
        falhou: dizer transformaria a tela num teste de quais e-mails existem.
      */}
      {estado?.erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" disabled={pendente} className={botaoPrimario}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

function Campo({
  rotulo,
  children,
  aoLado,
  erro,
}: {
  rotulo: string;
  children: React.ReactNode;
  aoLado?: React.ReactNode;
  erro?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`text-[13px] font-medium ${erro ? "text-negativo" : ""}`}>{rotulo}</span>
        {aoLado}
      </span>
      {children}
    </label>
  );
}
