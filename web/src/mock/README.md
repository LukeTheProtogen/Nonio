# Dados mockados

Tudo neste diretório é **fictício** e existe só para a interface poder ser
construída antes do pipeline publicar o dado correspondente.

O que está aqui **não** vem do Banco Central, da CVM nem da B3. Nenhum arquivo
daqui pode vazar para uma tela sem que a própria tela diga que o dado é
ilustrativo.

## O que é real hoje

| Dado | Origem | Onde vive |
|---|---|---|
| Backtest do consenso IPCA, 7 horizontes | pipeline `nonio.backtest` | `src/data/backtest.json` |
| Foto atual do consenso IPCA | pipeline `nonio.backtest` | `src/data/backtest.json` → `foto_atual` |
| Probabilidade por papel, 12 meses | pipeline `nonio.probabilidade` | `src/data/previsoes.json` |
| Cotação ao vivo | brapi, via `lib/brapi` | rota `/api/painel` |

## O que está mockado, e por quê

| Dado | Motivo | Sai daqui quando |
|---|---|---|
| Painel macro dos 4 indicadores | o pipeline calcula o consenso mas ainda não publica um JSON por indicador com a nossa previsão ao lado | `nonio.prever` publicar `macro.json` |
| Nuvem de dispersão reconstruída | depende de `numeroRespondentes`, nulo em 36,5% da base e ausente antes de 02-01-2014 | a reconstrução entrar no pipeline |
| Citações das atas do Copom | o módulo `nonio.llm` existe mas o acervo ainda não foi processado | o Batch das 280 atas rodar |
| Risco e sensibilidade macro por papel | não há regressão de fatores publicada | o pipeline publicar `acoes.json` |
| Fatos relevantes por papel | o pacote IPE da CVM ainda não é cruzado com ticker | o cruzamento CNPJ→ticker entrar |

## Decisões travadas que estes mocks respeitam

Vêm do `README.md` da raiz. Se um mock contradisser um destes pontos, o mock
está errado.

- `baseCalculo` é **0**, não 1. Amostra sobre recência, medido em 04-09-2026.
- Universo de 15 a 20 papéis do Ibovespa. Sem token da brapi, só quatro
  respondem: PETR4, VALE3, ITUB4 e MGLU3.
- Horizontes exibidos: 1, 3, 6, 9 e 12 meses.
- A nuvem de pontos só existe de 2014 em diante. Antes disso, faixa
  mínimo–máximo sem pontos, dizendo por quê.
