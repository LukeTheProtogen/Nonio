# Armadilhas de ambiente

Erros que param o time e cuja mensagem **não sugere a solução**. Cada um custa de
uma a três horas para quem nunca viu. Leia antes do dia 1.

Legenda de confiança:

- **✔ verificado** — reproduzido e corrigido nesta máquina (macOS 26, arm64), com data.
- **○ documentado** — o caminho conhecido para a plataforma, **não testado aqui**.
  Se você for o primeiro a passar por ele, confirme e troque o marcador.

---

## 1. LightGBM não importa: falta o runtime de OpenMP

O LightGBM paraleliza com OpenMP e carrega a biblioteca em tempo de execução. O
wheel instala sem erro; a falha só aparece no `import`. Por isso o erro é
`OSError` no `dlopen`/`LoadLibrary`, e **não** `ModuleNotFoundError` — quem lê rápido
acha que instalou errado e reinstala, o que não resolve nada.

### macOS — ✔ verificado em 04-09-2026

O clang da Apple não distribui o runtime de OpenMP.

```
OSError: dlopen(.../lightgbm/lib/lib_lightgbm.dylib, 0x0006):
  Library not loaded: @rpath/libomp.dylib
  tried: '/opt/homebrew/opt/libomp/lib/libomp.dylib' (no such file)
```

```bash
brew install libomp
```

O Homebrew avisa que `libomp` é *keg-only* e sugere exportar `LDFLAGS` e `CPPFLAGS`.
**Ignore:** aqueles flags servem para *compilar* contra a biblioteca. O wheel do
LightGBM procura direto em `/opt/homebrew/opt/libomp/lib/`, que é onde o arquivo
passa a existir. Nada de variável de ambiente.

Em Mac Intel o prefixo é `/usr/local` em vez de `/opt/homebrew` — o `brew` resolve
sozinho, o comando é o mesmo.

### Linux — ○ documentado

Os wheels *manylinux* do LightGBM ligam contra `libgomp`, que costuma vir junto do
runtime do GCC. Em imagem completa geralmente já está lá; em imagem enxuta, não.

```
OSError: libgomp.so.1: cannot open shared object file: No such file or directory
```

```bash
# Debian, Ubuntu (inclui as imagens -slim)
sudo apt-get update && sudo apt-get install -y libgomp1

# Fedora, RHEL, Rocky
sudo dnf install -y libgomp

# Arch
sudo pacman -S openmp
```

Conferir se está presente: `ldconfig -p | grep libgomp`

**Alpine não serve.** O Alpine usa musl, e wheel *manylinux* é construído contra
glibc — instalar `libgomp` não resolve, porque o problema é a libc. Se precisar de
container, use `python:3.13-slim` (Debian). Trocar de base custa um minuto; fazer o
LightGBM compilar no Alpine custa uma tarde.

### Windows — ○ documentado

Normalmente funciona sem intervenção: o runtime de OpenMP da Microsoft (`vcomp140.dll`)
vem com o **Visual C++ Redistributable**, que a maioria das máquinas já tem. Se falhar:

```
OSError: [WinError 126] Não foi possível encontrar o módulo especificado
```

Instale o *Microsoft Visual C++ Redistributable (x64)* e reinicie o terminal.

---

## 2. O Olinda (BCB) rejeita espaço codificado como `+`

Vale para **todas as plataformas** — é comportamento da biblioteca, não do sistema.

O `requests` codifica espaços em parâmetros como `+` (`quote_plus`). O OData do Banco
Central exige `%20`. Medido em 04-09-2026, mesmo `$filter`:

| Codificação | Resposta |
|---|---|
| `Indicador+eq+'IPCA'` | **400** Bad Request |
| `Indicador%20eq%20'IPCA'` | **200** OK |

Vale também para o `$orderby` (`Data+desc` → 400; `Data%20desc` → 200).

```python
from urllib.parse import quote, urlencode
url = f"{OLINDA}?{urlencode(params, quote_via=quote)}"
r = requests.get(url, timeout=60)          # sem params=, já vai codificado
```

O sintoma engana: o 400 parece filtro malformado, e a pessoa vai depurar a sintaxe do
OData — que está correta.

### Extra para Windows: `curl` no PowerShell

Se você for testar a URL na mão, no PowerShell há **dois** problemas somados:

1. `curl` é *alias* de `Invoke-WebRequest`, que tem flags completamente diferentes.
2. `$` inicia variável, então `$filter` e `$top` viram string vazia na interpolação.

```powershell
# errado - o $filter some antes de sair da máquina
curl "https://olinda.bcb.gov.br/...?$filter=Indicador%20eq%20'IPCA'"

# certo - binário real + aspas simples, que não interpolam
curl.exe 'https://olinda.bcb.gov.br/...?$filter=Indicador%20eq%20''IPCA'''
```

No `cmd.exe` o `$` não é especial, mas `curl.exe` continua sendo o certo. Em WSL,
bash normal, sem nenhuma dessas complicações — é o caminho recomendado.

---

## 3. O SGS (BCB) devolve HTTP 200 com página HTML

**A pior das três**, e independente de plataforma.

Quando o SGS recusa uma requisição — por volume ou por estrangulamento de taxa — ele
não devolve 4xx. Devolve **200 com uma página HTML de erro**. Medido em 04-09-2026:
corpo de 6255 bytes, `content-type: text/html`.

Consequência: `raise_for_status()` passa direto e o erro só estoura no `.json()`, com
`JSONDecodeError: Expecting value: line 1 column 1`. A mensagem aponta para parsing
quando a causa é limite de taxa, a dezenas de linhas de distância.

E é **intermitente**: a mesma janela de datas funcionou numa chamada e falhou na
seguinte. Não confie em ter passado uma vez.

```python
def _get_json(url, params=None, tentativas=4):
    espera = 2.0
    for n in range(1, tentativas + 1):
        r = requests.get(url, params=params, timeout=90)
        tipo = r.headers.get("content-type", "")
        if r.ok and "json" in tipo.lower():      # valida o TIPO, não o status
            try:
                return r.json()
            except ValueError:
                pass
        if n < tentativas:
            time.sleep(espera); espera *= 2
            continue
        raise FonteIndisponivel(...)
```

### Limite de intervalo em série diária

O SGS também recusa intervalos longos em série diária, aí sim com **406**. Medido na
série 432 (Selic meta):

| Intervalo | Resposta |
|---|---|
| série inteira, sem datas | 406 |
| 2020–2026 (7 anos) | 200 |
| 2000–2009 (10 anos) | 200 |
| 2016–2026 (11 anos) | **406** |
| 2000–2026 (27 anos) | **406** |

Ou seja: **teto de 10 anos por requisição**. O `ingest.py` busca em janelas de 9 anos
com 1 segundo de pausa entre elas.

Quando existir versão mensal da série, prefira: a 4390 (Selic acumulada no mês) vem
inteira numa chamada, 482 observações desde 1986. Modelo mensal não precisa de série
diária.

---

## 4. O Makefile no Windows

`make` não existe no Windows por padrão. Três saídas, em ordem de preferência:

1. **WSL2** — é o caminho recomendado para todo o projeto, não só para o `make`.
   O `uv`, o Node e o `curl` se comportam como no Linux e as notas acima valem sem
   tradução.
2. **Git Bash** com o `make` do [ezwinports](https://sourceforge.net/projects/ezwinports/),
   ou `choco install make` / `winget install GnuWin32.Make`.
3. **Rodar os dois comandos na mão** — são literalmente dois:
   ```
   cd pipeline && uv run python -m nonio.ingest
   cd web && npm run dev
   ```
   O Makefile é conveniência, não dependência. Ninguém fica bloqueado por causa dele.

### CRLF quebra Makefile

Se o git converter as quebras de linha, a receita vem com CRLF e o `make` falha com
mensagem obscura (`missing separator`). O `.gitattributes` na raiz já força LF em
`Makefile`, `*.sh` e `*.py`. Se mesmo assim acontecer:

```bash
git config --global core.autocrlf input     # Linux, macOS
git config --global core.autocrlf true      # Windows, com o .gitattributes mandando
```

Lembrete que vale em qualquer sistema: a linha de comando do Makefile começa com
**tab literal**, nunca espaços.

---

## 5. Instalação do uv, por plataforma

```bash
# macOS e Linux
curl -LsSf https://astral.sh/uv/install.sh | sh
```
```powershell
# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Use sempre `uv run <comando>` em vez de ativar venv — assim não há diferença entre
`source .venv/bin/activate` (Unix) e `.venv\Scripts\Activate.ps1` (Windows), e ninguém
roda o script no interpretador errado.

O `.python-version` do `pipeline/` fixa 3.13. O `uv` baixa esse interpretador sozinho,
isolado, sem tocar no Python do sistema — em qualquer plataforma.

---

## 6. Node muito novo

A máquina onde isto foi montado tem **Node v26.0.0**, mais novo que o testado pela
maioria do ecossistema. O Next 16.3.4 rodou. Se alguém do time tiver erro estranho no
`create-next-app` ou no build, suspeite da versão do Node antes de suspeitar do Next —
e alinhe todo mundo na mesma versão LTS.
