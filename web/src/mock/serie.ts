import { ACOES } from "./acoes";

/**
 * Série de preços e fatos relevantes por papel — MOCK. Ver `README.md`.
 *
 * O caminho é gerado, não copiado da B3. Duas regras o prendem ao resto:
 *
 *   1. Termina exatamente no retorno de doze meses que a tabela mostra.
 *   2. Tem a volatilidade anual que a tabela mostra.
 *
 * E a pior queda e os dias até o pico saem MEDIDOS deste caminho, não de um
 * campo separado. Se fossem dois números independentes, o gráfico e a tabela
 * acabariam contando histórias diferentes sobre o mesmo papel — que é
 * exatamente o defeito que este produto existe para não ter.
 *
 * A semente vem do ticker: a mesma ação desenha a mesma linha em toda
 * renderização, em todo servidor, para sempre.
 */

const PREGOES = 252;

/** PRNG determinístico. xorshift32 basta: não é criptografia, é desenho. */
function gerador(semente: number) {
  let s = semente || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function sementeDe(ticker: string): number {
  let h = 2166136261;
  for (const c of ticker) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Ponto = { data: string; fechamento: number };

/**
 * Um passeio aleatório com a volatilidade pedida, depois inclinado para
 * aterrissar no retorno pedido.
 *
 * A inclinação é aplicada DEPOIS de gerar o ruído, e não como deriva dentro do
 * passeio: assim o retorno final é exato em vez de aproximado, e a forma do
 * caminho continua sendo a do ruído.
 */
export function serieDe(ticker: string): Ponto[] {
  const a = ACOES.find((x) => x.ticker === ticker.toUpperCase());
  if (!a) return [];

  const aleatorio = gerador(sementeDe(a.ticker));
  const sigmaDiario = a.vol12m / 100 / Math.sqrt(PREGOES);

  // Passeio em log, sem deriva.
  const log: number[] = [0];
  for (let i = 1; i < PREGOES; i++) {
    // Box-Muller.
    const u1 = Math.max(aleatorio(), 1e-9);
    const u2 = aleatorio();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    log.push(log[i - 1]! + z * sigmaDiario);
  }

  // Inclina para o ponto final ser o retorno da tabela, na unha.
  const alvo = Math.log(1 + a.retorno12m / 100);
  const desvioFinal = log[PREGOES - 1]!;
  const inclinado = log.map((v, i) => v + ((alvo - desvioFinal) * i) / (PREGOES - 1));

  // Preço de partida arredondado, só para o eixo não ficar com número feio.
  const partida = 10 + (sementeDe(a.ticker) % 4000) / 100;
  const hoje = new Date();

  return inclinado.map((v, i) => {
    const d = new Date(hoje);
    // Aproximação de pregão: 252 dias úteis em 365 corridos.
    d.setDate(d.getDate() - Math.round(((PREGOES - 1 - i) * 365) / PREGOES));
    return {
      data: d.toISOString().slice(0, 10),
      fechamento: Number((partida * Math.exp(v)).toFixed(2)),
    };
  });
}

/**
 * Pior queda e dias até recuperar, medidos na série acima.
 *
 * `diasAteOPico` é 0 quando o papel ainda não voltou ao topo — e essa é a
 * leitura correta, não um dado faltando: quem está no fundo ainda não tem
 * prazo de recuperação para contar.
 */
export function metricasDaSerie(ticker: string): { piorQueda: number; diasAteOPico: number } {
  const serie = serieDe(ticker);
  if (serie.length === 0) return { piorQueda: 0, diasAteOPico: 0 };

  let pico = serie[0]!.fechamento;
  let iPico = 0;
  let piorQueda = 0;
  let iFundo = 0;

  for (let i = 1; i < serie.length; i++) {
    const p = serie[i]!.fechamento;
    if (p > pico) {
      pico = p;
      iPico = i;
    }
    const queda = (p / pico - 1) * 100;
    if (queda < piorQueda) {
      piorQueda = queda;
      iFundo = i;
    }
  }

  // Do fundo em diante, quantos pregões até fechar acima do pico que o causou.
  const alvo = serie[iPico]!.fechamento;
  let recuperou = 0;
  for (let i = iFundo; i < serie.length; i++) {
    if (serie[i]!.fechamento >= alvo) {
      recuperou = i - iFundo;
      break;
    }
  }

  return { piorQueda: Number(piorQueda.toFixed(1)), diasAteOPico: recuperou };
}

export type Fato = { data: string; titulo: string; categoria: string; url: string };

/**
 * Fatos relevantes — MOCK. O pacote IPE da CVM ainda não é cruzado com ticker.
 *
 * A quantidade respeita o `fatos30d` da tabela: se lá diz três, aqui saem três
 * dos últimos trinta dias. Número que não bate com a lista ao lado é o tipo de
 * detalhe que destrói a confiança na tela inteira.
 */
export function fatosDe(ticker: string): Fato[] {
  const a = ACOES.find((x) => x.ticker === ticker.toUpperCase());
  if (!a) return [];

  const modelos = [
    { titulo: "Divulgação de resultados trimestrais", categoria: "Resultado" },
    { titulo: "Aviso aos acionistas sobre juros sobre capital próprio", categoria: "Provento" },
    { titulo: "Comunicado ao mercado sobre notícia veiculada na imprensa", categoria: "Esclarecimento" },
    { titulo: "Fato relevante sobre alteração na administração", categoria: "Governança" },
    { titulo: "Aprovação de programa de recompra de ações", categoria: "Capital" },
  ];

  const aleatorio = gerador(sementeDe(a.ticker) ^ 0x9e37);
  const hoje = new Date();

  return Array.from({ length: a.fatos30d }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - Math.floor(aleatorio() * 30));
    const m = modelos[(sementeDe(a.ticker) + i * 7) % modelos.length]!;
    return {
      data: d.toISOString().slice(0, 10),
      titulo: m.titulo,
      categoria: m.categoria,
      url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe",
    };
  }).sort((x, y) => (x.data < y.data ? 1 : -1));
}
