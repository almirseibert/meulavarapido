# Meu Lava Rápido — Guia de Manutenção

> Documento técnico para manutenção e evolução do app. Atualizado em **27/06/2026**, já
> contemplando: modelo de **trial de 14 dias + paywall**, **verificação de telefone (Firebase)**
> e **importação só para Premium**. Para a história/visão de produto original, ver
> `DOCUMENTACAO_COMPLETA.md` e `README.md`.

---

## 1. Visão geral

App de **gestão de lava-rápido / estética automotiva**: lavagens, clientes (com veículos),
recibos/orçamentos em PDF, despesas, fornecedores, colaboradores (diárias/vales), agendamentos,
tele-busca (busca e entrega de veículos), CRM de recuperação de clientes e relatórios.

Multi-tenant: cada conta (`owner`) é um lava-rápido isolado, com seus próprios dados.

**Monetização:** trial completo de **14 dias** no cadastro (sem cartão). Após o teste, o app fica
**somente leitura** até o usuário assinar o **Premium** (R$ 49,90/mês ou R$ 499,90/ano via
loja/RevenueCat).

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js (≥20) + Express 4, PostgreSQL (driver `pg`) |
| Auth backend | JWT (`jsonwebtoken`) + `bcryptjs` |
| Verificação telefone | Firebase Admin (valida o ID token do Phone Auth) |
| App | React Native 0.85 + Expo SDK 56 + expo-router |
| Estado (app) | Zustand |
| Estilo (app) | NativeWind (Tailwind) |
| HTTP (app) | axios |
| Assinatura | RevenueCat (`react-native-purchases`) — IAP App Store/Play |
| Telefone (app) | `@react-native-firebase/app` + `/auth` (Phone Auth) |
| PDF | `expo-print` + `expo-sharing` |
| Notificação local | `expo-notifications` (tele-busca) |

---

## 3. Estrutura de pastas

```
MeuLavaRapido/
├── backend/
│   ├── db/schema.sql            # schema completo (idempotente, aplicado no boot)
│   ├── src/
│   │   ├── server.js            # bootstrap Express + monta routers + migrate no start
│   │   ├── db.js                # pool pg + query() + withTransaction()
│   │   ├── scripts/migrate.js   # aplica schema.sql (npm run migrate ou no boot)
│   │   ├── middleware/auth.js   # requireAuth, requireActiveAccess, requirePremium
│   │   ├── utils/
│   │   │   ├── access.js        # computeAccess(): trial/premium -> hasAccess
│   │   │   ├── plan.js          # usageSummary() + contadores (sem limites/anúncios)
│   │   │   ├── firebase.js      # verifyPhoneToken() (lazy: só se FIREBASE_* setado)
│   │   │   └── http.js          # ok()/fail()/wrap() (envelope padrão de resposta)
│   │   └── routes/              # um arquivo por recurso (ver §6)
│   └── .env.example
└── mobile/
    ├── app/                     # rotas (expo-router, file-based)
    │   ├── _layout.tsx          # root: fontes, restore() de sessão, Stack
    │   ├── index.tsx            # redireciona p/ (auth) ou (app)
    │   ├── premium.tsx          # tela de assinatura (modal)
    │   ├── (auth)/              # login, register (cadastro 2 passos + telefone)
    │   └── (app)/               # área logada (Tabs): index, washes, schedule,
    │                            #   clients, documents, expenses, settings + telas link
    ├── src/
    │   ├── components/          # ui.tsx, Logo.tsx, ClientPicker.tsx, AccessBanner.tsx
    │   └── lib/
    │       ├── api.ts           # axios + token + interceptor (402 -> /premium)
    │       ├── types.ts         # tipos compartilhados (Owner, Wash, Client, ...)
    │       ├── stores/          # auth.ts (sessão), app.ts (company/services)
    │       └── services/        # subscription.ts, phoneAuth.ts, receipt.ts, report.ts, notify.ts
    ├── app.json                 # config Expo (package, plugins, googleServicesFile)
    ├── eas.json                 # perfis de build EAS
    ├── .easignore               # impede subir android/ios local para o EAS (ver §9)
    └── .env.example
```

> ⚠️ As pastas `mobile/android` e `mobile/ios` são **geradas** (gitignored). Não edite à mão e
> não as suba ao EAS — ver §9.

---

## 4. Modelo de acesso (núcleo da monetização)

Conceito central, em `backend/src/utils/access.js` → `computeAccess(owner)`:

```
isPremium    = plan === 'premium' && (premium_until nulo ou futuro)
trialActive  = !isPremium && now() < trial_ends_at
hasAccess    = isPremium || trialActive
trialDaysLeft= dias inteiros restantes do trial (>= 0)
```

- `requireAuth` (middleware) popula `req.owner` com esses campos.
- `requireActiveAccess`: bloqueia **escrita** (qualquer método ≠ GET/HEAD) com **HTTP 402**
  `{ requiresSubscription: true }` quando `!hasAccess`. Leitura continua liberada → app fica
  **somente leitura** após o trial.
- `requirePremium`: exige `isPremium` (o trial NÃO basta). Usado só em `POST /api/import`.

No app: `AccessBanner` (em `src/components`) mostra a contagem do trial ou o aviso de bloqueio;
o interceptor do axios (`src/lib/api.ts`) redireciona para `/premium` ao receber `402
requiresSubscription`.

**Onde mexer para mudar a regra:**
- Dias de trial: no cadastro (`backend/src/routes/auth.js`, `now() + interval '14 days'`) e no
  backfill do `schema.sql`.
- Preços: `backend/src/routes/subscription.js` (`PLANS`) **e** os fallbacks em
  `mobile/app/premium.tsx`. Os preços reais de cobrança são definidos nos produtos da loja/RevenueCat.
- O que fica bloqueado após o trial: middleware `requireActiveAccess` está aplicado nos routers de
  escrita (ver §6). Para liberar/retirar de um recurso, ajuste o `router.use(...)` do arquivo.

---

## 5. Banco de dados (PostgreSQL)

Schema único e **idempotente** em `backend/db/schema.sql`, aplicado automaticamente no boot
(`server.js` → `migrate()`), usando `CREATE TABLE IF NOT EXISTS` e `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

Tabelas: `owners`, `company_settings`, `services`, `clients`, `vehicles`, `washes`, `schedules`,
`suppliers`, `expenses`, `helpers`, `crm_settings`, `crm_callbacks`, `documents`.

**Colunas relevantes a esta fase (`owners`):**
- `plan` (`'free'|'premium'`), `premium_until` (timestamptz)
- `trial_ends_at` (timestamptz) — fim do teste de 14 dias
- `phone` (E.164), `phone_verified` (bool), `firebase_uid` (texto)

**Índices anti-abuso:**
- `uq_owners_phone` — telefone único entre contas
- `uq_company_document` — CNPJ/CPF único (compara só dígitos, via `regexp_replace`)

> ⚠️ Na 1ª aplicação do schema, se já existirem **dois `company_settings` com o mesmo
> documento**, a criação de `uq_company_document` falha. Com base pequena é improvável; se
> ocorrer, deduplicar antes. O `server.js` engole o erro de migrate e segue subindo, então o
> índice pode não ser criado — confira o log `[migrate]`/`[boot]`.

Migração manual: `cd backend && npm run migrate`.

---

## 6. Backend — rotas (todas sob `/api`)

Autenticação: JWT no header `Authorization: Bearer <token>`. Envelope de resposta padrão:
`{ success, message, data }` (helpers `ok`/`fail` em `utils/http.js`).

Legenda do gate: **[Auth]** exige login · **[Esc]** = `requireActiveAccess` (bloqueia escrita pós-trial)
· **[Prem]** = `requirePremium`.

| Recurso | Endpoints | Gate |
|---|---|---|
| `auth` | POST `/register`, POST `/login`, GET `/me`, PUT `/me` | público (register/login); `/me` [Auth] |
| `subscription` | GET `/plans` (público), GET `/status`, POST `/activate`, POST `/webhook` (RevenueCat) | [Auth] exceto plans/webhook |
| `company` | GET `/`, PUT `/` (valida CNPJ/CPF único) | [Auth][Esc] |
| `services` | GET, POST, PUT `/:id`, DELETE `/:id` | [Auth][Esc] |
| `clients` | GET, POST, PUT `/:id`, DELETE `/:id`, POST `/:id/vehicles`, PUT `/vehicles/:vehicleId`, DELETE `/vehicles/:vehicleId` | [Auth][Esc] |
| `washes` | GET, POST `/settle`, POST `/`, PUT `/:id`, PATCH `/:id/charge`, PATCH `/:id/pickup-status`, DELETE `/:id` | [Auth][Esc] |
| `schedules` | GET, POST, PUT `/:id`, DELETE `/:id` | [Auth][Esc] |
| `documents` | GET `/usage`, GET `/`, POST `/` (recibo/orçamento) | [Auth][Esc] |
| `expenses` | GET, POST, PUT `/:id`, DELETE `/:id` | [Auth][Esc] |
| `suppliers` | GET, POST, PUT `/:id`, DELETE `/:id` | [Auth][Esc] |
| `helpers` | GET, POST, PUT `/:id`, PATCH `/:id/active`, DELETE `/:id` | [Auth][Esc] |
| `crm` | GET/PUT `/settings`, GET `/inactive`, POST `/:clientId/contact`, POST `/:clientId/ignore` | [Auth][Esc] |
| `import` | POST `/` (importa backup JSON do app antigo) | [Auth][Prem] |
| `dashboard` | GET `/` (KPIs do mês) | [Auth] |
| `reports` | GET `/washes`, GET `/by-vehicle`, GET `/open` | [Auth] |
| `support` | GET `/contact`, POST `/message` | misto |

O webhook do RevenueCat usa **corpo cru** (tratado especial em `server.js`) e é a fonte da verdade
das renovações/cancelamentos em produção (`app_user_id` = `owners.id`).

---

## 7. Como rodar — Backend

```
cd backend
cp .env.example .env     # preencher (ver §11)
npm install
npm run migrate          # opcional; o start já migra
npm run dev              # node --watch  (ou: npm start)
```

Conexão: usa `DATABASE_URL` se presente; senão `DB_HOST/PORT/USER/PASSWORD/NAME` (ver `db.js`).
Health: `GET /` e `GET /api/health`.

**Deploy:** push na branch `main` → EasyPanel (Hostinger VPS) faz o redeploy. O schema é aplicado
no boot. Variáveis ficam no painel do serviço.

---

## 8. Como rodar — App (mobile)

```
cd mobile
cp .env.example .env     # definir EXPO_PUBLIC_API_URL (IP da máquina, não localhost)
npm install
```

**Dois caminhos de build (não misture — ver §9):**

- **Local (dev build no emulador/celular):**
  ```
  npx expo prebuild        # gera android/ na sua máquina
  npx expo run:android     # compila e instala
  ```
  Módulos nativos novos (Firebase, RevenueCat, notifications) **não rodam no Expo Go** — precisa do
  dev build.

- **Nuvem (EAS):**
  ```
  eas build -p android --profile preview      # APK instalável
  ```
  O EAS faz o `prebuild` no servidor. **Não** dependa da `android/` local (ela é ignorada via
  `.easignore`).

Perfis em `eas.json`: `development` (dev client), `preview` (APK interno), `production` (app-bundle,
autoIncrement).

---

## 9. Build nativo, prebuild e `.easignore` (importante!)

- `mobile/android` e `mobile/ios` são **geradas** por `expo prebuild` a partir do `app.json` +
  config plugins. São gitignored.
- A pasta `android/` gerada no **Windows** contém **caminhos absolutos** (`F:\...`) no autolinking.
  Se ela for enviada ao EAS (Linux), o build quebra com erro do tipo *"Configuring project
  ':react-native-firebase_auth' without an existing directory ... F:/..."*.
- Solução já aplicada: **`mobile/.easignore`** exclui `android/` e `ios/` do upload, forçando o EAS
  a fazer um prebuild limpo. Mantenha esse arquivo.
- Regra prática: **build local** → pode rodar `expo prebuild`. **Build EAS** → deixe o servidor
  prebuildar; nunca conte com a `android/` local.
- Trocou `package`/`bundleIdentifier` ou plugins no `app.json`? Rode `npx expo prebuild --clean`
  localmente (apaga e recria nativo) antes do `expo run:android`.

---

## 10. Firebase Phone Auth (verificação de telefone)

**Por quê:** anti-abuso. Telefone é mais difícil de multiplicar que e-mail, então cada número só
pode ter uma conta (índice `uq_owners_phone`) e é confirmado por código SMS no cadastro.

**Fluxo:**
1. App (`app/(auth)/register.tsx`): coleta nome/e-mail/senha/telefone → `services/phoneAuth.ts`
   chama `signInWithPhoneNumber` (Firebase) → usuário digita o código → obtém o **ID token**.
2. `register(..., { firebaseIdToken })` envia o token ao backend.
3. Backend (`routes/auth.js`): `utils/firebase.js` → `verifyPhoneToken()` valida o token com
   `firebase-admin`, extrai o telefone (E.164), checa unicidade e cria a conta com trial de 14 dias.

**Modo dev (sem Firebase):** se as `FIREBASE_*` não estiverem no backend, o cadastro aceita o
telefone **sem verificar** (e o app no Expo Go também cai nesse fallback). Assim dá para desenvolver
sem Firebase; ao configurar, a verificação passa a ser obrigatória.

**Setup (resumo):**
1. Firebase Console → criar projeto → Authentication → habilitar **Phone**.
2. Cadastrar **números de teste** (código fixo, sem custo) para desenvolvimento.
3. Registrar app Android com package **`com.studiomythos.meulavarapido`** + **SHA-1**
   (`cd android && ./gradlew signingReport`, ou via `eas credentials`); baixar
   **`google-services.json`** → `mobile/google-services.json`.
4. (iOS) registrar bundle `com.studiomythos.meulavarapido`, baixar **`GoogleService-Info.plist`** →
   `mobile/`, e configurar **APNs**.
5. Backend: Configurações do projeto → Contas de serviço → gerar chave privada → preencher
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (com `\n` escapados, entre aspas).
6. Gerar novo build (`npx expo prebuild --clean && expo run:android`, ou `eas build`).

> O `package`/`bundleIdentifier` no `app.json` **tem que ser igual** ao registrado no Firebase.

---

## 11. Variáveis de ambiente

**Backend (`backend/.env`):**

| Var | Uso |
|---|---|
| `DATABASE_URL` *(ou)* `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` | Conexão Postgres |
| `DB_SSL` | `true` p/ SSL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth (token) |
| `PORT` | Porta do servidor (3000) |
| `REVENUECAT_WEBHOOK_SECRET` | Valida o webhook RevenueCat (opcional) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Verificação de telefone (sem isso = modo dev) |

**App (`mobile/.env`):**

| Var | Uso |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL do backend (em DEV, IP da máquina; nunca `localhost`) |
| `EXPO_PUBLIC_RC_ANDROID_KEY` / `EXPO_PUBLIC_RC_IOS_KEY` | Chaves públicas RevenueCat (vazio = modo manual de ativação) |

A config do Firebase no app vem dos arquivos nativos (`google-services.json` /
`GoogleService-Info.plist`), referenciados no `app.json` — **não** há env para isso.

---

## 12. Assinatura / RevenueCat

- `mobile/src/lib/services/subscription.ts`: `getPlans()`, `purchase('monthly'|'yearly')`,
  `restore()`, `configurePurchases(ownerId)`.
- Sem chaves RC (DEV/Expo Go), `purchase()` cai no **modo manual**: chama
  `POST /api/subscription/activate` (ativa premium no backend para testar).
- Produção: criar produtos `meulavarapido_premium_monthly` (R$ 49,90) e
  `meulavarapido_premium_yearly` (R$ 499,90) na App Store Connect / Play Console; entitlement
  `premium` no RevenueCat; webhook apontando para `POST {API}/api/subscription/webhook`.
- **Trocar preço** exige atualizar em 3 lugares: produto na loja/RevenueCat, `PLANS` no backend e
  os fallbacks em `premium.tsx`.

---

## 13. Receitas de manutenção (tarefas comuns)

- **Mudar dias de trial:** `routes/auth.js` (`interval '14 days'`) + backfill no `schema.sql`.
- **Mudar preço:** §12 (3 lugares).
- **Adicionar campo a um recurso:** coluna no `schema.sql` (`ADD COLUMN IF NOT EXISTS`) → incluir no
  INSERT/UPDATE da rota → adicionar ao tipo em `mobile/src/lib/types.ts` → ao form/tela.
  *(Ex. recente: campo `observations` na lavagem — `washes.tsx`.)*
- **Nova rota/recurso:** criar `routes/<x>.js` com `router.use(requireAuth, requireActiveAccess)`
  (se tiver escrita) → montar em `server.js` (`app.use('/api/<x>', require('./routes/<x>'))`).
- **Gatear algo só para Premium:** aplicar `requirePremium` no router (modelo: `importData.js`) +
  esconder/condicionar no app (modelo: importar JSON em `settings.tsx`).
- **Seleção cliente/veículo:** componente único `src/components/ClientPicker.tsx`
  (`ClientVehiclePicker`), reutilizado em lavagem/agenda/documentos/tele-busca.
- **PDF de recibo/orçamento/relatório:** `src/lib/services/receipt.ts` e `report.ts`.

---

## 14. Pontos de atenção (gotchas)

- **Não comitar `android/`/`ios/`** nem deixá-las irem ao EAS (ver §9).
- **`package`/`bundleIdentifier`** devem casar com o Firebase e são **permanentes** após publicar na
  loja. Atual: `com.studiomythos.meulavarapido`.
- **`firebase-admin`** é carregado de forma **lazy** no backend (só quando `FIREBASE_*` existe). Sem
  as variáveis, o cadastro fica em modo dev (telefone não verificado) — não esquecer de configurar
  em produção.
- **`schema.sql` roda inteiro a cada boot**; toda alteração deve ser idempotente
  (`IF NOT EXISTS`). Evite `CREATE UNIQUE INDEX` que possa falhar com dados existentes (ver §5).
- **AdMob foi removido.** O antigo modelo grátis+anúncios não existe mais; `ads.ts`/`gate.ts` foram
  apagados e os limites (`FREE_LIMITS`) também.
- **`documents.via_ad`** ficou como coluna legada (sempre `false`); pode ser removida numa limpeza futura.
- Em DEV use sempre o **IP da máquina** em `EXPO_PUBLIC_API_URL`, não `localhost`.

---

## 15. Histórico de mudanças relevantes (jun/2026)

- CRM/recuperação de clientes, tele-busca, colaboradores, relatórios, seletor cliente/veículo,
  filtros + baixa em lote (ver `DOCUMENTACAO_COMPLETA.md`).
- **Troca de monetização**: grátis+anúncios → **trial 14d + paywall** (somente leitura pós-trial);
  preços R$ 49,90/mês e R$ 499,90/ano.
- **Anti-abuso**: telefone único e verificado (Firebase Phone Auth) + CNPJ/CPF único.
- **Importar JSON** restrito a assinantes Premium.
- Campo **observações** na lavagem; correção da **seleção de veículo** quando o cliente tem vários.
