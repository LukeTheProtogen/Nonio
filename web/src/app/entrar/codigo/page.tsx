import Link from "next/link";
import type { Metadata } from "next";
import { MolduraAcesso, ItemLateral } from "@/components/acesso/moldura";
import { FormularioCodigo } from "./formulario";

export const metadata: Metadata = { title: "Confirmar entrada" };

export default async function Codigo({ searchParams }: PageProps<"/entrar/codigo">) {
  const { email, de } = await searchParams;
  const endereco = typeof email === "string" ? email : "";
  const destino = typeof de === "string" && de.startsWith("/") ? de : "/macro";

  return (
    <MolduraAcesso
      rodape="O código vale uma vez só e expira em dez minutos."
      lateral={
        <>
          <p className="eyebrow">por que sem link mágico</p>
          <p className="font-heading text-[23px] font-medium leading-snug">
            Um código curto funciona no celular sem trocar de aplicativo, e não deixa um link de
            entrada válido dando sopa na caixa de e-mail.
          </p>
          <div className="flex flex-col">
            <ItemLateral
              titulo="Vale uma vez"
              texto="Pedir outro invalida o anterior, mesmo que ele ainda esteja no prazo."
            />
            <ItemLateral
              titulo="Três erros bastam"
              texto="Depois disso o código morre e é preciso pedir um novo."
            />
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[34px] font-semibold leading-tight">Digite o código</h1>
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            Mandamos seis dígitos para{" "}
            <span className="font-mono text-ink">{mascarar(endereco)}</span>.
          </p>
        </div>

        {/*
          MOCK: o envio de e-mail não existe ainda, então o código é fixo.
          Este aviso desaparece junto com a constante em lib/sessao.ts.
        */}
        <div className="flex items-start gap-3 rounded-lg border border-atencao-borda bg-atencao-fundo px-4 py-3.5">
          <IconeAviso />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold">Ambiente de desenvolvimento</span>
            <span className="text-[13px] leading-normal text-ink-soft">
              O envio de e-mail ainda não existe. Use <span className="font-mono text-ink">000000</span>{" "}
              para entrar.
            </span>
          </div>
        </div>

        <FormularioCodigo email={endereco} de={destino} />

        <div className="flex items-center justify-between gap-3 text-[13px] text-ink-soft">
          <span>Não chegou?</span>
          <Link href="/entrar" className="text-modelo hover:text-modelo-forte">
            Voltar e tentar outro e-mail
          </Link>
        </div>
      </div>
    </MolduraAcesso>
  );
}

/** g•••••@empresa.com.br — confirma o endereço sem expor a caixa inteira. */
function mascarar(email: string): string {
  if (!email.includes("@")) return "seu e-mail";
  const [local, dominio] = email.split("@");
  const visivel = local.slice(0, 1);
  return `${visivel}${"•".repeat(Math.max(local.length - 1, 3))}@${dominio}`;
}

function IconeAviso() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--atencao)" strokeWidth={1.7} strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4.5M10 13.6v.1" />
    </svg>
  );
}
