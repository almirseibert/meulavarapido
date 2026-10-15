// Consulta direta à API do RevenueCat para saber se uma conta tem a assinatura
// ativa. Serve como fonte de verdade sob demanda, sem depender do webhook:
// o app chama POST /api/subscription/sync depois da compra e a ativação é
// imediata, mesmo que o webhook atrase, falhe ou esteja mal configurado.
//
// Requer REVENUECAT_API_KEY = chave SECRETA v1 do projeto
// (RevenueCat > Project settings > API keys > Secret key, começa com "sk_").
// NUNCA usar aqui a chave pública do app (goog_... / appl_...).
const API_BASE = 'https://api.revenuecat.com/v1';
const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || 'premium';
const TIMEOUT_MS = 10000;

function isConfigured() {
  return !!process.env.REVENUECAT_API_KEY;
}

/**
 * Lê o estado da assinatura de um app_user_id no RevenueCat.
 *
 * Retorna { active, expiresAt, productId, found }:
 *   active    -> true se o entitlement "premium" está válido agora
 *   expiresAt -> Date do fim do período, ou null em assinatura vitalícia
 *   found     -> false se o RevenueCat não conhece esse app_user_id
 *
 * Lança erro (com .code) quando não há chave configurada ou a API falha, para
 * o chamador decidir entre devolver erro ou apenas manter o estado atual.
 */
async function fetchSubscriberEntitlement(appUserId) {
  if (!isConfigured()) {
    const err = new Error('REVENUECAT_API_KEY não configurada no servidor.');
    err.code = 'revenuecat-unconfigured';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_API_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (e) {
    const err = new Error('Não foi possível falar com o RevenueCat.');
    err.code = 'revenuecat-unreachable';
    err.cause = e;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // 404 = assinante desconhecido (nunca comprou por este app_user_id).
  if (res.status === 404) return { active: false, expiresAt: null, productId: null, found: false };

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`RevenueCat respondeu ${res.status}.`);
    err.code = 'revenuecat-http-error';
    err.status = res.status;
    err.body = body.slice(0, 500);
    throw err;
  }

  const json = await res.json().catch(() => null);
  const sub = json && json.subscriber;
  if (!sub) return { active: false, expiresAt: null, productId: null, found: false };

  const ent = (sub.entitlements || {})[ENTITLEMENT];
  if (!ent) return { active: false, expiresAt: null, productId: null, found: true };

  // expires_date nulo = vitalício (sem data de expiração).
  const expiresAt = ent.expires_date ? new Date(ent.expires_date) : null;
  const active = !expiresAt || expiresAt.getTime() > Date.now();

  return { active, expiresAt, productId: ent.product_identifier || null, found: true };
}

module.exports = { fetchSubscriberEntitlement, isConfigured, ENTITLEMENT };
