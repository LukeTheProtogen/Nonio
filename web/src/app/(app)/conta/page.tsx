import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { obterConta } from "@/lib/api/servico";
import { sessaoAtual, sair } from "@/lib/sessao";
import { BarraSuperior } from "@/components/app/barra-superior";
import { dataLonga, hora, idadeEmDias } from "@/lib/formato";

export const metadata: Metadata = { title: "Conta" };

/**
 * Conta.
 *
 * Três coisas que uma tela de conta tem que ter e quase nenhuma tem: onde a
 * conta está aberta, o que fazemos com os dados, e como sair de vez. As duas
 * últimas costumam viver enterradas no rodapé de um documento jurídico.
 *
 * Encerrar a conta é link para o suporte, não botão. Botão que apaga tudo sem
 * backend para apagar nada seria teatro, e teatro numa tela sobre confiança
 * custa mais do que a ausência do botão.
 */
export default async function Conta() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");

  const conta = await obterConta(sessao.nome, sessao.plano);

  return (
    <>
      <BarraSuperior titulo="Conta" mock />

      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-9 py-9">
        <div className="flex w-full max-w-[760px] flex-col gap-9">
          <header className="flex items-center gap-5">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-rule bg-modelo-lavado font-heading text-xl font-semibold text-modelo">
              {conta.nome.charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="font-heading text-[28px] font-semibold leading-tight">{conta.nome}</h1>
              <p className="font-mono text-[13.5px] text-ink-soft">{conta.email}</p>
            </div>
          </header>

          <Bloco titulo="Plano">
            <Par rotulo="Assinatura" valor={conta.plano} />
            <Par rotulo="Conta criada em" valor={dataLonga(conta.criadaEm)} />
            <p className="pt-1 text-[13.5px] leading-relaxed text-ink-soft">
              Não há cobrança ativa: o produto ainda está em desenvolvimento. Quando começar, você
              é avisado antes.{" "}
              <Link href="/precos" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
                Ver planos
              </Link>
              .
            </p>
          </Bloco>

          <Bloco titulo="Onde a conta está aberta">
            <ul className="flex flex-col">
              {conta.sessoes.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-6 border-b border-rule-soft py-3 last:border-0"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-2.5 text-[14.5px]">
                      {s.dispositivo}
                      {s.atual && (
                        <span className="rounded-full border border-modelo/30 bg-modelo-lavado px-2 py-0.5 font-mono text-[10.5px] text-modelo">
                          esta sessão
                        </span>
                      )}
                    </span>
                    <span className="text-[12.5px] text-ink-soft">{s.local}</span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[12.5px] text-ink-soft tabular">
                    {dataLonga(s.ultimoAcesso)} {hora(s.ultimoAcesso)}
                    <br />
                    <span className="text-[11.5px]">
                      {idadeEmDias(s.ultimoAcesso) === 0
                        ? "hoje"
                        : `há ${idadeEmDias(s.ultimoAcesso)} dias`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="pt-1 text-[13px] leading-relaxed text-ink-soft">
              Encerrar as outras sessões vem junto com a autenticação de verdade. Hoje a sessão é
              um cookie neste navegador, e sair já o apaga.
            </p>
          </Bloco>

          <Bloco titulo="Seus dados">
            <p className="text-[14px] leading-relaxed text-ink-soft">
              Guardamos e-mail, senha em resumo criptográfico e registro de acesso. Não pedimos
              CPF, não pedimos dado de corretora e não cruzamos o seu uso com base de terceiro.
            </p>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              O art. 18 da LGPD lhe dá acesso, correção, portabilidade e eliminação. Peça e a
              gente responde em quinze dias, sem cobrar e sem perguntar por quê.
            </p>
            <div className="flex flex-wrap gap-6 pt-1 text-[14px]">
              <Link href="/privacidade" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
                Política de privacidade
              </Link>
              <Link href="/termos" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
                Termos de uso
              </Link>
              <a
                href="mailto:privacidade@nonio.com.br"
                className="text-modelo underline underline-offset-4 hover:text-modelo-forte"
              >
                Pedir meus dados
              </a>
            </div>
          </Bloco>

          <div className="flex flex-wrap items-center justify-between gap-5 border-t border-rule pt-7">
            <form action={sair}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md border border-rule px-5 text-[14.5px] font-medium transition-colors hover:border-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-modelo"
              >
                Sair desta sessão
              </button>
            </form>

            <a
              href="mailto:contato@nonio.com.br?subject=Encerrar%20conta"
              className="text-[13.5px] text-ink-soft underline underline-offset-4 hover:text-negativo"
            >
              Encerrar a conta e apagar meus dados
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-rule pt-6">
      <h2 className="font-heading text-[19px] font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Par({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule-soft py-2.5">
      <span className="text-[14px] text-ink-soft">{rotulo}</span>
      <span className="font-mono text-[14px] tabular">{valor}</span>
    </div>
  );
}
