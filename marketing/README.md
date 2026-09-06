# Peças de divulgação

Nada aqui é servido pelo site. É material de rede social, versionado para poder
ser refeito quando o dado mudar.

## Carrossel

`carrossel/slides.html` é a FONTE. Os PNG são derivados, e derivado se regera:

    cd marketing/carrossel
    python3 -m http.server 4747 &
    for i in 1 2 3; do
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
        --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
        --window-size=1080,1350 --virtual-time-budget=9000 \
        --screenshot="slide-$i.png" "http://localhost:4747/slides.html?s=$i"
    done

`?s=N` isola um slide: o Chrome headless não rola a página, então exportar
1080×1350 exatos exige que só um exista de cada vez.

`ver.html` mostra os três lado a lado e um a um, para conferir antes de postar.

## Continuidade entre os slides

A régua fica em `y=1012` nos TRÊS. Sai do slide N na borda direita e entra no
slide N+1 na esquerda, na mesma altura. É o que faz os cortes lerem como recorte
de uma tela só.

A nuvem de projeções vai de dispersa a resolvida: 145 pontos no slide 1, 90 no
2, e 34 em torno de uma leitura só no 3.

## A textura

`textura.html` gera papel procedural em 2160×2700. O PNG não é versionado: são
8 MB e se regera em segundos.

O motivo de ser gerada e não escaneada: iluminação perfeitamente uniforme. Canto
escuro numa textura de sobreposição vira sombra falsa em cima do desenho, e é o
requisito mais difícil de arrancar de um modelo de imagem.

## Quando o backtest mudar

Os números do post e dos slides saem de `web/src/data/backtest.json`. Mudou o
backtest, confira `post-linkedin.md` (tem a tabela de origem de cada número) e
reexporte os slides.
