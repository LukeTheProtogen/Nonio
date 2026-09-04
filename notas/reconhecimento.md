# Reconhecimento das fontes

Gerado em 2026-09-04 19:44 -03. Refazer se algo quebrar no dia 1.

## 1. BCB Olinda — Focus (ExpectativaMercadoMensais)

```
primeiro registro disponível:
{'Indicador': 'IPC-Fipe', 'Data': '2000-01-03', 'DataReferencia': '04/2000', 'Mediana': 0.6}

registro mais recente:
{'Indicador': 'IPCA', 'Data': '2026-08-28', 'DataReferencia': '08/2028', 'Mediana': 0.1431, 'numeroRespondentes': 26, 'baseCalculo': 1}

IPCA, uma data, as DUAS bases de cálculo (a armadilha):
  {'Data': '2026-08-28', 'DataReferencia': '08/2028', 'Media': 0.09, 'Mediana': 0.1431, 'numeroRespondentes': 26, 'baseCalculo': 1}
  {'Data': '2026-08-28', 'DataReferencia': '08/2028', 'Media': 0.1324, 'Mediana': 0.1503, 'numeroRespondentes': 81, 'baseCalculo': 0}
  {'Data': '2026-08-28', 'DataReferencia': '07/2028', 'Media': 0.1867, 'Mediana': 0.205, 'numeroRespondentes': 28, 'baseCalculo': 1}
  {'Data': '2026-08-28', 'DataReferencia': '07/2028', 'Media': 0.2006, 'Mediana': 0.2, 'numeroRespondentes': 96, 'baseCalculo': 0}
```

## 2. BCB SGS — realizados

```
série 433 (IPCA % a.m.), últimos 3:
[{"data":"01/05/2026","valor":"0.58"},{"data":"01/06/2026","valor":"0.16"},{"data":"01/07/2026","valor":"0.07"}]
série 432 (Selic meta), últimos 3:
[{"data":"14/09/2026","valor":"14.00"},{"data":"15/09/2026","valor":"14.00"},{"data":"16/09/2026","valor":"14.00"}]
```

## 3. brapi — cotações

```
PETR4 SEM token (deve funcionar):
{'symbol': 'PETR4', 'regularMarketPrice': 47.11, 'regularMarketTime': '2026-09-04T22:27:46.000Z', 'currency': 'BRL', 'shortName': 'PETR4'}
erro: None None

os 4 gratuitos juntos, numa chamada só:
results: 4
  PETR4 47.11
  VALE3 78.62
  ITUB4 41.92
  MGLU3 5.79
erro: None None

um ticker FORA da lista gratuita, sem token (esperado: falhar):
{"error":true,"message":"Token de autenticação não fornecido","code":"MISSING_TOKEN"}
```

## 4. Atas do Copom e CVM

```
últimas atas:
  2026-08-05 280ª Reunião - 4-5 agosto, 2026 -> /content/copom/atascopom/Copom280-not20260805280.pdf
  2026-06-17 279ª Reunião - 16-17 junho, 2026 -> /content/copom/atascopom/Copom279-not20260617279.pdf
  2026-04-29 278ª Reunião - 28-29 abril, 2026 -> /content/copom/atascopom/Copom278-not20260429278.pdf

CVM IPE 2026 (fatos relevantes):
  http=200 bytes=1551349 tipo=application/zip
CVM DFP 2025 (fundamentos):
  http=200 bytes=12753312 tipo=application/zip
```

