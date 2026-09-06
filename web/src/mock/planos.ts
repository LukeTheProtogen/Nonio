/**
 * Planos — MOCK. Ver `src/mock/README.md`.
 *
 * Não há cobrança implementada, nem gateway, nem contrato. Os valores são uma
 * hipótese de posicionamento, e a página diz isso na tela em vez de esconder.
 *
 * Trocar por dado real assim que existir um produto de assinatura de verdade;
 * até lá, mudar preço aqui não tem consequência para ninguém.
 */

export type Plano = {
  slug: string;
  nome: string;
  para: string;
  /** Em reais por mês. Zero é o plano aberto. */
  mensal: number;
  recomendado: boolean;
  inclui: string[];
};

export const PLANOS: Plano[] = [
  {
    slug: "leitura",
    nome: "Leitura",
    para: "Para acompanhar o consenso sem se aprofundar.",
    mensal: 0,
    recomendado: false,
    inclui: [
      "Painel macro com os quatro indicadores",
      "Distribuição do Focus da semana",
      "Atualização semanal",
    ],
  },
  {
    slug: "pesquisa",
    nome: "Pesquisa",
    para: "Para quem decide com o número na mão.",
    mensal: 79,
    recomendado: true,
    inclui: [
      "Tudo do Leitura",
      "Universo de ações, com retorno, risco e contexto",
      "Histórico completo das séries e do erro do consenso",
      "Exportação em CSV do que estiver na tela",
      "Atualização diária",
    ],
  },
  {
    slug: "mesa",
    nome: "Mesa",
    para: "Para equipe que precisa do dado dentro de outro sistema.",
    mensal: 349,
    recomendado: false,
    inclui: [
      "Tudo do Pesquisa",
      "Até cinco contas",
      "Acesso por API às mesmas séries do painel",
      "Alerta por e-mail quando o consenso se desloca",
    ],
  },
];
