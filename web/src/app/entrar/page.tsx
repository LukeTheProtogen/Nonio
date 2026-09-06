import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MolduraAcesso, ItemLateral } from "@/components/acesso/moldura";
import { FormularioEntrar } from "./formulario";
import { botaoNeutro, AVISO_EMAIL_UNICO } from "@/components/acesso/estilos";
import { destinoSeguro } from "@/lib/destino";
import { entrarComGoogle, sessaoAtual } from "@/lib/sessao";
import { supabaseConfigured } from "@/lib/supabase/env";
import { authLocalLigada } from "@/lib/auth-local";

export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const { de, erro, error } = await searchParams;
  const destino = destinoSeguro(de);
  const codigo =
    (typeof erro === "string" && erro) || (typeof error === "string" && error) || "";
  const avisoOauth = avisoErroOauth(codigo);
  const googleOk =
    supabaseConfigured() &&
    Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  const local = authLocalLigada();

  if (await sessaoAtual()) redirect(destino);

  return (
    <MolduraAcesso
      rodape={
        <>
          Nunca pedimos senha de banco nem acesso à sua corretora. Ao entrar você concorda com os{" "}
          <Link href="/termos" className="text-modelo hover:text-modelo-forte">termos</Link> e a{" "}
          <Link href="/privacidade" className="text-modelo hover:text-modelo-forte">
            política de privacidade
          </Link>
          .
        </>
      }
      lateral={
        <>
          <p className="eyebrow">o que tem do outro lado</p>
          <p className="font-heading text-[23px] font-medium leading-snug">
            A discordância inteira entre mais de cem instituições, com a fonte de cada número a um
            clique.
          </p>
          <div className="flex flex-col">
            <ItemLateral
              titulo="Probabilidade calibrada"
              texto="Quatro indicadores macro, com a faixa e o histórico de acerto ao lado."
            />
            <ItemLateral
              titulo="Ações com três lentes"
              texto="Retorno contra o CDI, risco e sensibilidade macro, uma pergunta por vez."
            />
            <ItemLateral
              titulo="Seu diário de tese"
              texto="O que você escreveu enquanto estava calmo, com a data e a probabilidade daquele dia."
            />
          </div>
          <p className="border-t border-rule pt-4 text-[12.5px] leading-relaxed text-ink-soft">
            Guardamos e-mail, senha cifrada e o que você escreveu. Não pedimos CPF, não importamos
            extrato e não temos acesso a nenhuma conta sua.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[42px] font-semibold leading-[1.1]">Entrar</h1>
          <p className="text-[16px] leading-relaxed text-ink-soft">Bem-vindo de volta.</p>
          <p className="text-[13px] leading-relaxed text-ink-soft">{AVISO_EMAIL_UNICO}</p>
        </div>

        {avisoOauth ? (
          <p role="alert" className="text-[12.5px] text-negativo">
            {avisoOauth}
          </p>
        ) : null}

        {/*
          O aviso é obrigatório neste modo. Sem ele, alguém digita uma senha
          qualquer, entra, e conclui que a autenticação valida a senha — que é
          exatamente o oposto do que acontece aqui.
        */}
        {local && (
          <p className="rounded-md border border-atencao-borda bg-atencao-fundo px-4 py-3 text-[13px] leading-relaxed text-atencao">
            Modo local de desenvolvimento: qualquer e-mail e senha entram, e nada é
            verificado. Este modo não existe em produção.
          </p>
        )}

        <FormularioEntrar de={destino} />

        <div className="flex items-center gap-3.5 text-xs text-referencia">
          <span className="h-px flex-1 bg-rule" />
          ou
          <span className="h-px flex-1 bg-rule" />
        </div>

        <div className="flex flex-col gap-2.5">
          {googleOk ? (
            <form action={entrarComGoogle}>
              <input type="hidden" name="de" value={destino} />
              <button type="submit" className={botaoNeutro}>
                <IconeGoogle />
                Continuar com Google
              </button>
            </form>
          ) : (
            <>
              <button type="button" disabled className={`${botaoNeutro} opacity-45`}>
                <IconeGoogle />
                Continuar com Google
              </button>
              <p className="text-center text-[12px] text-ink-soft">
                Google: configure AUTH_GOOGLE_ID/SECRET e o redirect
                http://127.0.0.1:54321/auth/v1/callback no Google Cloud (local).
              </p>
            </>
          )}
        </div>

        <p className="text-[13.5px] text-ink-soft">
          Não tem conta?{" "}
          <Link href="/criar-conta" className="font-medium text-modelo hover:text-modelo-forte">
            Criar conta
          </Link>
        </p>
      </div>
    </MolduraAcesso>
  );
}

function avisoErroOauth(codigo: string): string | null {
  if (codigo === "email-senha") {
    return "Este e-mail já tem conta com senha. Entre com e-mail e senha — o Google não abre essa conta.";
  }
  if (codigo === "confirme-email") {
    return "Conta criada. Confirme o e-mail pelo link que mandamos e depois entre.";
  }
  if (
    codigo === "oauth" ||
    codigo === "OAuthAccountNotLinked" ||
    codigo === "OAuthCallback" ||
    codigo === "AccessDenied"
  ) {
    return "Não deu para entrar com Google. Tente de novo ou use e-mail e senha.";
  }
  return null;
}

function IconeGoogle() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
