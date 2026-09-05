# Nônio

> *Nomio* — a escala fina do consenso de mercado. Seu mercado com mais controle, na sua mão.

No paquímetro, o nônio é a escala auxiliar que dá a casa decimal além da escala
principal. Ele não substitui a régua grossa: lê mais fino que ela. É essa a
relação entre este projeto e o Boletim Focus.

**Ferramenta de pesquisa e probabilidade sobre o mercado brasileiro.
Não é recomendação de investimento.**

---

## A tese

O Boletim Focus reúne mais de cem instituições financeiras e publica não só a
mediana, mas **a discordância entre elas** — desvio-padrão, mínimo, máximo e
número de respondentes. O dado é público desde janeiro de 2000 e ninguém mostra
isso ao investidor final, que recebe um número só e não fica sabendo que ele é a
mediana de uma briga.

E o consenso erra de forma mensurável. Medido sobre 26 anos, IPCA anual:

| horizonte | MAE do consenso | viés | β Mincer-Zarnowitz |
|---:|---:|---:|---:|
| 1 mês | 0,43 p.p. | +0,27 | 1,07 |
| 6 meses | 1,28 p.p. | +0,47 | 0,68 |
| 12 meses | 1,59 p.p. | +0,98 | 0,58 |
| 24 meses | 1,92 p.p. | +1,50 | 0,21 |

O viés é **sempre positivo e cresce com o horizonte**: o realizado vem acima do
projetado em 16 dos 25 anos. E o β caindo para 0,21 em 24 meses significa que, no
horizonte longo, o consenso praticamente não carrega informação além da âncora da
meta — contra o baseline "chutar a meta", o skill do consenso cai para +0,06.

A probabilidade implícita no consenso também é mal calibrada: quando a normal do
Focus indicava menos de 20% de chance de estourar o teto da meta, estourou em
24% das vezes. O Brier fica **pior que a climatologia** (skill −0,19).

Nada disso é opinião — sai de `make backtest`.

---

## O que é, e o que deliberadamente não é

| É | Não é |
|---|---|
| Probabilidades com horizonte de 1 a 24 meses | Recomendação de compra ou venda |
| Cenários condicionais que o usuário parametriza | Preço-alvo |
| Comparação explícita contra a nuvem do consenso | Sinal de curto prazo ou day trade |
| Track record público, com os erros à mostra | Robô que executa ordens |
| Fonte rastreável até o documento original | Distribuidor de produto financeiro |

O enquadramento é o degrau 0 da escada regulatória: pesquisa, sem registro na
CVM. O que mantém esse degrau aberto não é a tecnologia, é a redação da
interface — ver [Conformidade](#conformidade).

---

## Arquitetura

```
Nonio/
├── pipeline/          Python (uv, 3.13) — roda offline, publica dado
│   └── nonio/
│       ├── ingest.py        Focus (Olinda) e séries do SGS
│       ├── consenso.py      normaliza numa base longa comparável
│       ├── avaliacao.py     métricas puras: MAE, RMSE, MZ, Brier, quantis
│       ├── backtest.py      alinha previsão × realizado e mede
│       ├── cotacoes.py      cotações B3 via brapi
│       ├── probabilidade.py baseline e limiar de recálculo por ativo
│       ├── prever.py        publica previsões e o registro append-only
│       └── llm.py           narrativa e extração (chave opcional)
├── web/               Next.js 16 — é o que a Vercel publica (Root Directory)
│   ├── src/app/api/         cotações, painel, cron
│   ├── src/lib/             brapi, previsões, conformidade
│   ├── src/data/            JSON publicado pelo pipeline, entra no bundle
│   └── scripts/             verificador da fronteira linguística
├── data/
│   ├── raw/                 Parquet gerado (não versionado)
│   └── snapshot/            registro append-only (versionado)
└── notas/                   reconhecimento das fontes e armadilhas
```

O treino é tarefa em lote, nunca servidor. O site lê dado publicado, não executa
modelo — as previsões mudam no máximo uma vez por dia, então não há inferência
sob demanda a servir. A cotação ao vivo é a exceção, e vem por revalidação de
15 minutos no próprio Route Handler.

---

## Como rodar

```bash
# ambiente
cd pipeline && uv sync

# dados: baixa Focus e SGS, depois normaliza
make dados

# a prova: alinha previsão × realizado e mede o erro do consenso
make backtest

# previsões publicadas + registro append-only
make prever

# fronteira linguística (roda também na CI)
make conformidade

# pipeline do backend: brapi + SGS (CDI) → DuckDB + parquet
make cron

# modelo: treino e varredura de experimentos
make treino
make experimentos

# API de leitura dos modelos
make api

# interface
make dev
```

Variáveis em `.env.example`. **Nenhuma é obrigatória**: sem `BRAPI_TOKEN` o app
funciona limitado a PETR4, VALE3, ITUB4 e MGLU3, que respondem sem token; sem
`ANTHROPIC_API_KEY` tudo funciona menos a narrativa com citação.

---

## Os dados

Tudo público, sem custo de licenciamento.

| Fonte | O que traz | Cobertura |
|---|---|---|
| BCB Olinda — Focus mensal | IPCA, IPCA Livres, IPCA Serviços, Câmbio, IGP-M | desde 2000 |
| BCB Olinda — Focus anual | IPCA, Selic, Câmbio, PIB Total | desde 2001 |
| BCB Olinda — Selic por reunião | expectativa por reunião do Copom | desde 2004 |
| BCB SGS | IPCA mensal e 12m, Selic, câmbio, meta de inflação | desde 1980 |
| CVM Dados Abertos | fatos relevantes, DFP/ITR | contínuo |
| brapi | cotações B3 | intradiário com atraso |

Resultado: **591 mil linhas** em três bases normalizadas
(`consenso_mensal`, `consenso_anual`, `consenso_selic`), com horizonte explícito
e estatísticas comparáveis entre indicadores de escalas diferentes: coeficiente
de variação, assimetria de Pearson, amplitude sobre desvio e desacordo
normalizado contra a média móvel de 52 semanas.

---

## Decisões travadas

Não revisitar durante o sprint sem discutir com o time.

- **`baseCalculo` do Focus fixado em 0.** Decisão consciente contra o artifact
  de design, que especifica base 1. Medido: no endpoint mensal, mesmo IPCA e
  mesma data, a base 0 traz 81 respondentes contra 26 da base 1, com 47% de
  diferença na média. Escolhemos amostra sobre recência. **Nunca misturar.**
- **Macro é a prova, ações são superfície de exploração.** O benchmark do Focus
  é macro e não valida previsão de ação — a calibração e o erro contra o
  consenso vivem no macro.
- **Horizontes exibidos: 1, 3, 6, 9 e 12 meses.** A base guarda todos; a
  filtragem é na leitura.
- **Modo `?demo=1`** lê snapshot congelado — é nele que a apresentação roda.
- **O registro de previsões é append-only.** Reescrever linha antiga invalida o
  track record inteiro.

---

## Limites conhecidos dos dados

Fatos medidos. Constrangem escolhas de modelagem — ler antes de escolher features.

- **`numeroRespondentes` é nulo em 36,5% da base.** O Focus só passou a publicar
  a quantidade de respondentes em 02-01-2014. A nuvem de dispersão que
  reconstrói pontos a partir de `n` **só funciona de 2014 em diante**; a coluna
  `nuvem_reconstruivel` marca isso linha a linha. `DesvioPadrao` está completo
  nos 26 anos, então o backtest não é afetado.
- **IPCA Livres e IPCA Serviços só existem desde setembro de 2021** — cerca de
  1.246 linhas por horizonte contra 6.228 do IPCA cheio. Como feature, limitam o
  treino a ~5 anos.
- **A amostra efetiva do backtest são ~25 anos, não 29 mil pares.** Cada ano
  aparece ~21 vezes, uma por data de coleta. Reportar MAE com três casas sugere
  precisão que não existe.
- **`Minimo` e `Maximo` faltam em 0,8%** das linhas.

---

## Conformidade

O produto opera no degrau 0 da escada regulatória. A fronteira entre isso e
"análise de valores mobiliários" (Res. CVM 20) é a **redação**: uma lista
ordenada por probabilidade, rotulada como probabilidade, é dado; a mesma lista
rotulada como "melhores oportunidades" é recomendação.

Por isso a fronteira é verificada por máquina, não por lembrança:

```bash
make conformidade     # 27 termos do degrau 2; falha o build se algum aparecer
```

Roda na CI antes de qualquer outro passo, e varre também os JSON publicados —
incluindo a narrativa gerada por LLM, que passa pelo mesmo filtro que texto
escrito por humano.

Texto e vocabulário em `web/src/lib/conformidade.ts`.

---

Documento de trabalho. Referências regulatórias são orientação estratégica e não
substituem parecer jurídico.
