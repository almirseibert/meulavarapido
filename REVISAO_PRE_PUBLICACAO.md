# Revisão do App — Pendências para Alteração

> Revisão técnica de **Meu Lava Rápido** feita em **15/10/2026** no branch `main` (commit `2fed4a6`).
> Documento de trabalho: cada item tem arquivo, linha e ação sugerida.
> **Atualizado em 15/10/2026:** aplicados o **item 1** (contatos da Mak Serviços, §1) e as
> **manutenções da §7** (baixa de lavagens faturadas + ativação automática da assinatura,
> que também resolveram os itens 3.1 e 4.2). Os demais itens seguem pendentes.
> ⚠️ A §7.4 lista as variáveis de ambiente que **ainda precisam ser criadas no EasyPanel**.

---

## 0. Resumo executivo

| Prioridade | Assunto | Itens |
|---|---|---|
| ✅ Resolvido | Contato Mak Serviços exposto no app e nos textos da loja | 9 |
| ✅ Resolvido | Exigências do Google Play (exclusão de conta, política no app) — §9 | 3 |
| 🟠 Alto (segurança) | Sem rate limit no login, CORS aberto, sem helmet (webhook ✅ resolvido em §7.3) | 3 |
| 🟡 Médio | Robustez do backend (migrate silencioso; suporte ✅ em §8, UUID ✅ em §7.3) | 2 |
| 🔵 Baixo / melhoria | Documentação, iOS, chave do RevenueCat no eas.json | 5 |
| ✅ Resolvido | Baixa de lavagens faturadas e ativação automática da assinatura (§7) | 2 |

---

## 1. ✅ Remoção de qualquer contato da Mak Serviços — **APLICADO em 15/10/2026**

Requisito: **nenhum contato com a Mak Serviços pode aparecer em aplicativos publicados no
Google Play.** O identificador do pacote já estava migrado para `com.studiomythos.meulavarapido`;
o que restava era e-mail e nome da empresa. Tudo removido.

Contato definido para substituição: **Studio Mythos** / **almir.seibert@gmail.com**.

### 1.1 O que foi alterado

| Arquivo | Mudança |
|---|---|
| [backend/src/routes/support.js](backend/src/routes/support.js) | `DEV_CONTACT` não tem mais e-mail embutido: `name` vem de `SUPPORT_NAME` (padrão `Studio Mythos`), `email` de `SUPPORT_EMAIL` **sem fallback** (vazio se não configurado), `whatsapp` de `SUPPORT_WHATSAPP`. |
| [mobile/app/(app)/settings.tsx](mobile/app/(app)/settings.tsx) | A tela "Contate o desenvolvedor" busca o contato em `GET /api/support/contact` ao abrir e só renderiza o link `mailto:` **se o servidor devolver um e-mail**. Nenhum e-mail fica na build. |
| [backend/.env.example](backend/.env.example) | Nova seção documentando `SUPPORT_NAME`, `SUPPORT_EMAIL` e `SUPPORT_WHATSAPP`. |
| [play-store/POLITICA_PRIVACIDADE.md](play-store/POLITICA_PRIVACIDADE.md) | Desenvolvedor, e-mail de exclusão de dados e seção "Contato" atualizados. |
| [play-store/TEXTOS_LOJA.md](play-store/TEXTOS_LOJA.md) | E-mail da ficha, referência ao site e exemplo de URL de privacidade (não aponta mais para `makservicos.com`). |
| [play-store/MANUAL_PUBLICACAO.md](play-store/MANUAL_PUBLICACAO.md) | Package corrigido para `com.studiomythos.meulavarapido` e os dois e-mails de contato atualizados. |

### 1.2 ⚠️ Ação obrigatória no deploy

A tela do app agora depende do servidor. **Definir no EasyPanel** antes de publicar:

```
SUPPORT_NAME=Studio Mythos
SUPPORT_EMAIL=almir.seibert@gmail.com
SUPPORT_WHATSAPP=
```

Sem `SUPPORT_EMAIL`, o app simplesmente não exibe o link de e-mail (o formulário de
mensagem continua funcionando). Isso é proposital: é o que garante que nenhum contato
errado possa reaparecer numa build já publicada.

### 1.3 Verificação

```bash
grep -rni "makservicos\|mak servi" mobile backend play-store --exclude-dir=node_modules
```

Resultado: **vazio**. ✅

### 1.4 🟡 Pendente — worktrees antigos

Duas cópias obsoletas do projeto em `.claude/worktrees/` (`amazing-dirac-cef5d6` e
`relaxed-spence-eca254`) **ainda contêm** o e-mail antigo e, em `relaxed-spence-eca254`,
o package antigo `com.makservicos.meulavarapido` em `mobile/app.json`.

Não entram em nenhuma build a partir de `main`, e não foram tocados aqui por serem
worktrees do git (remoção é destrutiva).

**Ação:** remover os worktrees obsoletos (`git worktree remove`) para eliminar o risco de
alguém gerar um AAB a partir deles. Confirmar também que nenhum APK/AAB já enviado ao Play
veio dessas pastas.

### 1.5 🔵 Pendente — histórico do Git

O e-mail e o package `com.makservicos.*` continuam no **histórico de commits**. Não é
exposto no Google Play (só o AAB é enviado). Só vira problema se o repositório for tornado
público — nesse caso, avaliar reescrita de histórico.

---

## 2. ✅ Exigências do Google Play — **resolvidas em §9**

### 2.1 Exclusão de conta dentro do app — **política obrigatória**

Não existe nenhuma função de excluir conta: não há rota `DELETE /api/auth/me` no backend
([backend/src/routes/auth.js](backend/src/routes/auth.js)) nem opção em Ajustes
([mobile/app/(app)/settings.tsx](mobile/app/(app)/settings.tsx)).

O Google Play exige, para apps que criam conta, que o usuário possa **solicitar a exclusão
da conta e dos dados** — e a política de dados do Console pede a URL/forma de exclusão.
A própria política de privacidade do projeto já reconhece a lacuna
([POLITICA_PRIVACIDADE.md:67](play-store/POLITICA_PRIVACIDADE.md:67): *"Recomendado: também
oferecer a exclusão dentro do app"*).

**Ação:**
1. Backend: `DELETE /api/auth/me` exigindo confirmação de senha, apagando o `owner`
   (o schema já tem `ON DELETE CASCADE` em todas as tabelas, então basta remover a linha de `owners`).
2. App: item "Excluir minha conta" em Ajustes, com diálogo de confirmação dupla e logout.
3. Console: declarar a forma de exclusão na seção "Segurança dos dados".

### 2.2 Política de privacidade e termos não acessíveis no app

Nenhuma tela do app linka a política de privacidade ou os termos de uso (busca por
"privacidade"/"termos" em `mobile/` não retorna nada). A política existe apenas como
arquivo markdown em `play-store/`, **sem URL pública**.

**Ação:**
1. Publicar `POLITICA_PRIVACIDADE.md` numa URL pública (não em domínio da Mak Serviços).
2. Adicionar em Ajustes os links "Política de privacidade" e "Termos de uso".
3. Informar a URL no Google Play Console.

### 2.3 Revisar a política em relação ao que o app realmente faz

A política cita **anúncios e identificadores de publicidade**
([POLITICA_PRIVACIDADE.md:21](play-store/POLITICA_PRIVACIDADE.md:21)), mas o app não tem
anúncios (`utils/plan.js` diz explicitamente "Sem anúncios"). Declarações divergentes do
comportamento real do app são causa comum de **reprovação na revisão**.

**Ação:** remover a menção a anúncios e revisar todos os trechos entre `[ ]` que ainda são
placeholders. Alinhar com o formulário "Segurança dos dados" (coleta de nome, e-mail,
telefone, dados de clientes do usuário, token de push).

---

## 3. 🟠 Segurança

### 3.1 ✅ Webhook do RevenueCat com segredo opcional — **resolvido em §7.3**

[backend/src/routes/subscription.js:81-86](backend/src/routes/subscription.js:81)

```js
const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
if (secret) {                       // <- se não estiver definido, nada é validado
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${secret}`) return fail(res, '...', 401);
}
```

Se `REVENUECAT_WEBHOOK_SECRET` não estiver configurado em produção (e no `.env.example` ele
está **vazio**), qualquer pessoa pode chamar o webhook com um `app_user_id` conhecido e se
tornar premium para sempre. O mesmo endpoint também aceita qualquer valor em
`expiration_at_ms`.

**Ação:**
- Em `NODE_ENV=production`, **recusar** a requisição quando o segredo não estiver definido.
- Validar que `app_user_id` é um UUID existente antes do `UPDATE`.
- Logar os eventos recebidos (auditoria de assinatura).

### 3.2 Sem rate limit em login/cadastro — força bruta

[backend/src/routes/auth.js](backend/src/routes/auth.js) não tem nenhuma limitação de
tentativas. Com `bcrypt` custo 10 e sem throttling, `POST /api/auth/login` é atacável por
força bruta e `POST /api/auth/register` permite criação massiva de contas (que, via Firebase
Phone Auth, gera **custo de SMS**).

**Ação:** adicionar `express-rate-limit` (ex.: 10 tentativas / 15 min por IP em `/login`,
5 / hora em `/register`) e considerar bloqueio progressivo por e-mail.

### 3.3 CORS liberado para qualquer origem

[backend/src/server.js:9](backend/src/server.js:9) — `app.use(cors())` libera todas as
origens. O app mobile não depende de CORS; só uma eventual versão web dependeria.

**Ação:** restringir a origens conhecidas via env (`CORS_ORIGINS`) ou remover o middleware
se não houver cliente web.

### 3.4 Sem cabeçalhos de segurança nem limite de payload consistente

Não há `helmet`. O `express.json({ limit: '5mb' })` protege as rotas normais, mas o webhook
usa `express.json({ type: '*/*' })` **sem limite** ([subscription.js:80](backend/src/routes/subscription.js:80)),
permitindo payloads grandes num endpoint não autenticado.

**Ação:** adicionar `helmet()` e um `limit` explícito no parser do webhook (ex.: `100kb`).

---

## 4. 🟡 Robustez e correção

### 4.1 Falha de migração não impede o boot

[backend/src/server.js:57-61](backend/src/server.js:57) — se `migrate()` falhar, o erro é
apenas logado e o servidor **sobe de qualquer forma**, com schema potencialmente incompleto.
Os erros aparecerão depois como 500 genéricos para o usuário.

**Ação:** em produção, abortar o processo (`process.exit(1)`) quando a migração falhar, para
o EasyPanel reiniciar e o problema ficar visível.

### 4.2 ✅ `app_user_id` inválido derruba o webhook com 500 — **resolvido em §7.3**

[subscription.js:92-103](backend/src/routes/subscription.js:92) — `app_user_id` vai direto
para um `WHERE id = $1` de coluna `UUID`. Um valor não-UUID gera exceção do Postgres →
erro 500 → o RevenueCat reenvia o evento indefinidamente.

**Ação:** validar formato de UUID e responder 200 ("ignorado") para IDs desconhecidos.

### 4.3 ✅ Mensagens de suporte só vão para o log — **resolvido em §8**

[backend/src/routes/support.js:33-35](backend/src/routes/support.js:33) — o `POST /support/message`
apenas faz `console.log` e responde "Mensagem enviada ao desenvolvedor". O app confirma ao
usuário com `Alert` dizendo que foi enviada
([settings.tsx:385](mobile/app/(app)/settings.tsx:385)), mas **ninguém recebe nada**: se o
container reiniciar, a mensagem é perdida.

**Ação:** gravar em tabela `support_messages` (ou enviar por e-mail/webhook). Enquanto não
houver destino real, ajustar o texto para não prometer o que não acontece.

### 4.4 Canal de notificação Android — verificado, OK

[backend/src/utils/push.js:41](backend/src/utils/push.js:41) envia `channelId: 'novidades'` e o
canal é criado no app em [mobile/src/lib/services/notify.ts:65](mobile/src/lib/services/notify.ts:65).
Nenhuma correção necessária — apenas **testar o broadcast em dispositivo real** antes de publicar,
já que o canal só é criado depois que o usuário concede permissão de notificação.

---

## 5. 🔵 Baixo / melhorias

### 5.1 Build iOS quebrada por arquivo ausente

[mobile/app.json:13](mobile/app.json:13) referencia `./GoogleService-Info.plist`, que não
existe no repositório nem está versionado. Sem impacto no Google Play, mas qualquer build
iOS falha. **Ação:** adicionar o arquivo (via EAS secret/file) ou remover a referência enquanto só houver Android.

### 5.2 Chave do RevenueCat versionada em `eas.json`

[mobile/eas.json](mobile/eas.json) traz `EXPO_PUBLIC_RC_ANDROID_KEY` em texto claro. É a
**chave pública** do SDK (projetada para ficar no cliente), então não é vazamento — mas
convém migrar para EAS Secrets para facilitar rotação. Confirmar também que
`EXPO_PUBLIC_RC_IOS_KEY` será definida antes de qualquer build iOS.

### 5.3 Documentação com o package antigo

[MANUTENCAO.md:260, 263, 335](MANUTENCAO.md:260) ainda citam o package como referência de
configuração do Firebase — já está correto (`com.studiomythos.*`), mas revisar junto com o
item 1.3 para manter a documentação coerente após a troca dos contatos.

### 5.4 Ativação manual de premium

[backend/src/routes/subscription.js:42](backend/src/routes/subscription.js:42) e
[mobile/src/lib/services/subscription.ts](mobile/src/lib/services/subscription.ts) já
bloqueiam ativação manual quando `NODE_ENV=production` / `EXPO_PUBLIC_ENV=production`
(corrigido no commit `1246e6b`). **Ação:** confirmar no EasyPanel que `NODE_ENV=production`
está realmente definido — a proteção depende exclusivamente disso.

### 5.5 Pontos positivos (não precisam de ação)

- Multi-tenant consistente: todas as rotas de dados usam `router.use(requireAuth, requireActiveAccess)`
  e filtram por `owner_id`; o schema tem `ON DELETE CASCADE` e índices por `owner_id`.
- Queries 100% parametrizadas — nenhum SQL concatenado com entrada do usuário.
- Senhas com `bcrypt` (custo 10); JWT com expiração; envelope de erro padronizado que não
  vaza stack trace.
- Telefone único por conta, impedindo recriar conta para renovar o trial.
- Admin de broadcast restrito por `ADMIN_EMAILS` (vazio por padrão = ninguém).

---

## 6. Ordem sugerida de execução

1. ~~**Item 1** (contatos Mak Serviços)~~ — **feito**. Resta remover os worktrees antigos (§1.4)
   e definir `SUPPORT_EMAIL` no EasyPanel (§1.2).
2. **Item 2.1 e 2.2** (exclusão de conta + links de privacidade) — bloqueiam a revisão da loja.
3. **Item 3.1** (segredo do webhook) — risco financeiro direto.
4. **Item 2.3** (política alinhada ao app) antes de preencher "Segurança dos dados".
5. **Itens 3.2 a 3.4**, **4.1** e **4.3** — podem entrar na primeira atualização pós-lançamento
   (3.1 e 4.2 convém resolver junto, ainda antes do envio).
6. **Item 5.x** — backlog.

---

## 7. Manutenções aplicadas em 15/10/2026

Duas falhas relatadas em uso real. **As duas tinham a mesma causa de fundo**, descrita em 7.1.

### 7.1 🔴 Causa raiz: conta em somente-leitura porque a assinatura nunca ativava

O backend bloqueia **toda operação de escrita** quando não há trial nem assinatura ativa
([backend/src/middleware/auth.js](backend/src/middleware/auth.js), `requireActiveAccess`
responde 402 para qualquer método que não seja GET/HEAD).

A ativação do premium dependia **exclusivamente** do webhook do RevenueCat. Se o webhook
não dispara, chega com `Authorization` diferente do esperado ou falha, o cliente **paga e
continua sem acesso** — e então nada de escrita funciona, inclusive a baixa de lavagens.
Era isso que fazia o botão "Marcar pago" parecer quebrado.

### 7.2 Baixa de lavagens faturadas

| Problema | Onde | Correção |
|---|---|---|
| A baixa individual engolia o erro: era `api.patch(...).then(...)` sem `.catch`, então um 402 do servidor não produzia nada na tela | [mobile/app/(app)/washes.tsx](mobile/app/(app)/washes.tsx) | Nova função `toggleCharge()` com `try/catch` e `Alert` — o motivo da recusa sempre aparece |
| Editar uma lavagem já baixada **reabria a dívida**: o formulário reenviava `is_charged` derivado da forma de pagamento, e "Faturamento Posterior" voltava para `false` | [mobile/app/(app)/washes.tsx](mobile/app/(app)/washes.tsx) | Ao editar, a baixa é preservada; só recalcula se a forma de pagamento mudou |
| A string `'Faturamento Posterior'` estava repetida | [mobile/src/lib/types.ts](mobile/src/lib/types.ts) | Constante exportada `FATURAMENTO_POSTERIOR` |
| O botão não distinguia a ação pendente | [mobile/app/(app)/washes.tsx](mobile/app/(app)/washes.tsx) | Em aberto mostra **"Dar baixa"** em verde; pago mostra "Pago" em cinza |

A baixa em lote (`POST /api/washes/settle`) já estava correta no backend e já exibia o erro
— era bloqueada pelo 402 descrito em 7.1.

> 🟡 **Decisão de produto em aberto:** hoje a baixa é considerada escrita e fica bloqueada
> quando o acesso expira. Ou seja, quem deixa de assinar não consegue registrar que um
> cliente pagou uma dívida antiga. Se a intenção for liberar a baixa mesmo em
> somente-leitura, é trocar `requireActiveAccess` por `requireAuth` apenas nas rotas
> `POST /washes/settle` e `PATCH /washes/:id/charge`. **Não alterei** por ser regra de
> negócio.

### 7.3 Ativação automática da assinatura

Antes: compra aprovada na loja → app chamava `refresh()` → backend ainda dizia `free`
(o webhook era o único caminho). Agora a confirmação não depende mais do webhook:

| Novo | O que faz |
|---|---|
| [backend/src/utils/revenuecat.js](backend/src/utils/revenuecat.js) | Consulta `GET /v1/subscribers/{app_user_id}` na API do RevenueCat e lê o entitlement `premium` (ativo, data de expiração, produto). Trata 404, erro HTTP, timeout de 10s e assinatura vitalícia. |
| `POST /api/subscription/sync` em [backend/src/routes/subscription.js](backend/src/routes/subscription.js) | Autenticado. Confere a assinatura **da própria conta** (o `app_user_id` é sempre `req.owner.id`, então ninguém herda assinatura de outro) e grava `plan` + `premium_until` na hora. |
| [mobile/src/lib/services/subscription.ts](mobile/src/lib/services/subscription.ts) | `syncSubscription()` e `syncWithRetry()` (3 tentativas, 2s — a loja leva alguns segundos para registrar no RevenueCat). Chamado após a compra e após restaurar. |
| [mobile/app/(app)/_layout.tsx](mobile/app/(app)/_layout.tsx) | Rede de segurança: quem não está premium tem a assinatura reconferida **a cada abertura do app**, então uma compra perdida pelo webhook se resolve sozinha. |
| [mobile/app/premium.tsx](mobile/app/premium.tsx) | Se o pagamento foi aprovado mas o servidor não confirmou, o usuário recebe uma mensagem honesta ("Pagamento recebido, estamos confirmando") em vez de um "Bem-vindo ao Premium" falso. |

Webhook endurecido no mesmo arquivo:

- **Em produção, recusa (503) se `REVENUECAT_WEBHOOK_SECRET` não estiver definido** — antes, sem o segredo, qualquer um podia liberar premium (era o item 3.1 desta revisão).
- Aceita o `Authorization` **com ou sem** o prefixo `Bearer `, que era uma causa provável de 401 silencioso.
- Valida que `app_user_id` é UUID — antes um id anônimo do RevenueCat (`$RCAnonymousID:...`) gerava erro 500 e o RevenueCat reenviava o evento em loop (item 4.2).
- `CANCELLATION` **não** revoga mais o acesso: no RevenueCat significa "não vai renovar", e o acesso vale até a expiração. Quem encerra é `EXPIRATION`. Também trata `REFUND`, `SUBSCRIPTION_PAUSED` e `NON_RENEWING_PURCHASE`.
- Limite de corpo de 100kb (item 3.4) e log de cada evento com o resultado aplicado.

Com isso, os itens **3.1**, **3.4 (parcial)** e **4.2** desta revisão ficam resolvidos.

### 7.4 ⚠️ Variáveis de ambiente — o que falta no EasyPanel

Revisão do `.env` de produção atual:

| Variável | Situação | Ação |
|---|---|---|
| `REVENUECAT_API_KEY` | **Ausente** | 🔴 **Obrigatória.** Sem ela o `/sync` responde 503 e a ativação imediata não funciona. Pegar em RevenueCat → Project settings → API keys → **Secret key** (`sk_...`). Nunca a chave pública `goog_...`. |
| `SUPPORT_NAME`, `SUPPORT_EMAIL` | **Ausentes** | 🔴 Sem elas o app não mostra o e-mail de contato em Ajustes (ver §1.2). |
| `REVENUECAT_WEBHOOK_SECRET` | Definida, mas **com caracteres de risco** | 🟠 O valor atual contém `#`, `&`, `$` e `!`. Em arquivo `.env` lido por dotenv, **o `#` corta o valor** (vira `bM&q3cX8`); em shell, `$U` e `$JaaK` são expandidos e desaparecem. No EasyPanel, injetada como variável real, sobrevive — mas é uma armadilha. **Trocar por hex:** `openssl rand -hex 32`, e colar o mesmo valor no campo Authorization do webhook no RevenueCat. |
| `REVENUECAT_ENTITLEMENT` | Ausente (padrão `premium`) | 🔵 Só definir se o entitlement no RevenueCat não se chamar `premium`. |
| `NODE_ENV=production` | ✅ Correta | Bloqueia a ativação manual **e** passa a exigir o segredo do webhook. |
| `DATABASE_URL` | ✅ Senha corretamente URL-encoded (`%40` = `@`) | — |
| `JWT_SECRET`, `ADMIN_EMAILS`, `EXPO_ACCESS_TOKEN`, `FIREBASE_*` | ✅ Presentes e no formato esperado | — |

**Fora do backend, confirmar no RevenueCat:**
1. **Play Console conectado** ao RevenueCat (credencial de service account) — sem isso o RevenueCat não valida as compras e nem o webhook nem o `/sync` têm o que reportar.
2. Entitlement chamado `premium`, com os produtos `meulavarapido_premium_monthly` e `meulavarapido_premium_yearly` num offering.
3. Webhook apontando para `{API}/api/subscription/webhook` com o Authorization igual ao `REVENUECAT_WEBHOOK_SECRET`.

### 7.5 O que não foi verificado

- `mobile/node_modules` e `backend/node_modules` não estão instalados: os arquivos TS/TSX passaram por checagem de **sintaxe** (`tsc --noResolve`), não por typecheck completo.
- `backend/src/utils/revenuecat.js` tem cobertura de teste com a API simulada (11 casos: mensal, anual, vitalícia, expirada, sem entitlement, 404, erro HTTP, sem chave) — todos passando.
- A rota `/sync` e o webhook foram revisados e validados por sintaxe, mas **não executados** (sem dependências e sem banco). Testar em staging antes de confiar.
- O fluxo real de compra só pode ser validado com uma **compra de teste na Play Store** (licença de teste no Play Console), em build de produção — não funciona em Expo Go.

---

## 8. Caixa de mensagens do desenvolvedor — 15/10/2026

Removida a linha "Ou envie um e-mail..." da tela "Contate o desenvolvedor": o formulário
passa a ser o único canal. Isso só era possível depois de resolver o item **4.3** desta
revisão — antes, a mensagem ia apenas para `console.log` e **se perdia no restart do
container**, enquanto o app afirmava ao usuário que ela tinha sido enviada.

### 8.1 Como funciona agora

1. Usuário escreve em Ajustes → "Contate o desenvolvedor".
2. `POST /api/support/message` grava em **`support_messages`** com nome, e-mail e telefone
   de quem escreveu **copiados** para a linha (a mensagem continua legível mesmo se a conta
   for excluída depois, já que `owner_id` é `ON DELETE SET NULL`).
3. Os aparelhos do administrador recebem um **push** ("Elogio de Fulano", com um trecho da
   mensagem). A falha no push não invalida a mensagem, que já está gravada.
4. O administrador lê em **Ajustes → "Mensagens recebidas"**, com selo de não lidas.

### 8.2 Arquivos

| Arquivo | O que mudou |
|---|---|
| [backend/db/schema.sql](backend/db/schema.sql) | Tabela `support_messages` + índices (criada sozinha no boot, o `migrate()` é idempotente) |
| [backend/src/utils/admins.js](backend/src/utils/admins.js) | **Novo.** `adminEmails()`, `isAdmin()` e `adminPushTokens()` — antes `isAdmin` era local do `admin.js` e o `support.js` não tinha como reaproveitar |
| [backend/src/routes/support.js](backend/src/routes/support.js) | Persiste a mensagem (com limite de 200/5000 caracteres e `kind` validado) e dispara o push |
| [backend/src/routes/admin.js](backend/src/routes/admin.js) | `GET /admin/support-messages` (com `?only=unread`), `PATCH /:id/read`, `POST /read-all`, `DELETE /:id`. `GET /admin/me` passa a devolver `unread_support` |
| [mobile/app/(app)/support-inbox.tsx](mobile/app/(app)/support-inbox.tsx) | **Nova tela.** Lista, filtro Todas/Não lidas, pull-to-refresh, marcar lida, excluir e **responder por e-mail ou WhatsApp** direto para quem escreveu |
| [mobile/app/(app)/settings.tsx](mobile/app/(app)/settings.tsx) | Linha "Mensagens recebidas" (só para admin, com contador); removida a linha do e-mail e o código que buscava o contato |

As rotas novas ficam **depois** do `router.use(requireAdmin)`, então só quem está em
`ADMIN_EMAILS` acessa. `GET /admin/me` continua antes do guard, porque todo usuário logado
precisa dele para saber se mostra as linhas de admin.

### 8.3 ⚠️ Para funcionar

1. **Deploy do backend** — a tabela é criada sozinha no boot.
2. `ADMIN_EMAILS` já está correto (`almir.seibert@gmail.com`).
3. **Build nova do app** — a tela "Mensagens recebidas" é código do cliente. As mensagens
   começam a ser gravadas assim que o backend subir, mas só dá para lê-las no app novo.
   Até lá, dá para consultar direto no banco:
   ```sql
   SELECT created_at, owner_name, owner_email, kind, subject, message
     FROM support_messages ORDER BY created_at DESC;
   ```
4. Para receber o push, a conta admin precisa estar **logada no app com a permissão de
   notificação concedida** (é o que registra o token em `push_tokens`).

### 8.4 O que não foi verificado

- Sem banco e sem `node_modules`: as rotas novas e a tela passaram por checagem de sintaxe,
  não foram executadas. O SQL da tabela não foi aplicado a um Postgres real.
- O push para o admin depende de haver token registrado — não testado ponta a ponta.

---

## 9. Bloqueios do Google Play resolvidos — 15/10/2026

Aplicados os itens **2.1**, **2.2** e **2.3**, que eram o que impedia o envio à loja.

### 9.1 Exclusão de conta no app (item 2.1)

| Onde | O quê |
|---|---|
| [backend/src/routes/auth.js](backend/src/routes/auth.js) | `DELETE /api/auth/me`, autenticado, **exigindo a senha atual** (mesma checagem do login). Remove a linha de `owners`; o `ON DELETE CASCADE` do schema leva junto clientes, veículos, lavagens, agendamentos, despesas, fornecedores, colaboradores, documentos, CRM, tokens de push e ajustes da empresa. |
| [mobile/app/(app)/settings.tsx](mobile/app/(app)/settings.tsx) | "Excluir minha conta" no rodapé de Ajustes → modal com aviso em vermelho do que será apagado, campo de senha e **segunda confirmação** no alerta. Ao concluir, faz logout (que também desvincula o push) e volta para o login. |

O modal avisa que **excluir a conta não cancela a assinatura** no Google Play — é um
motivo comum de reclamação e cobrança indevida.

As mensagens de suporte **não** são apagadas junto: `support_messages.owner_id` é
`ON DELETE SET NULL` e os dados de contato ficam copiados na própria linha (§8.1), então
o histórico sobrevive sem ficar órfão.

### 9.2 Política e termos acessíveis no app (item 2.2)

- Em Ajustes, linhas "Política de privacidade" e "Termos de uso", abertas com `Linking`.
- As URLs vêm de `EXPO_PUBLIC_PRIVACY_URL` e `EXPO_PUBLIC_TERMS_URL`: **sem URL definida a
  linha não aparece**, então nunca existe um link quebrado no app.
- A política foi publicada como página em [docs/privacidade.html](docs/privacidade.html),
  com [docs/index.html](docs/index.html) de capa, prontas para o GitHub Pages.
- `EXPO_PUBLIC_PRIVACY_URL` já está preenchida nos perfis `preview` e `production` do
  [mobile/eas.json](mobile/eas.json).
- **Termos de uso ainda não existem como documento.** A variável fica vazia e a linha não
  aparece — nada quebra. Não escrevi o texto porque é decisão de conteúdo/jurídica, não
  técnica.

### 9.3 Política alinhada ao app real (item 2.3)

[play-store/POLITICA_PRIVACIDADE.md](play-store/POLITICA_PRIVACIDADE.md) reescrita:

- **Removidas as menções a anúncios e ao identificador de publicidade** — o app não tem
  anúncios, e declarar o que não acontece é causa comum de reprovação.
- Removidos todos os placeholders `[ ]` e os "se aplicável": a verificação de telefone e o
  RevenueCat **são** usados, então entraram como fato.
- Item 8 passa a descrever a exclusão **dentro do app**, que agora existe de verdade.
- Acrescentados: token de push entre os dados coletados, seção de notificações, menção a
  senhas guardadas só como hash, e a lista real de terceiros (infraestrutura, Firebase,
  Google Play/RevenueCat, Expo).

> 🔵 A política continua sendo um texto redigido por mim a partir do comportamento do
> código. Vale uma leitura jurídica antes de publicar, principalmente sobre LGPD e o papel
> de **operador** que vocês exercem sobre os dados dos clientes finais do lava-rápido.

### 9.4 ⚠️ Passos manuais que faltam

1. **Ligar o GitHub Pages:** repositório → Settings → Pages → Source `Deploy from a branch`,
   branch `main`, pasta `/docs`. A política fica em
   `https://almirseibert.github.io/meulavarapido/privacidade.html` — que é exatamente a URL
   já configurada no `eas.json`. **Enquanto o Pages não estiver ligado, esse link dá 404.**
   Se o repositório for privado, o Pages exige plano pago: nesse caso publique em outro
   lugar e ajuste a URL no `eas.json`.
2. **Informar a URL no Play Console** em Política de Privacidade (ficha da loja).
3. **Declarar a exclusão de conta** no Console → Segurança dos dados → "Exclusão de dados":
   marcar que o app oferece exclusão dentro do aplicativo.
4. **Deploy do backend** (a rota `DELETE /auth/me` é nova) e **build nova do app**.

### 9.5 O que não foi verificado

- Sem banco: o `DELETE /auth/me` não foi executado, e o efeito cascata foi conferido lendo o
  schema, não rodando. **Vale testar com uma conta descartável antes de publicar** — é uma
  operação sem volta.
- A tela de exclusão passou por checagem de sintaxe, não foi aberta num aparelho.
- As páginas em `docs/` não foram abertas num navegador.

