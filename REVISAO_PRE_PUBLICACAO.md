# Revisão do App — Pendências para Alteração

> Revisão técnica de **Meu Lava Rápido** feita em **15/10/2026** no branch `main` (commit `2fed4a6`).
> Documento de trabalho: cada item tem arquivo, linha e ação sugerida.
> **Atualizado em 15/10/2026:** o **item 1 (contatos da Mak Serviços) foi aplicado** — ver §1.
> Os demais itens seguem pendentes.

---

## 0. Resumo executivo

| Prioridade | Assunto | Itens |
|---|---|---|
| ✅ Resolvido | Contato Mak Serviços exposto no app e nos textos da loja | 9 |
| 🔴 Bloqueia publicação | Exigências do Google Play (exclusão de conta, política de privacidade no app) | 2 |
| 🟠 Alto (segurança) | Webhook RevenueCat sem segredo obrigatório, sem rate limit no login, CORS aberto | 4 |
| 🟡 Médio | Robustez do backend (migrate silencioso, UUID inválido, suporte sem persistência) | 4 |
| 🔵 Baixo / melhoria | Documentação, iOS, mensagens de suporte sem persistência | 5 |

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

## 2. 🔴 Exigências do Google Play ainda não atendidas

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

### 3.1 Webhook do RevenueCat com segredo opcional — **risco de premium gratuito**

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

### 4.2 `app_user_id` inválido derruba o webhook com 500

[subscription.js:92-103](backend/src/routes/subscription.js:92) — `app_user_id` vai direto
para um `WHERE id = $1` de coluna `UUID`. Um valor não-UUID gera exceção do Postgres →
erro 500 → o RevenueCat reenvia o evento indefinidamente.

**Ação:** validar formato de UUID e responder 200 ("ignorado") para IDs desconhecidos.

### 4.3 Mensagens de suporte só vão para o log

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
