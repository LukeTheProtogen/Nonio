# Handoff — subir o back-end do Nônio na AWS (conta pessoal)

Escrito em 06/09/2026. Descreve o estado real do `backend/` neste commit.
Se o código mudar, confira os pontos marcados com **verificar**.

Escopo: conta AWS **pessoal**, fora da conta de empresa Nomio. A separação não é
detalhe burocrático — está na seção "Conta pessoal", e é o primeiro passo.

---

## 1. O que é o serviço

FastAPI, entrada `app.main:app`, Python **3.13** (`backend/.python-version`).

| Rota | Auth | Serve |
|---|---|---|
| `GET /health` | não | liveness |
| `GET /acoes`, `/acoes/{ticker}` | Bearer | universo + probabilidades do LGBM |
| `GET /copom`, `/copom/latest`, `/copom/{nro}` | Bearer | 260 reuniões + extração de atas |
| `GET /stocks`, `/stocks/{code}` | Bearer | **nenhuma tela do front chama** |

**Autenticação.** O Next (Supabase Auth) emite um JWT curto HS256 e manda
`Authorization: Bearer …`. A API valida em `app/auth/nextauth_gate.py`:
`issuer = "nonio-web"`, `audience = "nonio-api"`, segredo em `AUTH_SECRET` —
o *mesmo* valor dos dois lados. `config.py` rejeita o placeholder de dev, então
o container não sobe sem um segredo de verdade.

**CORS: não existe middleware, e não precisa.** Quem chama a API é o servidor do
Next (BFF), não o navegador. Se algum dia o browser chamar direto, aí sim vai
precisar — e aí o `AUTH_SECRET` vazaria para o cliente, o que quebra o modelo.
Mantenha as chamadas server-side.

**Dados que a API lê** (`backend/app/config.py:19`):

```
data/parquet/          7,1 MB · 305 arquivos
  models/previews_lgbm.parquet    universo + probabilidades  → /acoes
  macro/cdi.parquet               série do CDI               → "acima do CDI"
  copom/atas.parquet              índice de reuniões         → /copom
  copom/features.parquet          extração por LLM (81/260)
  stocks/{TICKER}/history.parquet 301 tickers, OHLC diário
data/nonio.duckdb      2,5 MB   → só /stocks
```

`parquet_root` é `RAIZ / "data" / "parquet"`, com `RAIZ = parents[2]` do
`config.py` — ou seja, **relativo à raiz do repo**. Num container onde só
`backend/` foi copiado, esse caminho aponta para o lugar errado. É a armadilha
número um deste deploy. Resolva com a env `PARQUET_ROOT` (o pydantic-settings
lê pelo nome do campo em maiúsculas), não editando o default.

**Peso das dependências** (instalado, medido no macOS; no Linux é da mesma ordem):

```
430 MB total
  192 MB  _polars_runtime_32
  122 MB  pyarrow
   43 MB  duckdb
```

`duckdb` + `duckdb-sqlalchemy` existem só para `/stocks`, que ninguém chama.
Removê-los corta ~43 MB **e** elimina o problema de escrita descrito adiante.
Se cortar, `app/db/session.py` e o `init_db()` no lifespan saem junto.

---

## 2. A decisão: EC2, não EKS

Recomendação: **uma instância EC2**. O motivo é custo, e a diferença não é
marginal numa conta pessoal.

O EKS cobra o *control plane* por hora, exista carga ou não, e ele não é a única
linha fixa: some o load balancer e, se você puser os nós em subnet privada, o
NAT Gateway. São três mensalidades que aparecem antes da primeira requisição.
**Verificar os valores na calculadora da AWS para a sua região** — a ordem de
grandeza é dezenas de dólares por mês para o control plane sozinho, e o NAT
costuma custar o mesmo que a instância inteira.

Uma EC2 pequena (`t4g.small`, ARM) roda isto com folga: o serviço é *stateless*,
lê 7 MB de parquet e não calcula nada por requisição. Custa alguns dólares por
mês em on-demand, e menos ainda se você desligar fora dos horários de teste.

**Não afirmo nada sobre free tier.** As regras mudaram e dependem de quando a
conta foi criada — confira em `aws.amazon.com/free` antes de contar com isso.

EKS se justifica quando há vários serviços, times separados ou escala que exige
autoscaling real. Nada disso é o caso: um serviço, um leitor de arquivos.

---

## 3. Caminho EC2

### 3.1 Dockerfile

Crie `backend/Dockerfile`:

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# uv resolve mais rápido e respeita o uv.lock
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv export --frozen --no-hashes -o requirements.txt \
 && uv pip install --system --no-cache -r requirements.txt

COPY app ./app

# Contorna o parents[2] do config.py: os dados ficam num caminho explícito.
ENV PARQUET_ROOT=/dados/parquet \
    DATABASE_URL=duckdb:////dados/nonio.duckdb \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Note as **quatro** barras em `duckdb:////dados/...` — três do esquema mais a
raiz absoluta. Com três só, o DuckDB tenta caminho relativo e falha na hora do
`create_all()`.

Se cortar o DuckDB (recomendado), remova a `DATABASE_URL`, o import de
`app.db.session` no `main.py` e o router `stocks`.

### 3.2 Os dados

O `data/parquet/` está no `.gitignore` (linha 20), então não vem com o clone.
Duas formas de levar:

**S3 (recomendado).** Permite atualizar o modelo sem rebuild da imagem:

```bash
aws s3 sync data/parquet s3://nonio-dados-<sufixo>/parquet --profile nonio-pessoal
# na instância, antes de subir o container:
aws s3 sync s3://nonio-dados-<sufixo>/parquet /dados/parquet
```

Dê à instância um **IAM role** com leitura só nesse bucket. Não coloque chave de
acesso no `.env` da instância.

**Ou embutir na imagem** (`COPY data/parquet /dados/parquet`): mais simples,
porém cada retreino do modelo vira uma imagem nova.

### 3.3 A instância

1. AMI Amazon Linux 2023 **arm64**, tipo `t4g.small`.
2. Security group: entrada **443** de qualquer origem (a Vercel não publica
   faixa de IP fixa que dê para travar); **22** só do seu IP. Nunca 8000 aberto.
3. IAM role com leitura do bucket, e nada além disso.
4. `dnf install -y docker && systemctl enable --now docker`.
5. Caddy ou nginx na frente terminando TLS com Let's Encrypt. Precisa de um
   domínio apontando para o Elastic IP — sem domínio não há certificado válido,
   e o Next recusa `https` com certificado próprio.
6. **Elastic IP**, senão o endereço muda a cada reboot e o `NONIO_API_URL`
   quebra silenciosamente.

O `AUTH_SECRET` vai no `.env` da instância (`chmod 600`), ou no SSM Parameter
Store como `SecureString` se quiser fazer certo. **Não** no Dockerfile, que fica
legível em qualquer camada da imagem.

### 3.4 Ligar o front

No projeto da Vercel (`nonio-websetup`), em **todos** os ambientes:

```
NONIO_API_URL=https://api.seu-dominio.com
NONIO_RECURSOS_BACKEND=acoes,copom
```

Sem `NONIO_RECURSOS_BACKEND`, o `servico.ts` usa o padrão `["acoes","copom"]` —
o mesmo resultado, mas explícito é melhor.

**Ponto de atenção:** `NONIO_API_URL` é lida em execução (não é `NEXT_PUBLIC_`),
então um redeploy basta. Já as variáveis do Supabase são embutidas no build —
foi assim que o Auth quebrou em produção quando um build de Preview foi
promovido. Mantenha as cinco variáveis definidas em Production, Preview e
Development.

### 3.5 Rollback

O caminho de arquivos continua funcionando: com `NONIO_API_URL` vazia, o
`local.ts` serve `web/src/data/acoes.json` e `copom.json`. Se a instância cair
durante uma demo, apagar a variável e redeployar devolve o site ao ar em poucos
minutos, com dados de qualidade idêntica — só mais antigos.

Isso é o argumento mais forte a favor de não ter pressa com a AWS.

---

## 4. Se for de EKS mesmo

O que muda além do custo:

**A armadilha do DuckDB.** Ele é um banco embarcado de escritor único, e o
`init_db()` chama `Base.metadata.create_all()` **a cada boot** — ou seja, escreve
em disco na subida. Duas réplicas apontando para o mesmo arquivo num volume
compartilhado (EFS) corrompem o `.wal`; esse erro já apareceu neste projeto em
outro contexto. Saídas, em ordem de preferência:

1. Cortar o DuckDB (só `/stocks` usa, e nada chama `/stocks`).
2. `replicas: 1` — o que joga fora a razão de usar Kubernetes.
3. Arquivo somente-leitura embutido na imagem, sem `create_all`.

O parquet em si é só leitura e pode ser montado igual em N réplicas sem
problema. É o DuckDB que não escala horizontalmente.

**Esqueleto:** Deployment com `readinessProbe` e `livenessProbe` em `/health`
(rota sem auth, feita para isso), `AUTH_SECRET` como Secret, dados via initContainer
que faz `aws s3 sync` para um `emptyDir`, Service ClusterIP, Ingress com AWS Load
Balancer Controller e certificado no ACM.

Peça um `t4g.medium` no node group: com polars e pyarrow o processo passa de
500 MB residentes, e `t4g.small` no EKS ainda paga o overhead do kubelet e do
CNI.

---

## 5. Conta pessoal — a separação importa

Esta parte não é formalidade. Um comando `aws` disparado no perfil errado mistura
infraestrutura pessoal com a da Nomio, e desfazer isso depois é caro.

1. Conta nova, e-mail **pessoal**. Não convide para a Organization da Nomio caso tenha,
   não use SSO corporativo, não reaproveite credencial de projeto.
2. MFA no root **na criação**, e não use root para nada além do que exige root.
3. Um usuário IAM (ou Identity Center) para o dia a dia, com permissão só do que
   este deploy precisa.
4. **Perfil nomeado no CLI**, sempre explícito:

   ```bash
   aws configure --profile nonio-pessoal
   aws sts get-caller-identity --profile nonio-pessoal   # confira o Account ID
   ```

   Rode esse `get-caller-identity` antes de qualquer comando que crie recurso.
   É a única forma barata de garantir que você está na conta certa.
5. **AWS Budget com alerta por e-mail** em um valor baixo, antes de subir
   qualquer coisa. Sem isso, um NAT Gateway esquecido só aparece na fatura.
6. Nenhum dado de cliente da Nomio entra nesta conta. O que sobe aqui é
   série pública do BCB, cotação da B3 e saída de modelo próprio.

---

## 6. Ordem sugerida

1. Conta + MFA + perfil nomeado + budget.
2. Cortar `duckdb`/`duckdb-sqlalchemy` e o router `stocks` — menos 43 MB e um
   problema estrutural a menos.
3. Dockerfile; rodar **local** com `PARQUET_ROOT` apontando para `data/parquet`
   e conferir que `/acoes` devolve 20 papéis e `/copom` 260 reuniões.
4. Só então EC2, domínio, TLS.
5. `NONIO_API_URL` na Vercel por último, com o rollback da seção 3.5 à mão.

Estimativa honesta: **meio dia** se o passo 3 passar de primeira. As duas coisas
que mais provavelmente vão atrasar são o `parents[2]` do `config.py` e o
certificado TLS.

---

## 7. O que este documento não cobre

- Pipeline de CI que reconstrói a imagem — hoje o `publicar-api.sh` é manual.
- Retreino do modelo. Continua rodando na máquina de alguém e gerando parquet.
- Backup: não há estado a preservar. Tudo é derivável do pipeline.
- Números de preço. Confira na calculadora da AWS para a sua região.
