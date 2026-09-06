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
| Série de preços e fatos por papel (`serie.ts`) | a brapi só devolve cotação do dia, sem histórico | o pipeline publicar o histórico ajustado |
| Fatos relevantes por papel | o pacote IPE da CVM ainda não é cruzado com ticker | o cruzamento CNPJ→ticker entrar |
| Planos e preços (`planos.ts`) | não há cobrança, gateway nem contrato | existir produto de assinatura de verdade |
| Identificação da empresa (`empresa.ts`) | não há pessoa jurídica constituída | houver razão social, CNPJ, endereço e encarregado |

## Como o mock chega na tela

Nada importa mock direto. Tudo passa por `src/lib/api/`:

| Arquivo | Papel |
|---|---|
| `contratos.ts` | schemas Zod: a forma que o `nonio-api` vai ter que devolver |
| `local.ts` | monta a resposta com mock + o que o pipeline já publica |
| `servico.ts` | a chave: `NONIO_API_URL` definida busca no backend, vazia usa `local` |

Os dois caminhos passam pelo mesmo schema. É isso que impede o mock de derivar:
se ele deixar de caber no contrato, quebra o build, não a integração.

As rotas em `src/app/api/` expõem o mesmo contrato por HTTP, para inspecionar
com curl e para um front separado consumir. As páginas não passam por elas.

## Bloqueio de publicação

`empresa.ts` não é um mock comum. Os valores são colchetes literais
(`[RAZÃO SOCIAL]`, `[CNPJ]`) e aparecem assim na tela em **termos**,
**privacidade** e **contato**.

Isso é proposital. Sem identificação do controlador, esses documentos
descumprem o art. 41 da LGPD e o art. 7º do Marco Civil. Os colchetes garantem
que ninguém publique em domínio próprio sem notar.

**Nada disso vai ao ar antes de `empresa.ts` estar preenchido**, e os termos
merecem revisão de advogado antes da primeira cobrança.

## Decisões travadas que estes mocks respeitam

Vêm do `README.md` da raiz. Se um mock contradisser um destes pontos, o mock
está errado.

- `baseCalculo` é **0**, não 1. Amostra sobre recência, medido em 04-09-2026.
- Universo de 15 a 20 papéis do Ibovespa. Sem token da brapi, só quatro
  respondem: PETR4, VALE3, ITUB4 e MGLU3.
- Horizontes exibidos: 1, 3, 6, 9 e 12 meses.
- A nuvem de pontos só existe de 2014 em diante. Antes disso, faixa
  mínimo–máximo sem pontos, dizendo por quê.
