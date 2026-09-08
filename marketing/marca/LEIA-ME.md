# Arte da marca

Os dois arquivos `*-original.png` são os MESTRES, do jeito que vieram. Tudo o
que o site e o carrossel usam sai daqui por redução, e não existe vetor de
origem: as duas artes têm gradiente e sombra assados no pixel.

| Mestre | Onde entra |
|---|---|
| `nonio-marca-original.png` | Só as duas folhas, fundo transparente. É a marca da barra do produto, das telas de acesso e dos três slides do carrossel. |
| `nonio-caixa-original.png` | Ladrilho verde com as folhas em claro. É a do cabeçalho da landing, do favicon, do apple-icon e da imagem de compartilhamento. |

## Derivados, e onde cada um mora

| Arquivo | Lado | Fonte |
|---|---|---|
| `web/public/marca/nonio.png` | 512 | folhas, aparado no conteúdo |
| `web/public/marca/nonio-caixa.png` | 512 | ladrilho |
| `web/src/app/icon.png` | 192 | ladrilho |
| `web/src/app/apple-icon.png` | 180 | ladrilho |
| `marketing/carrossel/nonio.png` | 512 | folhas, aparado |

O aparo importa: o mestre das folhas tem margem transparente irregular, e sem
recortar no conteúdo a marca fica visivelmente descentrada ao lado do nome.

## Regerar

Não há script fixo. O que foi feito: desenhar o mestre num canvas, achar a
caixa do conteúdo pelo canal alfa, recortar, redesenhar centralizado num
quadrado do tamanho alvo e salvar. Qualquer editor de imagem faz o mesmo à mão
— aparar no conteúdo, centralizar em quadrado, exportar com alfa.

## O que a troca custou

A marca antiga era SVG com `fill="currentColor"` e trocava de cor sozinha
conforme o fundo. Estas não trocam. Em fundo claro de baixo contraste a versão
sem caixa some, e quem resolve lá é a versão em ladrilho, não uma recoloração.
