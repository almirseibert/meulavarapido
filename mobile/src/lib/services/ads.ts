import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Em Expo Go os módulos nativos (AdMob) não existem; nesse ambiente NÃO tentamos
// carregá-los (evita o erro nativo do TurboModule) e o fluxo roda em modo simulado.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

/**
 * Camada de anúncios (versão grátis).
 * Usa AdMob "Recompensado" (rewarded video): o usuário assiste a um vídeo curto
 * e, ao concluir, a ação é liberada (registrar lavagem / emitir recibo acima do limite).
 *
 * Em Expo Go o módulo nativo `react-native-google-mobile-ads` NÃO existe — então
 * aqui ele é carregado de forma opcional e, na ausência, simulamos a recompensa
 * (resolve true) para não travar o fluxo durante o desenvolvimento.
 *
 * Em build real (EAS / dev-client), o vídeo de verdade é exibido.
 */

// IDs de TESTE oficiais do Google (não geram receita, seguros em DEV).
const TEST_REWARDED_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';

function rewardedUnitId(): string {
  const fromEnv =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS
      : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID;
  if (fromEnv) return fromEnv;
  return Platform.OS === 'ios' ? TEST_REWARDED_IOS : TEST_REWARDED_ANDROID;
}

let mobileAds: any = null;
let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let initialized = false;

function loadModule(): boolean {
  if (IS_EXPO_GO) return false;
  if (RewardedAd) return true;
  try {
    // require dinâmico para não quebrar em Expo Go
    const ads = require('react-native-google-mobile-ads');
    mobileAds = ads.default;
    RewardedAd = ads.RewardedAd;
    RewardedAdEventType = ads.RewardedAdEventType;
    AdEventType = ads.AdEventType;
    return true;
  } catch {
    return false;
  }
}

export const adsAvailable = () => loadModule();

export async function initAds() {
  if (initialized) return;
  if (!loadModule()) return;
  try {
    await mobileAds().initialize();
    initialized = true;
  } catch {
    /* silencioso */
  }
}

/**
 * Exibe um vídeo recompensado. Resolve `true` se o usuário ganhou a recompensa,
 * `false` se fechou antes / falhou. Em ambiente sem o módulo, resolve `true`
 * (modo desenvolvimento) para liberar o fluxo.
 */
export function showRewardedAd(): Promise<boolean> {
  if (!loadModule()) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 400));
  }

  return new Promise((resolve) => {
    const ad = RewardedAd.createForAdRequest(rewardedUnitId(), {
      requestNonPersonalizedAdsOnly: false,
    });
    let earned = false;
    const cleanups: Array<() => void> = [];

    cleanups.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show())
    );
    cleanups.push(
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      })
    );
    cleanups.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanups.forEach((c) => c && c());
        resolve(earned);
      })
    );
    cleanups.push(
      ad.addAdEventListener(AdEventType.ERROR, () => {
        cleanups.forEach((c) => c && c());
        resolve(false);
      })
    );

    try {
      ad.load();
    } catch {
      resolve(false);
    }
  });
}
