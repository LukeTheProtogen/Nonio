import type { Metadata } from "next";
import Link from "next/link";
import { PaginaPublica, Secao, Lista, Nota } from "@/components/marketing/pagina-publica";
import { EMPRESA, VIGENCIA } from "@/mock/empresa";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "As regras de uso do Nônio: o que o serviço entrega, o que ele explicitamente não é, e o limite de responsabilidade.",
};

/**
 * Termos de uso.
 *
 * A cláusula que mais importa é a 2: dizer, sem rodeio, que isto não é
 * recomendação de investimento nem análise de valores mobiliários na forma das
 * Resoluções CVM 19 e 20. Ficar em cima na página, não enterrado no rodapé.
 *
 * Sem letra miúda e sem caixa alta: caixa alta em contrato de consumo é
 * herança de tradução ruim do direito americano e não vale nada no CDC. O que
 * vale é a cláusula ser legível, e é por isso que ela está no mesmo corpo do
 * resto.
 */
export default function Termos() {
  return (
    <PaginaPublica
      chapeu="Termos de uso"
      titulo="As regras, sem letra miúda."
      resumo="Usar o Nônio significa concordar com o que está abaixo. Está escrito para ser lido, não para ser aceito sem ler."
      atualizadoEm={VIGENCIA}
    >
      <Secao numero={1} titulo="Quem oferece o serviço">
        <p>
          O Nônio é operado por {EMPRESA.razaoSocial}, CNPJ nº {EMPRESA.cnpj}, com sede em{" "}
          {EMPRESA.endereco}, {EMPRESA.cidade}. Estes termos regem o uso do site e do produto.
        </p>
      </Secao>

      <Secao numero={2} titulo="O que o Nônio não é">
        <p>
          Esta é a cláusula mais importante do documento, e por isso está no começo.
        </p>
        <Lista
          itens={[
            "Não é recomendação de investimento. Não indicamos comprar, vender ou manter nenhum ativo.",
            "Não é análise de valores mobiliários na forma da Resolução CVM 20, e não somos analista registrado.",
            "Não é consultoria de valores mobiliários na forma da Resolução CVM 19, e não prestamos orientação personalizada.",
            "Não é distribuição, intermediação ou administração de carteira. Não custodiamos, não executamos ordem e não temos acesso ao seu dinheiro.",
          ]}
        />
        <p>
          O que entregamos é pesquisa sobre dado público: estatística, probabilidade e a fonte de
          cada número. A decisão de investir, e a responsabilidade por ela, é inteiramente sua.
        </p>
      </Secao>

      <Secao numero={3} titulo="Sobre os números">
        <p>
          Os dados vêm do Banco Central, do IBGE, do Tesouro Nacional, da B3 e da CVM. Reproduzimos
          e transformamos o que essas fontes publicam, e podemos errar tanto quanto elas podem
          revisar.
        </p>
        <Lista
          itens={[
            "Probabilidade não é promessa. Um evento de 20% acontece uma vez a cada cinco.",
            "Resultado passado não garante resultado futuro, e nós medimos justamente o quanto o passado errou.",
            "Séries são revisadas pelas fontes. Quando isso acontece, o número da tela muda.",
            "Reconstruções a partir de estatística agregada representam a forma da distribuição, não instituições nomeadas, e a tela diz isso onde ocorre.",
          ]}
        />
      </Secao>

      <Secao numero={4} titulo="Conta e uso">
        <p>
          Você precisa ter dezoito anos ou mais e fornecer informação verdadeira. A conta é
          pessoal: você responde pelo que acontece nela e deve nos avisar se suspeitar de acesso
          indevido.
        </p>
        <p>Não é permitido:</p>
        <Lista
          itens={[
            "Revender, redistribuir ou republicar o conteúdo como se fosse seu.",
            "Raspar o site de forma automatizada fora do que a documentação de API permitir.",
            "Contornar limite de plano, compartilhar credencial ou burlar controle de acesso.",
            "Apresentar o conteúdo a terceiros como recomendação de investimento.",
          ]}
        />
      </Secao>

      <Secao numero={5} titulo="Assinatura e cancelamento">
        <p>
          Planos e valores estão em{" "}
          <Link href="/precos" className="text-modelo underline underline-offset-4 hover:text-modelo-forte">
            preço
          </Link>
          . A assinatura mensal renova automaticamente e pode ser cancelada a qualquer momento
          pela própria conta, com acesso mantido até o fim do período já pago.
        </p>
        <p>
          O art. 49 do Código de Defesa do Consumidor lhe dá sete dias para desistir de contratação
          feita fora do estabelecimento, com devolução integral. Além disso, devolvemos o plano
          anual proporcionalmente se cancelado nos primeiros trinta dias.
        </p>
      </Secao>

      <Secao numero={6} titulo="Disponibilidade">
        <p>
          Fazemos o possível para manter o serviço no ar, mas ele depende de fontes públicas que
          saem do ar, atrasam publicação e mudam formato sem aviso. Manutenção programada é
          avisada quando dá.
        </p>
      </Secao>

      <Secao numero={7} titulo="Limite de responsabilidade">
        <p>
          Não respondemos por decisão de investimento tomada a partir do conteúdo, por perda
          financeira decorrente dela, nem por erro, atraso ou revisão originados nas fontes
          públicas.
        </p>
        <p>
          Nossa responsabilidade por falha comprovada do serviço se limita ao valor que você pagou
          nos últimos doze meses. Isto não afasta a responsabilidade por dolo, culpa grave ou
          qualquer direito que o Código de Defesa do Consumidor torne indisponível.
        </p>
      </Secao>

      <Secao numero={8} titulo="Propriedade intelectual">
        <p>
          Os dados públicos são das fontes originais. O código, o texto, o desenho das telas e as
          transformações que aplicamos são nossos. Citar com atribuição e link é bem-vindo;
          reproduzir integralmente não é.
        </p>
      </Secao>

      <Secao numero={9} titulo="Encerramento">
        <p>
          Você pode encerrar sua conta quando quiser. Podemos encerrar a sua em caso de violação
          destes termos, com aviso prévio sempre que a violação admitir correção.
        </p>
      </Secao>

      <Secao numero={10} titulo="Mudanças, lei e foro">
        <p>
          Mudança relevante é avisada por e-mail com trinta dias de antecedência. Continuar usando
          depois disso significa aceitar a nova versão.
        </p>
        <p>
          Aplica-se a lei brasileira. O foro é o do seu domicílio, como manda o Código de Defesa do
          Consumidor.
        </p>
      </Secao>

      <Nota>
        Documento vigente para o produto em desenvolvimento, sem cobrança ativa. A identificação da
        empresa precisa sair dos colchetes antes de qualquer publicação em domínio próprio, e o
        texto merece revisão de advogado antes da primeira cobrança.
      </Nota>
    </PaginaPublica>
  );
}
