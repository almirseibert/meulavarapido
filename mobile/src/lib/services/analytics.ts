import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Owner } from '../types';

/**
 * Mensuração do funil (Firebase Analytics + Meta App Events).
 *
 * POR QUE EXISTE: sem evento de cadastro/trial/assinatura chegando no GA4 e no
 * Meta, as campanhas de instalação não têm o que otimizar e não há como saber o
 * custo por assinante. Este módulo é a única porta de saída desses eventos.
 *
 * O funil medido é:
 *   first_open (automático do Firebase)
 *     -> sign_up          (criou conta)
 *     -> trial_start      (ganhou os 14 dias) ............ 1x por conta
 *     -> wash_created     (usou de verdade)
 *     -> activation       (1ª lavagem registrada) ........ 1x por conta
 *     -> paywall_view     (viu o preço)
 *     -> begin_checkout   (tocou em "Assinar agora")
 *     -> purchase         (assinou)
 *
 * MÓDULOS NATIVOS: nada aqui é obrigatório. Em Expo Go (e em qualquer build sem
 * o pacote instalado) as funções viram no-op — o app nunca quebra por causa de
 * analytics. Ver play-store/MENSURACAO.md para o passo a passo da configuração
 * nos painéis (GA4, Google Ads, Meta e RevenueCat).
 */

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// ---------------------------------------------------------------- Firebase

let fbAnalytics: any = null;
let fbTried = false;

function analytics(): any | null {
  if (IS_EXPO_GO) return null;
  if (fbTried) return fbAnalytics;
  fbTried = true;
  try {
    // require() em vez de import: o pacote pode não estar instalado/linkado.
    const mod = require('@react-native-firebase/analytics');
    fbAnalytics = (mod.default ?? mod)();
  } catch {
    fbAnalytics = null;
  }
  return fbAnalytics;
}

// -------------------------------------------------------------- Meta (opcional)

let metaLogger: any = null;
let metaTried = false;

/**
 * SDK do Meta. Só existe se `react-native-fbsdk-next` tiver sido instalado e o
 * app ID configurado (ver MENSURACAO.md, parte 4) — enquanto não for, o
 * rastreamento do Meta vai pela integração do RevenueCat e por esta função
 * devolvendo null.
 */
function meta(): any | null {
  if (IS_EXPO_GO) return null;
  if (metaTried) return metaLogger;
  metaTried = true;
  try {
    metaLogger = require('react-native-fbsdk-next').AppEventsLogger;
  } catch {
    metaLogger = null;
  }
  return metaLogger;
}

export const metaSdkAvailable = () => !!meta();

/** ID anônimo do Meta — o RevenueCat precisa dele para casar a assinatura com o anúncio. */
export async function getMetaAnonymousId(): Promise<string | null> {
  try {
    return (await meta()?.getAnonymousID()) ?? null;
  } catch {
    return null;
  }
}

/** ID da instância do GA4 — liga a assinatura (via RevenueCat) ao Google Ads. */
export async function getFirebaseAppInstanceId(): Promise<string | null> {
  try {
    return (await analytics()?.getAppInstanceId()) ?? null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- base interna

/** Eventos que valem só a primeira vez na vida da conta (trial, ativação). */
const ONCE_KEY = 'mlr:analytics:once:';

async function firstTimeOnly(key: string): Promise<boolean> {
  const storageKey = `${ONCE_KEY}${key}`;
  try {
    if (await AsyncStorage.getItem(storageKey)) return false;
    await AsyncStorage.setItem(storageKey, new Date().toISOString());
    return true;
  } catch {
    // Storage indisponível: melhor não registrar do que inflar a conversão.
    return false;
  }
}

/** Nomes do GA4 aceitam só letras, números e "_" e no máximo 40 caracteres. */
function sanitizeParams(params?: Record<string, unknown>) {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'number' ? v : String(v).slice(0, 100);
  }
  return out;
}

async function track(
  name: string,
  params?: Record<string, unknown>,
  metaEvent?: { event: string; value?: number }
) {
  const clean = sanitizeParams(params);
  try {
    await analytics()?.logEvent(name, clean);
  } catch {
    /* analytics nunca derruba o fluxo do usuário */
  }
  if (!metaEvent) return;
  try {
    meta()?.logEvent(metaEvent.event, metaEvent.value ?? 0, clean ?? {});
  } catch {
    /* idem */
  }
}

// ------------------------------------------------------------------ usuário

/**
 * Identifica a conta e grava as propriedades que viram público/segmento no GA4
 * (plano, trial ativo, se tem acesso). Chamada a cada abertura da área logada.
 */
export async function setAnalyticsUser(owner: Owner) {
  const a = analytics();
  if (!a) return;
  try {
    await a.setUserId(owner.id);
    await a.setUserProperties({
      plan: owner.plan ?? 'free',
      trial_active: String(!!owner.trialActive),
      has_access: String(!!owner.hasAccess),
      platform_os: Platform.OS,
    });
  } catch {
    /* silencioso */
  }
}

export async function clearAnalyticsUser() {
  try {
    await analytics()?.setUserId(null);
  } catch {
    /* silencioso */
  }
}

// ------------------------------------------------------------------- funil

export function logSignUp(method: 'email' | 'phone' = 'email') {
  return track('sign_up', { method }, { event: 'CompleteRegistration' });
}

export function logLogin(method: 'email' | 'phone' = 'email') {
  return track('login', { method });
}

/**
 * Início do teste grátis — o evento mais importante para otimizar campanha,
 * porque acontece poucos minutos depois da instalação. Dispara uma única vez
 * por conta (o backend concede o trial no cadastro; o app só reporta).
 */
export async function logTrialStartOnce(owner: Owner) {
  if (!owner.trialActive) return;
  if (!(await firstTimeOnly(`trial:${owner.id}`))) return;
  await track(
    'trial_start',
    { days: owner.trialDaysLeft ?? 14, currency: 'BRL', value: 0 },
    { event: 'StartTrial' }
  );
}

/** Primeira lavagem registrada: quem chega aqui raramente cancela. */
export async function logWashCreated(params?: { price?: number; pickup?: boolean }) {
  await track('wash_created', { price: params?.price ?? 0, pickup: !!params?.pickup });
  if (await firstTimeOnly('activation')) {
    // Evento customizado no Meta (serve de público para excluir quem já ativou).
    await track('activation', { step: 'first_wash' }, { event: 'ActivationFirstWash' });
  }
}

export function logPaywallView(source: string) {
  return track('paywall_view', { source }, { event: 'ViewContent' });
}

export function logCheckoutStart(plan: 'monthly' | 'yearly', price: number) {
  return track(
    'begin_checkout',
    { plan, currency: 'BRL', value: price },
    { event: 'InitiateCheckout', value: price }
  );
}

/**
 * Assinatura concluída. Os eventos `rc_*` da integração do RevenueCat com o
 * Firebase não colidem com este `purchase` (nomes diferentes): use `purchase`
 * para otimizar anúncio e os `rc_*` para a verdade de receita/renovação.
 */
export async function logSubscription(plan: 'monthly' | 'yearly', price: number) {
  try {
    await analytics()?.logEvent('purchase', {
      currency: 'BRL',
      value: price,
      transaction_id: `${plan}:${Date.now()}`,
      items: [{ item_id: `premium_${plan}`, item_name: `Premium ${plan}`, price }],
    });
  } catch {
    /* silencioso */
  }
  try {
    meta()?.logPurchase(price, 'BRL', { plan });
    meta()?.logEvent('Subscribe', price, { plan });
  } catch {
    /* silencioso */
  }
}
