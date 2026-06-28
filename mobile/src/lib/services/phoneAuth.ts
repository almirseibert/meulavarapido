import Constants from 'expo-constants';

// O módulo nativo do Firebase não existe no Expo Go -> só carrega no dev build.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

let authMod: any = null;

function load(): any | null {
  if (IS_EXPO_GO) return null;
  if (authMod) return authMod;
  try {
    authMod = require('@react-native-firebase/auth').default;
    return authMod;
  } catch {
    return null;
  }
}

/** true quando a verificação por SMS (Firebase Phone Auth) está disponível. */
export const phoneAuthAvailable = () => !!load();

/** Normaliza para E.164 (heurística BR: assume DDI +55 se ausente). */
export function toE164(input: string): string | null {
  let d = (input || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  return '+' + d;
}

/** Envia o SMS e retorna o handle de confirmação (ou null se indisponível). */
export async function sendPhoneCode(phoneE164: string): Promise<any | null> {
  const auth = load();
  if (!auth) return null;
  return auth().signInWithPhoneNumber(phoneE164);
}

/** Confirma o código e devolve o ID token do Firebase (para o backend validar). */
export async function confirmPhoneCode(confirmation: any, code: string): Promise<string> {
  await confirmation.confirm(code);
  const auth = load();
  const token = await auth().currentUser.getIdToken();
  try { await auth().signOut(); } catch { /* ignore */ }
  return token;
}
