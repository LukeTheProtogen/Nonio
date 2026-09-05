import type { Metadata } from "next";
import { MolduraAcesso, ItemLateral } from "@/components/acesso/moldura";
import { FormularioRedefinir } from "./formulario";

export const metadata: Metadata = { title: "Nova senha" };

export default async function RedefinirSenha({ searchParams }: PageProps<"/redefinir-senha">) {
  const { email } = await searchParams;
  const endereco = typeof email === "string" ? email : "";

  return (
    <MolduraAcesso
      rodape="Trocar a senha encerra as outras sessões e manda um e-mail avisando. Se não foi você, o aviso traz o link para bloquear a conta."
      lateral={
        <>
          <p className="eyebrow">depois de salvar</p>
          <div className="flex flex-col">
            <ItemLateral
              titulo="As outras sessões caem"
              texto="Quem estiver logado em outro aparelho é desconectado na hora."
            />
            <ItemLateral
              titulo="Um e-mail avisa"
              texto="Com o link para bloquear a conta, caso a troca não tenha sido você."
            />
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[42px] font-semibold leading-[1.1]">Criar nova senha</h1>
          <p className="text-[16px] leading-relaxed text-ink-soft">
            Se a conta existir, o código chegou em{" "}
            <span className="font-mono text-ink">{endereco || "seu e-mail"}</span>.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-atencao-borda bg-atencao-fundo px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--atencao)" strokeWidth={1.7} strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden>
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6v4.5M10 13.6v.1" />
          </svg>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold">Ambiente de desenvolvimento</span>
            <span className="text-[13px] leading-normal text-ink-soft">
              O envio de e-mail ainda não existe. Use{" "}
              <span className="font-mono text-ink">000000</span> como código.
            </span>
          </div>
        </div>

        <FormularioRedefinir email={endereco} />
      </div>
    </MolduraAcesso>
  );
}
