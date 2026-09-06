"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { verificarCodigo, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario, caixaCodigo } from "@/components/acesso/estilos";
import { CASAS, apagar, completo, preencher, proximoFoco, vazio } from "./digitos";

const inicial: ResultadoEntrada = undefined;

export function FormularioCodigo({ email, de }: { email: string; de: string }) {
  const [estado, acao, pendente] = useActionState(verificarCodigo, inicial);
  const [digitos, setDigitos] = useState(vazio);
  const [tocado, setTocado] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const ultimoEnviado = useRef("");

  const codigo = digitos.join("");
  const cheio = completo(digitos);
  // O erro some assim que a pessoa mexe: manter o vermelho enquanto ela corrige
  // faz parecer que a correção não surtiu efeito.
  const erro = Boolean(estado?.erro) && !tocado;

  /*
   * Envio automático ao completar as seis casas — comportamento esperado de
   * campo de código. A trava por referência impede reenviar o MESMO código em
   * laço quando a resposta volta com erro e os dígitos continuam na tela.
   *
   * O botão continua funcionando de forma independente: ele nunca fica
   * desabilitado com o código completo, então clicar sempre reenvia.
   */
  useEffect(() => {
    if (cheio && !pendente && ultimoEnviado.current !== codigo) {
      ultimoEnviado.current = codigo;
      formRef.current?.requestSubmit();
    }
  }, [codigo, cheio, pendente]);

  function escrever(i: number, valor: string) {
    // Só o último caractere: cada caixa guarda UM dígito. Colar tem tratador
    // próprio, porque maxLength=1 faria o navegador truncar a colagem.
    const texto = valor.slice(-1);
    setDigitos((d) => preencher(d, i, texto));
    setTocado(true);
    refs.current[proximoFoco(i, texto)]?.focus();
  }

  function colar(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const texto = e.clipboardData.getData("text");
    if (!/\d/.test(texto)) return;
    e.preventDefault();
    setDigitos((d) => preencher(d, i, texto));
    setTocado(true);
    refs.current[proximoFoco(i, texto)]?.focus();
  }

  function tecla(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setDigitos((d) => {
        const { estado: proximo, foco } = apagar(d, i);
        refs.current[foco]?.focus();
        return proximo;
      });
      setTocado(true);
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < CASAS - 1) refs.current[i + 1]?.focus();
  }

  return (
    <form
      ref={formRef}
      action={acao}
      onSubmit={() => setTocado(false)}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="de" value={de} />
      <input type="hidden" name="codigo" value={codigo} />

      <div className="flex gap-2" role="group" aria-label="Código de seis dígitos">
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => escrever(i, e.target.value)}
            onKeyDown={(e) => tecla(i, e)}
            onPaste={(e) => colar(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Dígito ${i + 1}`}
            autoFocus={i === 0}
            className={caixaCodigo(erro)}
          />
        ))}
      </div>

      {erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado?.erro}
        </p>
      ) : null}

      {/* Nunca desabilitado com o código completo — era isso que fazia o clique
          em "Entrar" parecer não ter efeito. */}
      <button type="submit" disabled={pendente || !cheio} className={botaoPrimario}>
        {pendente ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
