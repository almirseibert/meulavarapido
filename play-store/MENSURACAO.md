# 📊 Mensuração — Firebase Analytics, Meta Ads e Google Ads

Guia de configuração do que já está implementado no app. Sem estes passos nos
painéis, os eventos são enviados mas ninguém os usa para otimizar campanha.

Complemento do [PLANO_DIVULGACAO.md](PLANO_DIVULGACAO.md) (Parte 0.1).

---

## 1. O que o app já faz (código pronto)

Todo o envio passa por `mobile/src/lib/services/analytics.ts`. Nada é
obrigatório em tempo de execução: sem módulo nativo (Expo Go, por exemplo) as
funções viram no-op e o app não quebra.

| Evento (GA4) | Evento no Meta | Quando dispara | Onde |
|---|---|---|---|
| `first_open` | — | automático do Firebase | — |
| `sign_up` | `CompleteRegistration` | conta criada | `src/lib/stores/auth.ts` |
| `login` | — | login com e-mail | `src/lib/stores/auth.ts` |
| `trial_start` | `StartTrial` | 1ª abertura com trial ativo (**1x por conta**) | `app/(app)/_layout.tsx` |
| `wash_created` | — | cada lavagem nova | `app/(app)/washes.tsx` |
| `activation` | `ActivationFirstWash` | 1ª lavagem registrada (**1x por conta**) | `app/(app)/washes.tsx` |
| `paywall_view` | `ViewContent` | abriu a tela Premium | `app/premium.tsx` |
| `begin_checkout` | `InitiateCheckout` | tocou em "Assinar agora" | `app/premium.tsx` |
| `purchase` | `Purchase` + `Subscribe` | loja aprovou a compra | `app/premium.tsx` |

Propriedades de usuário no GA4: `plan`, `trial_active`, `has_access`,
`platform_os` — servem de público e de segmento nos relatórios.

Os eventos "1x por conta" são travados em `AsyncStorage`
(`mlr:analytics:once:*`), para não inflar conversão quando o app reabre.

### Atribuição no RevenueCat
`configurePurchases()` (em `src/lib/services/subscription.ts`) agora também:
- `collectDeviceIdentifiers()` — GAID / IDFA, exigido pelas integrações de anúncio;
- `setFirebaseAppInstanceID()` — liga o assinante à sessão do GA4 (Google Ads);
- `setFBAnonymousID()` — o mesmo para o Meta (só quando o SDK do Meta existe);
- `setAttributes({ platform_os, app_version })`.

---

## 2. Instalar e gerar o build

```bash
cd mobile
npm install
npx expo run:android      # ou: eas build --profile development
```

> **Expo Go não serve para testar mensuração** — o módulo nativo do Firebase
> Analytics não existe lá. Use dev build ou build de produção.

Já incluído no `app.json`: a permissão Android
`com.google.android.gms.permission.AD_ID` (necessária para o GAID a partir do
Android 13).

### Declaração obrigatória no Play Console
Em **Política → Conteúdo do app → Segurança dos dados**, declare:
- coleta de **ID de publicidade** (finalidade: publicidade/marketing e análise);
- coleta de **identificadores do dispositivo** e **atividade no app** (análise);
- dados **não** vinculados à identidade do usuário para fins de anúncio, se for o seu caso.

Também confirme que a [política de privacidade](POLITICA_PRIVACIDADE.md)
menciona analytics e publicidade — hoje ela precisa citar Firebase Analytics,
RevenueCat e, se você instalar, o SDK do Meta.

---

## 3. Firebase / GA4 → Google Ads

1. **Console do Firebase → Analytics** → confirme que o app aparece em
   *Tempo real* depois de abrir o dev build.
2. **DebugView** (para validar evento por evento):
   ```bash
   adb shell setprop debug.firebase.analytics.app com.studiomythos.meulavarapido
   ```
   Desligar depois: `adb shell setprop debug.firebase.analytics.app .none.`
3. **Firebase → Configurações do projeto → Integrações → Google Ads**: vincule a
   conta do Google Ads.
4. **GA4 → Admin → Eventos → Marcar como conversão**: marque `trial_start`,
   `purchase` e (opcional) `sign_up`.
5. **Google Ads → Objetivos → Conversões**: importe essas conversões do GA4 e
   use **`trial_start`** como ação de conversão da App campaign (`purchase`
   demora e tem volume baixo para o algoritmo aprender).
6. **Play Console → Configurações → Vinculação a serviços do Google**: vincule
   ao Google Ads e ao Firebase para a atribuição de instalação (install referrer).

---

## 4. Meta Ads

A integração funciona em dois níveis — faça o nível A primeiro, ele já basta
para começar a anunciar.

### Nível A — sem SDK (comece por aqui)
1. Crie o app no **developers.facebook.com** (tipo: Consumidor) e adicione a
   plataforma Android com o pacote `com.studiomythos.meulavarapido` e a
   assinatura (hash SHA-1 da sua keystore de upload).
2. **Events Manager → Fontes de dados → App** → anote o **ID do app**.
3. **RevenueCat → Project settings → Integrations → Facebook Ads**: informe o
   app ID e o token. O RevenueCat passa a reportar `StartTrial`, `Subscribe`,
   renovação e cancelamento **pelo servidor**, usando os identificadores que o
   app já coleta (`collectDeviceIdentifiers`).
4. No Gerenciador de Anúncios, use os eventos reportados pelo RevenueCat como
   otimização das campanhas de assinatura.

### Nível B — com o SDK do Meta (eventos de funil em tempo real)
Necessário se você quiser otimizar por `paywall_view` / `begin_checkout` /
`CompleteRegistration`, que são eventos do app e não da assinatura.

```bash
cd mobile
npx expo install react-native-fbsdk-next
```

Depois adicione ao `app.json`, dentro de `plugins`:

```json
[
  "react-native-fbsdk-next",
  {
    "appID": "SEU_APP_ID",
    "clientToken": "SEU_CLIENT_TOKEN",
    "displayName": "Meu Lava Rápido",
    "scheme": "fbSEU_APP_ID",
    "advertiserIDCollectionEnabled": true,
    "autoLogAppEventsEnabled": true,
    "isAutoInitEnabled": true
  }
]
```

E gere um novo build (`npx expo run:android`). **O código do app não muda:**
`analytics.ts` detecta o SDK sozinho (`require` com fallback) e passa a enviar
os eventos do Meta, além de fornecer o `FBAnonymousID` ao RevenueCat.

> Atenção: com o SDK instalado, a política de privacidade e a Segurança dos
> Dados do Play precisam citar a coleta de dados pelo Meta.

---

## 5. Evitando contagem dupla

- A integração **RevenueCat → Firebase** envia eventos com prefixo `rc_`
  (`rc_initial_purchase_event`, `rc_trial_started_event`…). Eles **não colidem**
  com os eventos do app (`purchase`, `trial_start`).
- Regra de uso: **eventos do app** para otimizar anúncio (chegam na hora);
  **eventos `rc_*`** para a verdade de receita, renovação e churn.
- Não marque os dois como conversão no Google Ads — escolha um lado
  (recomendado: os do app).

---

## 6. Como validar que está tudo certo

Checklist em um dev build, com DebugView aberto:

- [ ] Abrir o app pela 1ª vez → `first_open`
- [ ] Criar conta → `sign_up`
- [ ] Voltar à tela inicial logada → `trial_start` (**só uma vez**; reabrir o app não repete)
- [ ] Registrar a 1ª lavagem → `wash_created` + `activation`
- [ ] Registrar a 2ª lavagem → só `wash_created`
- [ ] Abrir a tela Premium → `paywall_view` com `source`
- [ ] Tocar em "Assinar agora" → `begin_checkout`
- [ ] Concluir compra de teste (produto de teste da Play) → `purchase` com `value`
- [ ] RevenueCat → aba do cliente → ver os atributos `$firebaseAppInstanceId`
      e (se nível B) `$fbAnonId` preenchidos
- [ ] Logout → `setUserId(null)` (nenhum evento novo com o ID antigo)

---

## 7. Números a observar no GA4 (as taxas do plano de divulgação)

| Taxa | Como calcular no GA4 |
|---|---|
| Instalação → cadastro | `sign_up` / `first_open` |
| Cadastro → trial | `trial_start` / `sign_up` |
| Trial → ativação | `activation` / `trial_start` |
| Ativação → paywall | `paywall_view` / `activation` |
| Paywall → assinatura | `purchase` / `paywall_view` |

Monte um **Funil de exploração** no GA4 com exatamente esses passos, na ordem.
É esse relatório que diz se o problema é anúncio, produto ou preço.
