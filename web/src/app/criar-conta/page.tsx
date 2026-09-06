import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MolduraAcesso } from "@/components/acesso/moldura";
import { FormularioCriarConta } from "./formulario";
import { sessaoAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Criar conta" };

const NAO_PEDIMOS = [
  "CPF ou documento",
  "Cartão de crédito, para começar",
  "Senha de banco ou de corretora",
  "Seu extrato ou sua carteira",
  "Acesso a nenhuma conta sua",
];

export default async function CriarConta({ searchParams }: PageProps<"/criar-conta">) {
  const { de } = await searchParams;
  const destino = typeof de === "string" && de.startsWith("/") ? de : "/macro";

  if (await sessaoAtual()) redirect(destino);

  return (
    <MolduraAcesso
      rodape={
        <>
          Ao criar a conta você concorda com os{" "}
          <Link href="/termos" className="text-modelo hover:text-modelo-forte">termos</Link> e a{" "}
          <Link href="/privacidade" className="text-modelo hover:text-modelo-forte">
            política de privacidade
          </Link>
          . Você pode apagar a conta e tudo que escreveu a qualquer momento, em uma tela.
        </>
      }
      lateral={
        <>
          <p className="eyebrow">o que não vamos pedir</p>
          <ul className="flex flex-col gap-3.5">
            {NAO_PEDIMOS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-base">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--negativo)" strokeWidth={1.8} strokeLinecap="round" className="shrink-0" aria-hidden>
                  <path d="M5 5 15 15M15 5 5 15" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <p className="border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-soft">
            Não é promessa de marketing: é o que a arquitetura permite, porque não somos corretora
            e não custodiamos nada. Se um dia precisarmos de algo dessa lista, vai ser opcional,
            com o motivo escrito na tela.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[42px] font-semibold leading-[1.1]">Criar conta</h1>
          <p className="text-[16px] leading-relaxed text-ink-soft">
            Leva um minuto. Sem cartão e sem CPF.
          </p>
        </div>

        <FormularioCriarConta de={destino} />

        <p className="text-[13.5px] text-ink-soft">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-modelo hover:text-modelo-forte">
            Entrar
          </Link>
        </p>
      </div>
    </MolduraAcesso>
  );
}
