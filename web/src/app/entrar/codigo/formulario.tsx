"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { verificarCodigo, type ResultadoEntrada } from "@/lib/sessao";
import { botaoPrimario, caixaCodigo } from "@/components/acesso/estilos";

const inicial: ResultadoEntrada = undefined;
const CASAS = 6;

export function FormularioCodigo({ email, de }: { email: string; de: string }) {
  const [estado, acao, pendente] = useActionState(verificarCodigo, inicial);
  const [digitos, setDigitos] = useState<string[]>(Array(CASAS).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const jaEnviado = useRef("");
  const erro = Boolean(estado?.erro);
  const codigo = digitos.join("");

  /*
   * Envio automático ao completar as seis casas.
   *
   * Precisa ser efeito, e não chamada dentro do onChange: ali o `setDigitos`
   * ainda não renderizou, o campo oculto continua com o valor anterior, e o
   * servidor recebe um código incompleto. O sintoma era colar o código certo e
   * receber "não confere".
   *
   * A trava por referência evita reenviar o mesmo código em laço quando a
   * resposta volta com erro e os dígitos continuam na tela.
   */
  useEffect(() => {
    if (codigo.length === CASAS && jaEnviado.current !== codigo) {
      jaEnviado.current = codigo;
      formRef.current?.requestSubmit();
    }
  }, [codigo]);

  function escrever(i: number, valor: string) {
    const limpo = valor.replace(/\D/g, "");
    if (!limpo) {
      setDigitos((d) => d.map((v, k) => (k === i ? "" : v)));
      return;
    }
    // Colar os seis dígitos preenche todas as caixas e envia sozinho.
    const proximos = [...digitos];
    for (let k = 0; k < limpo.length && i + k < CASAS; k++) proximos[i + k] = limpo[k];
    setDigitos(proximos);

    const destino = Math.min(i + limpo.length, CASAS - 1);
    refs.current[destino]?.focus();
  }

  function tecla(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < CASAS - 1) refs.current[i + 1]?.focus();
  }

  return (
    <form ref={formRef} action={acao} className="flex flex-col gap-6">
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
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CASAS}
            aria-label={`Dígito ${i + 1}`}
            autoFocus={i === 0}
            className={caixaCodigo(erro)}
          />
        ))}
      </div>

      {estado?.erro ? (
        <p role="alert" className="text-[12.5px] text-negativo">
          {estado.erro}
        </p>
      ) : null}

      <button type="submit" disabled={pendente || codigo.length < CASAS} className={botaoPrimario}>
        {pendente ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
