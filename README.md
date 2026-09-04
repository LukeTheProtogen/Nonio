# Nônio

> *contra-consenso* — a escala fina do consenso de mercado.

Ferramenta de pesquisa e probabilidade sobre o mercado brasileiro.
Não é recomendação de investimento.

## Decisões travadas (não revisitar durante o sprint)
- `baseCalculo` do Focus: **fixado em 0**. Medido em 04-09-2026: para o mesmo
  IPCA/data, a base 0 traz 81 respondentes e a base 1 traz 26, com médias de
  0,1324 e 0,0900 — 47% de diferença. A base 0 é a amostra maior e mais estável.
  Ver `notas/reconhecimento.md`. **Não misturar as duas em hipótese alguma.**
- Universo de ações: 15 a 20 nomes do Ibovespa, incluindo PETR4, VALE3, ITUB4 e MGLU3.
- Macro é a prova (calibração vs. Focus). Ações são superfície de exploração.
- Modo `?demo=1` lê snapshot congelado — é nele que a apresentação roda.

## Comandos
- `make dados` — regenera Parquet/JSON a partir das fontes públicas
- `make dev`   — sobe o servidor de desenvolvimento

## Fontes
Ver `.env.example`. Estado verificado das fontes: `notas/reconhecimento.md`.
