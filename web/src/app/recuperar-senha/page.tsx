import Link from "next/link";
import type { Metadata } from "next";
import { MolduraAcesso, ItemLateral } from "@/components/acesso/moldura";
import { FormularioRecuperar } from "./formulario";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenha() {
  return (
    <MolduraAcesso
      rodape="O código vale uma vez só e expira em dez minutos."
      lateral={
        <>
          <p className="eyebrow">por que a resposta é sempre igual</p>
          <p className="font-heading text-[23px] font-medium leading-snug">
            Dizemos “se essa conta existir, o código foi enviado” mesmo quando ela não existe.
          </p>
          <div className="flex flex-col">
            <ItemLateral
              titulo="Não confirmamos cadastro"
              texto="Uma tela que responde diferente para e-mail cadastrado vira lista de clientes para quem quiser testar."
            />
            <ItemLateral
              titulo="Vale para o login também"
              texto="Lá o erro nunca diz se foi o e-mail ou a senha, pelo mesmo motivo."
            />
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[34px] font-semibold leading-tight">Recuperar senha</h1>
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            Coloque o e-mail da conta e mandamos um código de seis dígitos para você criar uma nova.
          </p>
        </div>

        <FormularioRecuperar />

        <Link href="/entrar" className="text-[13.5px] text-modelo hover:text-modelo-forte">
          Voltar para o login
        </Link>
      </div>
    </MolduraAcesso>
  );
}
