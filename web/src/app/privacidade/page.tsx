import type { Metadata } from "next";
import { PaginaPublica, Secao, Lista, Nota } from "@/components/marketing/pagina-publica";
import { EMPRESA, VIGENCIA } from "@/mock/empresa";

export const metadata: Metadata = {
  title: "Privacidade",
  description:
    "Quais dados pessoais o Nônio trata, com que base legal, por quanto tempo, e como exercer os seus direitos sob a LGPD.",
};

/**
 * Política de privacidade.
 *
 * Escrita em português comum e na ordem que a pessoa pergunta: o que vocês
 * guardam, por quê, com quem dividem, por quanto tempo, e como eu apago. A
 * ordem dos artigos da LGPD não é a ordem de quem lê.
 *
 * A identificação da empresa vem de `src/mock/empresa.ts` e hoje está em
 * colchetes de propósito. Publicar em domínio público com colchetes na tela é
 * descumprir o art. 41 da LGPD, e é para isso que eles são visíveis.
 */
export default function Privacidade() {
  return (
    <PaginaPublica
      chapeu="Política de privacidade"
      titulo="O que guardamos, e por quê."
      resumo="Tratamos o mínimo necessário para manter a sua conta em pé. Não vendemos dado, não fazemos perfil para anunciante e não cruzamos o seu uso com base de terceiro."
      atualizadoEm={VIGENCIA}
    >
      <Secao numero={1} titulo="Quem trata os seus dados">
        <p>
          O controlador é {EMPRESA.razaoSocial}, inscrita no CNPJ sob o nº {EMPRESA.cnpj}, com
          sede em {EMPRESA.endereco}, {EMPRESA.cidade}.
        </p>
        <p>
          O encarregado pelo tratamento de dados pessoais, na forma do art. 41 da Lei nº
          13.709/2018, é {EMPRESA.encarregado}, alcançável em {EMPRESA.emailPrivacidade}.
        </p>
      </Secao>

      <Secao numero={2} titulo="Que dados coletamos">
        <p>
          Só o que a conta exige para existir e o que o navegador entrega sozinho ao carregar uma
          página.
        </p>
        <Lista
          itens={[
            <>
              <strong className="font-semibold text-ink">Cadastro.</strong> E-mail e senha. A
              senha é guardada como resumo criptográfico, nunca em texto legível, e ninguém aqui
              consegue lê-la.
            </>,
            <>
              <strong className="font-semibold text-ink">Sessão.</strong> Um cookie próprio para
              manter você conectado entre uma página e outra.
            </>,
            <>
              <strong className="font-semibold text-ink">Registro de acesso.</strong> Endereço IP,
              data e hora das requisições, exigidos pelo art. 15 do Marco Civil da Internet.
            </>,
            <>
              <strong className="font-semibold text-ink">Uso do produto.</strong> Quais telas
              foram abertas, para saber o que consertar. Sem identificador de publicidade e sem
              rastreador de terceiro.
            </>,
          ]}
        />
        <p>
          Não pedimos CPF, não pedimos dado de corretora, não pedimos extrato e não pedimos acesso
          à sua carteira. O produto não precisa saber o que você tem para funcionar.
        </p>
      </Secao>

      <Secao numero={3} titulo="Com que base legal">
        <Lista
          itens={[
            "Execução de contrato (art. 7º, V) para cadastro, sessão e entrega do produto.",
            "Cumprimento de obrigação legal (art. 7º, II) para os registros de acesso e para a guarda fiscal de cobrança.",
            "Legítimo interesse (art. 7º, IX) para segurança, prevenção a fraude e melhoria do produto, sempre no mínimo necessário.",
          ]}
        />
        <p>
          Não tratamos dado pessoal sensível, não tratamos dado de criança ou adolescente e não
          tomamos decisão automatizada que produza efeito jurídico sobre você.
        </p>
      </Secao>

      <Secao numero={4} titulo="Com quem compartilhamos">
        <p>
          Com operadores estritamente necessários para o serviço rodar: hospedagem, envio de
          e-mail transacional e, quando houver cobrança, o processador de pagamento. Cada um trata
          apenas o dado necessário à sua função e sob contrato.
        </p>
        <p>
          Não vendemos, não alugamos e não cedemos dado pessoal para fim comercial de terceiro.
          Compartilhamos com autoridade pública somente mediante ordem judicial ou requisição
          legal, e avisamos você sempre que a lei permitir avisar.
        </p>
      </Secao>

      <Secao numero={5} titulo="Cookies">
        <p>
          Usamos um cookie de sessão, necessário para manter você conectado, e nada além disso. Não
          há cookie de publicidade, não há pixel de rede social e não há rastreamento entre sites.
          Por isso não existe banner de consentimento aqui: não há o que consentir.
        </p>
      </Secao>

      <Secao numero={6} titulo="Por quanto tempo guardamos">
        <Lista
          itens={[
            "Dados de cadastro: enquanto a conta existir, e por até seis meses depois do encerramento para atender pedido de reativação e apurar fraude.",
            "Registros de acesso: seis meses, o prazo do art. 15 do Marco Civil.",
            "Documentos fiscais de cobrança: cinco anos, prazo da legislação tributária.",
          ]}
        />
        <p>Encerrado o prazo, o dado é eliminado ou anonimizado de forma irreversível.</p>
      </Secao>

      <Secao numero={7} titulo="Os seus direitos">
        <p>
          O art. 18 da LGPD lhe garante confirmação do tratamento, acesso, correção, anonimização,
          portabilidade, eliminação, informação sobre compartilhamento e revogação do
          consentimento.
        </p>
        <p>
          Peça por {EMPRESA.emailPrivacidade}. Respondemos em até quinze dias. Não cobramos por
          isso, e não pedimos justificativa para você exercer um direito que é seu. Se a resposta
          não resolver, você pode reclamar à Autoridade Nacional de Proteção de Dados.
        </p>
      </Secao>

      <Secao numero={8} titulo="Segurança e incidentes">
        <p>
          Tráfego cifrado ponta a ponta, senha guardada como resumo criptográfico, acesso interno
          restrito a quem precisa e registrado.
        </p>
        <p>
          Se houver incidente com risco relevante aos seus direitos, comunicamos você e a ANPD nos
          termos do art. 48, dizendo o que aconteceu, qual dado foi atingido e o que fazer a
          respeito. Não vamos chamar de indisponibilidade o que for vazamento.
        </p>
      </Secao>

      <Secao numero={9} titulo="Mudanças nesta política">
        <p>
          Mudança relevante é avisada por e-mail com pelo menos trinta dias de antecedência, e a
          data de vigência no topo desta página sempre reflete a versão que está valendo.
        </p>
      </Secao>

      <Nota>
        Esta política descreve o produto como ele funciona hoje, em desenvolvimento e sem cobrança
        ativa. Antes de qualquer publicação em domínio próprio, a identificação da empresa e o
        nome do encarregado precisam sair dos colchetes.
      </Nota>
    </PaginaPublica>
  );
}
