# Meu Lava Rápido 🚿🚗

Aplicativo de **controle de lavagens e estética automotiva**, pronto para publicação nas lojas.
Banco de dados **online (PostgreSQL)**, plano **gratuito com anúncios** e plano **Premium por assinatura**.

> Projeto novo e independente. A pasta `DOCUMENTACAO_COMPLETA.md` serviu apenas como referência de
> regras de negócio — este app não reutiliza nome, marca nem código de projetos anteriores.

```
MeuLavaRapido/
├── backend/    → API Node.js + Express + PostgreSQL (Docker/Easypanel)
├── mobile/     → App Expo (SDK 56) + expo-router + NativeWind + Zustand
└── DOCUMENTACAO_COMPLETA.md (referência de negócio)
```

---

## 1. Visão geral

| Recurso | Grátis | Premium (R$ 19,90/mês · R$ 119,90/ano) |
|---|---|---|
| Lavagens por dia | até **5/dia** (depois exige vídeo) | **ilimitado** |
| Recibos | **5** (depois exige vídeo) | **ilimitado** |
| Orçamentos | **5** (depois exige vídeo) | **ilimitado** |
| Anúncios | sim (vídeo recompensado) | **sem anúncios** |
| Clientes, veículos, fornecedores, despesas, agenda | ✔ | ✔ |
| Dados na nuvem (PostgreSQL) | ✔ | ✔ |

Funcionalidades: login/cadastro, dados editáveis da lavagem (nome, CNPJ, endereço, e-mail,
Instagram, contato — usados nos recibos), serviços e valores editáveis, registro de lavagens,
emissão de **recibos e orçamentos em PDF**, clientes + veículos, **fornecedores** (com pedido por
WhatsApp), despesas, importação do **backup JSON** do app antigo, "Contate o desenvolvedor".

---

## 2. Backend (API + PostgreSQL)

### Rodar local
```bash
cd backend
cp .env.example .env      # ajuste DB_* e JWT_SECRET
npm install
npm start                 # aplica o schema automaticamente e sobe na porta 3000
```

### Deploy no Easypanel (Hostinger VPS)
1. **Crie um serviço PostgreSQL** no Easypanel. Anote host interno, usuário, senha e database.
2. **Crie um serviço App** apontando para a pasta `backend/` (tem `Dockerfile`).
3. Configure as variáveis de ambiente do serviço App (ver `.env.example`):
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `PORT=3000`.
4. Faça o deploy. No boot, o servidor cria as tabelas sozinho (`schema.sql`, idempotente).
5. Copie a URL pública gerada e use no app (`EXPO_PUBLIC_API_URL`).

### Principais rotas (`/api`)
`POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `GET|PUT /company` ·
`GET|POST|PUT|DELETE /services` · `/clients` (+ `/:id/vehicles`) · `/washes` · `/schedules` ·
`/suppliers` · `/expenses` · `/documents` (recibos/orçamentos + `/usage`) ·
`/subscription` (status/activate/webhook) · `/dashboard` · `POST /import` · `/support/message`.

Resposta sempre no envelope `{ success, message, data }`. Auth via `Bearer <JWT>`.

---

## 3. App mobile (Expo)

```bash
cd mobile
cp .env.example .env       # defina EXPO_PUBLIC_API_URL (IP da máquina, não "localhost")
npm install
node scripts/generate-assets.js   # (opcional) regenera ícones a partir da logo
npx expo start -c
```

> Os recursos nativos de **anúncios** (AdMob) e **assinatura** (RevenueCat) **não rodam no Expo Go**.
> No Expo Go o app funciona e o fluxo é simulado (libera a ação sem vídeo real). Para testar de verdade,
> gere um **dev client**: `npx expo run:android` ou `eas build --profile development`.

### Build de produção
```bash
npm i -g eas-cli
eas login
eas init                   # gera o projectId (cole em app.json > extra.eas.projectId)
eas build -p android --profile production   # .aab para a Play Store
eas build -p ios --profile production       # para a App Store
```

---

## 4. Monetização — guia prático

### 4.1 Anúncios na versão grátis (onde encontrar e como funciona)
A forma padrão e mais rentável para apps é o **Google AdMob** (gratuito para se cadastrar):
- Site: <https://admob.google.com> → crie uma conta → **Apps → Add app** → **Ad units**.
- Tipos de anúncio e quando usar:
  - **Recompensado (Rewarded) — é o que este app usa.** O usuário assiste um vídeo curto e ganha
    a ação (registrar lavagem / emitir recibo acima do limite). É o de **maior CPM** e o menos intrusivo.
  - **Intersticial:** tela cheia entre ações. Bom para telas de transição (pode adicionar depois).
  - **Banner:** faixa fixa. Menor retorno; opcional no rodapé de listas.
- Como ligar no app:
  1. Em `mobile/.env`, preencha `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID` e `_IOS` com os IDs das suas
     unidades **Recompensado** (em DEV ficam vazios → usa os IDs de **teste** do Google).
  2. Em `mobile/app.json` → plugin `react-native-google-mobile-ads`, troque `androidAppId`/`iosAppId`
     pelos IDs do **app** no AdMob (hoje estão os de teste oficiais).
  3. Gere um build (dev client ou produção). Pronto: o vídeo real aparece ao estourar o limite grátis.
- Alternativas/mediação (mais receita combinando redes): **AdMob Mediation**, **AppLovin MAX**,
  **Meta Audience Network**, **Unity Ads**, **ironSource**.

A lógica de limite e de "quando pedir o vídeo" já está pronta:
`mobile/src/lib/services/ads.ts` (exibição) + `gate.ts` (decisão) + backend `utils/plan.js` (contagem).

### 4.2 Assinatura Premium (sem anúncios)
As lojas **exigem** que assinaturas digitais sejam vendidas por **in-app purchase**. Use o **RevenueCat**
(gratuito até US$ 2,5k/mês de receita) que unifica App Store + Play Store:
- Site: <https://www.revenuecat.com>.
1. Crie os produtos nas lojas:
   - `meulavarapido_premium_monthly` → R$ 19,90/mês
   - `meulavarapido_premium_yearly` → R$ 119,90/ano
2. No RevenueCat: crie o **entitlement `premium`** e um **offering** com esses produtos.
3. Em `mobile/.env`, preencha `EXPO_PUBLIC_RC_ANDROID_KEY` / `EXPO_PUBLIC_RC_IOS_KEY`.
4. Configure o **webhook** do RevenueCat → `POST {API_URL}/api/subscription/webhook`
   (defina `REVENUECAT_WEBHOOK_SECRET` no backend; `app_user_id` = id do owner, já enviado pelo app).

Sem as chaves configuradas, o botão "Assinar" usa o **modo manual** (`/subscription/activate`) só para
testar a liberação do Premium durante o desenvolvimento.

Arquivos: `mobile/src/lib/services/subscription.ts`, `mobile/app/premium.tsx`, backend `routes/subscription.js`.

---

## 5. Migração do app antigo (backup JSON)
No app: **Ajustes → Importar backup (JSON)** e selecione o arquivo exportado pelo app local.
O backend (`/api/import`) mapeia os IDs antigos, converte os timestamps e insere na sua conta na nuvem,
**sem apagar** o que já existe. Movimentos internos de ajudante do app antigo são ignorados.

---

## 6. Checklist para publicar
- [ ] Backend no Easypanel + PostgreSQL provisionado e `JWT_SECRET` forte.
- [ ] `EXPO_PUBLIC_API_URL` apontando para a URL pública (HTTPS).
- [ ] `app.json`: `extra.eas.projectId`, `bundleIdentifier`/`package` definitivos.
- [ ] AdMob: app IDs + unidades recompensado reais.
- [ ] RevenueCat: produtos, entitlement, chaves e webhook.
- [ ] Ícones finais (exportar `assets/logo.svg` em alta resolução se quiser mais nitidez).
- [ ] Política de privacidade e termos (exigidos pelas lojas por causa de anúncios/assinatura).
```
