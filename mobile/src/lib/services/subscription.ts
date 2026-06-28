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
    Purchases.configure({ apiKey: key, appUserID: ownerId });
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
      return !!customerInfo.entitlements.active[ENTITLEMENT];
    } catch (e: any) {
      if (e?.userCancelled) return false;
      throw e;
    }
  }

  // Modo manual (DEV / sem RevenueCat configurado): ativa no backend para teste.
  await api.post('/subscription/activate', { plan });
  return true;
}

export async function restore(): Promise<boolean> {
  if (loadModule() && configured) {
    try {
      const info = await Purchases.restorePurchases();
      return !!info.entitlements.active[ENTITLEMENT];
    } catch {
      return false;
    }
  }
  return false;
}
