import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPublica, Secao } from "@/components/marketing/pagina-publica";
import { EMPRESA } from "@/mock/empresa";

export const metadata: Metadata = {
  title: "Contato",
  description: "Como falar com quem faz o Nônio: erro em número, dúvida de conta e privacidade.",
};

/**
 * Contato.
 *
 * Sem formulário. Um formulário sem backend é uma caixa que engole a mensagem
 * e devolve "obrigado", e isso é pior que não ter canal nenhum numa página que
 * promete transparência. E-mail direto funciona hoje.
 *
 * Trocar por formulário quando existir rota que de fato entregue a mensagem.
 */
export default function Contato() {
  return (
    <PaginaPublica
      chapeu="Contato"
      titulo="Fale direto com quem faz."
      resumo="Sem central de atendimento e sem robô. As mensagens chegam a quem escreve o código."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <Canal
          titulo="Erro em algum número"
          descricao="Se o valor da tela não bate com a fonte, isso é bug e tem prioridade. Mande o print e o link da página."
          email={EMPRESA.email}
        />
        <Canal
          titulo="Conta, plano e cobrança"
          descricao="Acesso, cancelamento, nota fiscal e uso em equipe."
          email={EMPRESA.email}
        />
        <Canal
          titulo="Privacidade e dados pessoais"
          descricao="Pedidos do art. 18 da LGPD e qualquer assunto do encarregado. Resposta em até quinze dias."
          email={EMPRESA.emailPrivacidade}
        />
        <Canal
          titulo="Imprensa e parceria"
          descricao="Uso dos dados em reportagem, citação e integração."
          email={EMPRESA.email}
        />
      </section>

      <Secao titulo="Antes de escrever">
        <p>
          Boa parte das dúvidas sobre o que o produto é e o que ele não é já está respondida em{" "}
          <Link href="/sobre" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
            sobre
          </Link>{" "}
          e em{" "}
          <Link href="/termos" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
            termos
          </Link>
          .
        </p>
        <p>
          Uma coisa que não podemos responder: se você deve comprar ou vender alguma coisa. Não
          fazemos recomendação de investimento, e isso vale também no e-mail.
        </p>
      </Secao>

      <Secao titulo="Onde estamos">
        <p>
          {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj}
          <br />
          {EMPRESA.endereco}, {EMPRESA.cidade}
        </p>
      </Secao>
    </PaginaPublica>
  );
}

function Canal({
  titulo,
  descricao,
  email,
}: {
  titulo: string;
  descricao: string;
  email: string;
}) {
  return (
    <article className="flex flex-col gap-2.5 rounded-lg border border-rule bg-surface-2 p-6">
      <h2 className="font-heading text-[19px] font-semibold">{titulo}</h2>
      <p className="text-[14.5px] leading-relaxed text-ink-soft">{descricao}</p>
      <a
        href={`mailto:${email}`}
        className="mt-auto pt-1 font-mono text-[14px] text-modelo underline underline-offset-4 hover:text-modelo-forte"
      >
        {email}
      </a>
    </article>
  );
}
