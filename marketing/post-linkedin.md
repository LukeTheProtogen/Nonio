# Post de lançamento · LinkedIn

Todos os números vieram de `web/src/data/backtest.json`, conferidos contra a
fonte antes de escrever. Nenhum é estimativa.

## Restrições que a peça respeita

**O ângulo é "o consenso erra", não "nós acertamos".** Isso é imposição do dado,
não estilo: o modelo macro é `null` no código e o de ações
(`baseline-lognormal-v0`) não tem histórico publicado. Qualquer número nosso de
acerto seria inventado. No dia em que existir, a peça se reescreve.

**Vocabulário do degrau 2 fica de fora.** `web/scripts/conformidade.mjs` bloqueia
27 termos que subiriam o produto para análise de valores mobiliários (Res. CVM
20). O texto abaixo respeita a mesma lista.

---

## Texto

Entre 2000 e 2024, a mediana do Boletim Focus errou o IPCA em 1,59 ponto
percentual a doze meses.
São 529 observações. O dado é público. Quase ninguém abriu.

Mais de cem instituições projetam a inflação brasileira toda semana. O que
circula na imprensa é a mediana. O que some é a discordância entre elas, que é
justamente onde está a informação.

Tem coisa pior no número. A probabilidade implícita nesse consenso não se
confirma: na faixa em que ele indicava cerca de 72% de chance, o evento
aconteceu 0% das vezes, em 40 observações.

Construí o Nônio para pôr isso na tela.

A distribuição inteira do Focus, não a mediana. Desvio, extremos, quantis e
quantos responderam. Vinte indicadores, cinco anos à frente.
O erro histórico do consenso medido contra o IPCA que de fato aconteceu, com
diagrama de calibração.
Fonte pública em cada número, com data.

E uma regra que virou código: onde não temos modelo, a tela diz que não temos.
Onde o dado não existe, ela mostra a lacuna em vez de preencher.

Ferramenta de pesquisa. Não é recomendação de investimento (Res. CVM 19 e 20).

Quer ver a discordância inteira? Comenta "Focus" que eu mando o link.

#BoletimFocus #IPCA #DadosPúblicos #BancoCentral #Probabilidade

---

## Hooks alternativos para testar

**A, o mais agressivo**

> Na faixa em que o consenso do mercado indicava 72% de chance, o evento
> aconteceu 0% das vezes.
> Quarenta observações. Dado público do Banco Central.

**B, o mais pessoal**

> O Boletim Focus é público desde 2000 e você provavelmente nunca abriu um.
> Eu abri os 24 anos e medi o erro. Não é bonito.

---

## Números, e de onde cada um sai

| Número | Origem |
|---|---|
| 1,59 p.p. | `por_horizonte[12].consenso.mae` |
| 529 observações, 2000 a 2024 | `por_horizonte[12].n` e `.periodo` |
| 72% dizia, 0% aconteceu, n=40 | `evento_acima_teto.confiabilidade`, faixa 60–80% |
| Brier skill −19% | `evento_acima_teto.brier_skill` |
| 145 respondentes | `data/macro.json`, IPCA 2026 |

O 145 é do IPCA 2026 especificamente e varia por indicador e por ano. Se alguém
questionar, a resposta correta é "145 respondentes no IPCA 2026, e a tela mostra
o n de cada série".

## Sem emoji, e é escolha

A peça vende sobriedade com dado público. Emoji nesse contexto corrói a
credibilidade que o número constrói.
