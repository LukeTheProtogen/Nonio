/**
 * Enquadramento regulatório — texto e vocabulário num lugar só.
 *
 * Isto não é decoração de rodapé. O produto opera no degrau 0 da escada
 * regulatória: ferramenta de pesquisa e probabilidade, sem registro na CVM.
 * O que mantém esse degrau aberto não é a tecnologia — é a redação da
 * interface. Uma lista ordenada por probabilidade, rotulada como
 * probabilidade, é dado; a mesma lista rotulada como "melhores oportunidades"
 * é recomendação. O rótulo faz o trabalho regulatório.
 *
 * Centralizar aqui serve a três coisas: o texto não diverge entre telas,
 * a revisão é de um arquivo só, e o verificador de linguagem
 * (`npm run conformidade`) tem uma fonte de verdade.
 */

export const DISCLAIMER_CURTO =
  "Ferramenta de pesquisa e probabilidade. Não é recomendação de investimento.";

export const DISCLAIMER_MEDIO =
  "Ferramenta de pesquisa e probabilidade sobre dados públicos. " +
  "Não é recomendação de investimento, análise ou consultoria de valores " +
  "mobiliários — Resoluções CVM 19 e 20.";

export const DISCLAIMER_LONGO = [
  "O Nônio é uma ferramenta de pesquisa. Publicamos probabilidades, faixas e " +
    "cenários calculados sobre dados públicos do Banco Central, da CVM e do " +
    "IBGE, com a fonte de cada afirmação rastreável até o documento original.",
  "Não indicamos compra nem venda de nenhum ativo, não emitimos preço-alvo e " +
    "não prestamos consultoria personalizada. Essas atividades são reguladas " +
    "pelas Resoluções CVM 19 (consultoria) e 20 (análise de valores " +
    "mobiliários) e exigem registro que não possuímos.",
  "Não distribuímos produto financeiro e não recebemos remuneração por ordem " +
    "enviada, por volume negociado ou por resultado de quem usa a ferramenta.",
  "As probabilidades implícitas no consenso são leitura nossa da dispersão " +
    "que o Banco Central publica — o Boletim Focus divulga mediana e desvio, " +
    "não probabilidade. O histórico de calibração é histórico e não garante " +
    "desempenho futuro.",
  "Decisões de investimento são de responsabilidade de quem as toma.",
] as const;

/** A resposta ensaiada para a pergunta que sempre vem. */
export const RESPOSTA_ENSAIADA =
  "Não. Não indicamos compra nem venda e não distribuímos produto financeiro. " +
  "Entregamos probabilidade com fonte rastreável, como ferramenta de pesquisa, " +
  "e o enquadramento das Resoluções CVM 19 e 20 está no rodapé de cada tela.";

export const FONTES_PUBLICAS = [
  { rotulo: "Banco Central — Expectativas de Mercado (Focus)", url: "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata" },
  { rotulo: "Banco Central — Séries Temporais (SGS)", url: "https://api.bcb.gov.br/dados/serie" },
  { rotulo: "CVM — Dados Abertos", url: "https://dados.cvm.gov.br/dados/CIA_ABERTA" },
] as const;

/**
 * Vocabulário que sobe o produto para o degrau 2 (análise, Res. CVM 20).
 * Usado pelo verificador em `scripts/conformidade.mjs`.
 */
export const TERMOS_PROIBIDOS = [
  "recomendamos", "recomendação de compra", "recomendação de venda",
  "compre ", "venda agora", "compre agora", "hora de comprar", "hora de vender",
  "ação atrativa", "ativo atrativo", "está atrativa", "está barata", "está cara",
  "preço-alvo", "preço alvo", "target price",
  "melhores ações", "melhores oportunidades", "top ações", "as 5 melhores",
  "oportunidade de compra", "vai subir", "vai cair", "vai valorizar",
  "retorno garantido", "lucro certo", "ganho garantido",
] as const;

/** O que pode ser dito no degrau 0. Serve de referência para quem escreve UI. */
export const TERMOS_PERMITIDOS = [
  "probabilidade de", "faixa de", "intervalo de",
  "o consenso está em", "nosso modelo está em", "divergência do consenso",
  "cenário condicional", "se a Selic ficar",
  "quando dissemos X%, aconteceu Y%", "calibração",
] as const;
