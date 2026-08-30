// Notificações locais (no próprio aparelho) — usado pela Tele-busca para
// avisar o operador quando chega a hora de buscar o veículo.
// Requer expo-notifications (instalar com: npx expo install expo-notifications)
// e um dev build/standalone — não funciona no Expo Go do SDK 53+.
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'tele-busca';
const NEWS_CHANNEL = 'novidades';
let permissionAsked = false;
let registeredToken: string | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && !permissionAsked) {
      permissionAsked = true;
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (granted && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Tele-busca',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    return granted;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notificações remotas (novidades e promoções enviadas pelo administrador).
// ---------------------------------------------------------------------------

const projectId =
  (Constants.expoConfig as any)?.extra?.eas?.projectId ||
  (Constants as any)?.easConfig?.projectId;

/**
 * Pega o token push do aparelho e registra no servidor, para que ele possa
 * receber os comunicados. Idempotente: só chama a API quando o token muda.
 * Falha em silêncio (emulador sem Play Services, permissão negada etc.).
 */
export async function registerPushDevice(): Promise<string | null> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NEWS_CHANNEL, {
        name: 'Novidades e promoções',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) return null;
    if (token === registeredToken) return token;

    await api.post('/devices', {
      token,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version || null,
    });
    registeredToken = token;
    return token;
  } catch {
    return null;
  }
}

/** Desvincula o aparelho ao sair da conta (para não receber avisos de outra conta). */
export async function unregisterPushDevice(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.delete(`/devices/${encodeURIComponent(registeredToken)}`);
  } catch {
    /* silencioso */
  }
  registeredToken = null;
}

interface PickupLike {
  id: string;
  pickup?: boolean;
  pickup_time?: string | null;
  pickup_status?: string | null;
  client_name?: string | null;
  vehicle_info?: string | null;
  pickup_address?: string | null;
}

// Reagenda TODAS as notificações de tele-busca a partir da lista atual de itens
// com busca ativa. Cancela as anteriores para não duplicar/ficar desatualizado.
export async function syncPickupNotifications(items: PickupLike[]): Promise<void> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const w of items) {
      if (!w.pickup || !w.pickup_time) continue;
      if ((w.pickup_status || 'a_buscar') !== 'a_buscar') continue;
      const when = new Date(w.pickup_time).getTime();
      if (isNaN(when) || when <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hora da tele-busca 🚗',
          body: `Buscar ${w.client_name || 'cliente'}${w.vehicle_info ? ` · ${w.vehicle_info}` : ''}${w.pickup_address ? ` — ${w.pickup_address}` : ''}`,
          data: { washId: w.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(when),
          channelId: CHANNEL,
        },
      });
    }
  } catch {
    /* silencioso — notificação é melhoria, não bloqueia o fluxo */
  }
}
