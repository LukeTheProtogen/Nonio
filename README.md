# Contra-Consenso

Ferramenta de pesquisa e probabilidade sobre o mercado brasileiro.
Não é recomendação de investimento.

## Decisões travadas (não revisitar durante o sprint)
- `baseCalculo` do Focus: **a definir no preparo** — fixar 0 ou 1 e anotar aqui.
- Universo de ações: 15 a 20 nomes do Ibovespa, incluindo PETR4, VALE3, ITUB4 e MGLU3.
- Macro é a prova (calibração vs. Focus). Ações são superfície de exploração.
- Modo `?demo=1` lê snapshot congelado — é nele que a apresentação roda.

## Comandos
- `make dados` — regenera Parquet/JSON a partir das fontes públicas
- `make dev`   — sobe o servidor de desenvolvimento

## Fontes
Ver `.env.example`.
