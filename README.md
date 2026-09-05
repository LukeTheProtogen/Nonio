# Nônio

> *contra-consenso* — a escala fina do consenso de mercado.

Ferramenta de pesquisa e probabilidade sobre o mercado brasileiro.
Não é recomendação de investimento.

## Decisões travadas (não revisitar durante o sprint)
- `baseCalculo` do Focus: **fixado em 0** — decisão consciente **contra** o
  artifact de design, que especifica base 1.
  Medido em 04-09-2026 no endpoint mensal, mesmo IPCA e mesma data: a base 0
  traz 81 respondentes e a base 1 traz 26, com médias de 0,1324 e 0,0900 — 47%
  de diferença. No endpoint anual a distância é menor (102 contra 45), mas a
  base 0 segue sendo a amostra maior.
  Escolhemos amostra sobre recência. **Nunca misturar as duas.**
  Ver `notas/reconhecimento.md`.
- Universo de ações: 15 a 20 nomes do Ibovespa, incluindo PETR4, VALE3, ITUB4 e MGLU3.
- Horizontes exibidos: **1, 3, 6, 9 e 12 meses**. A base guarda todos os
  horizontes; a filtragem é na leitura.
- Indicadores coletados — mensais: IPCA, IPCA Livres, IPCA Serviços, Câmbio,
  IGP-M. Anuais: IPCA, Selic, Câmbio, PIB Total. Mais a Selic por reunião do
  Copom (`ExpectativasMercadoSelic`, histórico desde 2004).
- Macro é a prova (calibração vs. Focus). Ações são superfície de exploração.
- Modo `?demo=1` lê snapshot congelado — é nele que a apresentação roda.

## Limites conhecidos dos dados
Fatos medidos, não opiniões. Constrangem decisões de modelagem — ler antes de
escolher features.

- **`numeroRespondentes` é nulo em 36,5% da base.** O Focus só passou a publicar
  a quantidade de respondentes em **02-01-2014**. Consequência direta: a nuvem
  de dispersão que reconstrói pontos a partir de `n` **só funciona de 2014 em
  diante**. A coluna `nuvem_reconstruivel` marca isso linha a linha; antes disso,
  exibir a faixa mínimo–máximo sem pontos e dizer por quê. `DesvioPadrao` está
  completo nos 26 anos, então o backtest e a comparação com o consenso não são
  afetados.
- **IPCA Livres e IPCA Serviços só existem desde 2022** — 1.246 linhas por
  horizonte contra 6.228 do IPCA cheio. Como feature, limitam o treino a ~4
  anos. Decidir no dia 2 se entram; não descobrir dentro de um `dropna`.
- **`Minimo` e `Maximo` faltam em 0,8%** das linhas, o que anula `amplitude_dp`
  junto.

## Comandos
- `make consenso` — só a normalização, sem rebaixar nada
- `make dados` — regenera Parquet/JSON a partir das fontes públicas
- `make dev`   — sobe o servidor de desenvolvimento

## Fontes
Ver `.env.example`. Estado verificado das fontes: `notas/reconhecimento.md`.
