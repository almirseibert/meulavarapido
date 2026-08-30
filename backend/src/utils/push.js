// Envio de notificações push pelo serviço do Expo (https://docs.expo.dev/push-notifications).
// Não exige chave: o token do aparelho (ExponentPushToken[...]) já identifica o destino.
// Se EXPO_ACCESS_TOKEN estiver definido, é enviado como Bearer (recomendado em produção).
const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // limite por requisição na API do Expo

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Envia a mesma mensagem para vários tokens.
 * Retorna { sent, failed, invalidTokens } — invalidTokens são os que o Expo
 * marcou como DeviceNotRegistered (app desinstalado) e devem ser desativados.
 */
async function sendPush(tokens, { title, body, data = {} }) {
  const valid = [...new Set((tokens || []).filter((t) => typeof t === 'string' && t.startsWith('Expo')))];
  if (!valid.length) return { sent: 0, failed: 0, invalidTokens: [] };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens = [];

  for (const group of chunk(valid, CHUNK)) {
    const messages = group.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      channelId: 'novidades',
      priority: 'high',
    }));

    try {
      const res = await fetch(EXPO_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });
      const json = await res.json().catch(() => ({}));
      const tickets = Array.isArray(json.data) ? json.data : [];

      tickets.forEach((ticket, i) => {
        if (ticket && ticket.status === 'ok') {
          sent++;
        } else {
          failed++;
          if (ticket?.details?.error === 'DeviceNotRegistered') invalidTokens.push(group[i]);
        }
      });
      // Sem tickets (erro global da requisição): conta o lote inteiro como falha.
      if (!tickets.length) failed += group.length;
    } catch (e) {
      console.error('[push] Falha ao enviar lote:', e.message);
      failed += group.length;
    }
  }

  return { sent, failed, invalidTokens };
}

module.exports = { sendPush };
