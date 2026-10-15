import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api, unwrap } from '../api';

// Expo Go não tem o módulo nativo do RevenueCat -> não carregar nesse ambiente.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/**
 * Assinatura premium (R$ 49,90/mês ou R$ 499,90/ano).
 * Usa RevenueCat (`react-native-purchases`) que abstrai a App Store e a Play Store.
 *
 * IMPORTANTE: lojas exigem que assinaturas digitais sejam vendidas via in-app
 * purchase (IAP). RevenueCat cuida disso e nos diz se o usuário tem direito ("entitlement").
 *
 * Em Expo Go o módulo nativo não existe; aqui ele é opcional. Sem ele, a função
 * de compra cai num modo de ATIVAÇÃO MANUAL via backend (apenas para testar o app).
 *
 * Configuração em produção:
 *  1. Crie produtos na App Store Connect e Play Console:
 *       meulavarapido_premium_monthly (R$ 49,90)
 *       meulavarapido_premium_yearly  (R$ 499,90)
 *  2. No RevenueCat: entitlement "premium" + offering com esses produtos.
 *  3. Preencha EXPO_PUBLIC_RC_ANDROID_KEY / EXPO_PUBLIC_RC_IOS_KEY no .env.
 *  4. Configure o webhook do RevenueCat -> POST {API}/api/subscription/webhook
 *     usando app_user_id = id do owner (definido em configure()).
 *  5. No backend, defina REVENUECAT_API_KEY (chave SECRETA v1, "sk_...").
 *
 * ATIVACAO: depois de uma compra bem-sucedida o app chama
 * POST /api/subscription/sync, que confere o entitlement direto na API do
 * RevenueCat e libera o premium na hora. O webhook continua cuidando de
 * renovacao/cancelamento, mas a liberacao do cliente que acabou de pagar NAO
 * depende mais dele.
 */

const ENTITLEMENT = 'premium';

let Purchases: any = null;
let configured = false;

function loadModule(): boolean {
  if (IS_EXPO_GO) return false;
  if (Purchases) return true;
  try {
    Purchases = require('react-native-purchases').default;
    return true;
  } catch {
    return false;
  }
}

export const purchasesAvailable = () => loadModule();

export async function configurePurchases(ownerId: string) {
  if (!loadModule() || configured) return;
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
  if (!key) return; // sem chave -> fica no modo manual
  try {
    // shouldShowInAppMessagesAutomatically:false evita o RevenueCat conectar ao
    // billing do Google Play no configure (gera erro BILLING_UNAVAILABLE em
    // emulador/dispositivo sem conta Play). Mensagens da loja podem ser exibidas
    // manualmente quando necessário.
    Purchases.configure({ apiKey: key, appUserID: ownerId, shouldShowInAppMessagesAutomatically: false });
    configured = true;
  } catch {
    /* silencioso */
  }
}

export interface PlanOption {
  id: string;
  label: string;
  price: number;
  period: string;
}

export async function getPlans(): Promise<Record<string, PlanOption>> {
  return unwrap(api.get('/subscription/plans'));
}

export interface SyncResult {
  isPremium?: boolean;
  hasAccess?: boolean;
  premium_until?: string | null;
  changed?: boolean;
}

/**
 * Pede ao backend para conferir a assinatura na API do RevenueCat e gravar o
 * resultado na conta. É o que efetivamente troca o plano de free para premium
 * (com o prazo mensal/anual vindo do entitlement), sem esperar o webhook.
 *
 * Nunca lança: a compra na loja já foi concluída e não deve "falhar" só porque
 * a confirmação no servidor demorou. Devolve null quando não deu para confirmar.
 */
export async function syncSubscription(): Promise<SyncResult | null> {
  try {
    return await unwrap<SyncResult>(api.post('/subscription/sync'));
  } catch {
    return null;
  }
}

/**
 * Tenta confirmar a assinatura no servidor algumas vezes. A loja pode levar
 * alguns segundos para o RevenueCat registrar a compra, então uma única
 * tentativa logo após o pagamento pode chegar cedo demais.
 */
async function syncWithRetry(attempts = 3, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const r = await syncSubscription();
    if (r?.isPremium) return true;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Inicia a compra. `plan` = 'monthly' | 'yearly'.
 * Retorna true se o usuário ficou premium.
 */
export async function purchase(plan: 'monthly' | 'yearly'): Promise<boolean> {
  if (loadModule() && configured) {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      const pkg =
        plan === 'yearly'
          ? current?.annual ?? current?.availablePackages?.find((p: any) => /year|anual/i.test(p.identifier))
          : current?.monthly ?? current?.availablePackages?.find((p: any) => /month|mensal/i.test(p.identifier));
      if (!pkg) throw new Error('Plano indisponível na loja.');
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitled = !!customerInfo.entitlements.active[ENTITLEMENT];
      if (!entitled) return false;
      // A loja confirmou. Agora o backend precisa registrar o premium, senão a
      // conta continua em somente-leitura mesmo com a compra paga.
      await syncWithRetry();
      return true;
    } catch (e: any) {
      if (e?.userCancelled) return false;
      throw e;
    }
  }

  // RevenueCat não configurado: bloqueia em produção, permite em DEV via backend.
  if (process.env.EXPO_PUBLIC_ENV === 'production') {
    throw new Error('Pagamento indisponível: RevenueCat não está configurado.');
  }
  await api.post('/subscription/activate', { plan });
  return true;
}

export async function restore(): Promise<boolean> {
  if (loadModule() && configured) {
    try {
      const info = await Purchases.restorePurchases();
      if (!info.entitlements.active[ENTITLEMENT]) return false;
      await syncWithRetry(2, 1500);
      return true;
    } catch {
      return false;
    }
  }
  // Sem o módulo nativo ainda vale perguntar ao servidor: a compra pode existir
  // no RevenueCat (feita em outro aparelho) e só faltar refletir nesta conta.
  const r = await syncSubscription();
  return !!r?.isPremium;
}
