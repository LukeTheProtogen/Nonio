# Handoff — configuração Supabase (Auth) no painel

Documento para quem for ligar o Auth no **projeto Supabase na nuvem** (dashboard).
O app Next já espera esse desenho; local usa `npx supabase start` + Docker.

Não precisa de Postgres de produto para contas além do que o Auth já cria.
Contas **não** ficam em SQLite/DuckDB.

---

## Papel de cada peça

| Peça | Função |
|------|--------|
| **Supabase Auth** | Única fonte de contas: e-mail/senha, Google, cookies de sessão |
| **Next (`web/`)** | BFF: páginas `/entrar`, `/criar-conta`, callback `/auth/callback`, mint do JWT curto para a API |
| **FastAPI** | Não registra usuário; só valida JWT assinado com `AUTH_SECRET` (após login Supabase) |

Fluxo Google:

1. Next chama `signInWithOAuth` com `redirectTo = {ORIGIN}/auth/callback` (**sem** query string).
2. Destino pós-login (`/macro`, etc.) vai no cookie httpOnly `nonio_oauth_next`.
3. `/auth/callback` troca `?code=` por sessão e redireciona para esse destino.
4. Se o code cair em `/` (site URL), a landing encaminha para `/auth/callback`.

---

## 1. Projeto no dashboard

1. Criar (ou usar) um projeto em [supabase.com](https://supabase.com).
2. **Project Settings → API**: copiar
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` **ou** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. Service role (**só servidor**, nunca no browser) → `SUPABASE_SERVICE_ROLE_KEY` se ainda for usada em algum job admin; o login de produto não precisa dela no client.

---

## 2. Auth → URL Configuration

**Site URL** (produção):

```text
https://SEU_DOMINIO
```

**Redirect URLs** — match **exato**. Incluir só paths sem `?next=...` (query na allowlist quebra e o code volta no Site URL).

Produção (exemplo):

```text
https://SEU_DOMINIO
https://SEU_DOMINIO/auth/callback
```

Preview Vercel (se usar):

```text
https://*.vercel.app/auth/callback
```

(Confirmar se o painel aceita wildcard; senão listar URLs de preview explícitas.)

Dev local (já no `supabase/config.toml`; no cloud só se for testar o projeto remoto a partir da máquina):

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/auth/callback
http://localhost:3000
http://localhost:3000/auth/callback
```

Preferir **um** host no browser (`127.0.0.1` **ou** `localhost`) — cookies e HMR não misturam bem.

---

## 3. Auth → Providers → Email

- Enable Email provider.
- **Confirm email**: ligar em produção (local costuma estar mais permissivo).
- Templates de e-mail (confirm / reset): links devem cair em `{SITE}/auth/callback` (o app grava o destino em cookie antes de mandar o mail).

Regras de senha no app (front + `criarConta`): alinhadas a `web/src/lib/senha.ts` — manter o mínimo do Auth compatível (hoje local: `minimum_password_length = 6`; o produto pede regras mais fortes na UI).

---

## 4. Auth → Providers → Google

1. No [Google Cloud Console](https://console.cloud.google.com/): OAuth 2.0 Client (Web).
2. **Authorized redirect URIs** do Google (importante: é o callback do *Supabase*, não o do Next):

   **Produção (Supabase cloud):**

   ```text
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```

   **Local (Supabase CLI):**

   ```text
   http://127.0.0.1:54321/auth/v1/callback
   ```

3. Colar Client ID + Secret em **Supabase → Authentication → Providers → Google**.
4. No app Next, o botão “Continuar com Google” só aparece se existirem também:

   ```text
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

   (mesmos valores; gate de UI em `web/src/app/entrar/page.tsx`. O OAuth de verdade é o do Supabase.)

---

## 5. Variáveis de ambiente

### Vercel / hosting do `web`

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # ou PUBLISHABLE_KEY
AUTH_SECRET=<openssl rand -base64 32>        # ≥32 chars; sem placeholder
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
NONIO_API_URL=https://api.SEU_DOMINIO        # se a FastAPI estiver ligada
```

### Backend FastAPI (mesmo `AUTH_SECRET`)

```text
AUTH_SECRET=<idêntico ao do Next>
```

Sem `AUTH_SECRET` forte, o Next **não assina** o JWT da API (`web/src/lib/api/access-token.ts`).

### Local (`web/.env.local`)

Mesmas chaves apontando para o projeto cloud **ou** para `http://127.0.0.1:54321` após `npx supabase start`.  
Google local: `supabase/.env` com `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SECRET` (ver `supabase/config.toml`).

---

## 6. Regras de produto (já no código)

- **Um e-mail = uma conta.**
- Senha e Google **não** devem compartilhar o mesmo e-mail: se o usuário tiver as duas identities, `/auth/callback` faz `signOut` e manda para `/entrar?erro=email-senha`.
- No dashboard: **Manual linking** desligado (local: `enable_manual_linking = false`) para não juntar identidades automaticamente sem querer.
- Mensagens de “e-mail já existe” são genéricas (sem enumerar Google vs senha).

---

## 7. Checklist rápido (produção)

- [ ] Site URL = domínio canônico do app  
- [ ] Redirect URLs incluem `https://dominio/auth/callback` (sem query)  
- [ ] Google provider ON + redirect URI `https://<ref>.supabase.co/auth/v1/callback` no Google Cloud  
- [ ] Email confirm / reset testados  
- [ ] `NEXT_PUBLIC_SUPABASE_*` + `AUTH_SECRET` + `AUTH_GOOGLE_*` no host do Next  
- [ ] Mesmo `AUTH_SECRET` na FastAPI  
- [ ] Testar: criar conta e-mail → entrar → Google (e-mail novo) → sair → Google de novo → deve ir a `/macro` (ou `de`), não voltar a `/entrar` nem cair na landing com `?code=`

---

## 8. Arquivos de referência no repo

| Arquivo | O quê |
|---------|--------|
| `web/src/lib/sessao.ts` | login, signup, Google, cookies de destino |
| `web/src/app/auth/callback/route.ts` | troca de `code` → sessão + redirect |
| `web/src/lib/supabase/*` | clients SSR / proxy |
| `web/src/proxy.ts` | refresh de sessão + rotas protegidas |
| `supabase/config.toml` | espelho local das URLs / Google |
| `.env.example` | comentários de env |

---

## 9. Armadilhas já vistas

1. **`redirectTo` com `?next=/macro`** → URL não está na allowlist → code em `/?code=` → parece “login falhou / caiu na landing”. Destino deve ir em cookie; callback limpo.
2. **Cookies da sessão não no `NextResponse.redirect`** → callback “ok”, `/macro` sem sessão → bounce para `/entrar?de=/macro`.
3. **Misturar `localhost` e `127.0.0.1`** → cookie/HMR quebrados; botões client “mortos”.
