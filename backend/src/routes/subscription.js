const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { computeAccess } = require('../utils/access');
const revenuecat = require('../utils/revenuecat');

const router = express.Router();

// Catálogo de planos (preços que o app exibe; a cobrança real ocorre via IAP/RevenueCat).
const PLANS = {
  monthly: { id: 'meulavarapido_premium_monthly', label: 'Premium Mensal', price: 49.9, period: 'mês' },
  yearly: { id: 'meulavarapido_premium_yearly', label: 'Premium Anual', price: 499.9, period: 'ano' },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Grava o resultado da verificação na conta e devolve o estado já recalculado. */
async function applyEntitlement(ownerId, { active, expiresAt }) {
  const { rows } = await query(
    `UPDATE owners
        SET plan = $1,
            premium_until = $2
      WHERE id = $3
      RETURNING id, plan, premium_until, trial_ends_at`,
    [active ? 'premium' : 'free', active ? expiresAt : null, ownerId]
  );
  return rows[0] || null;
}

// GET /api/subscription/plans — público
router.get('/plans', (req, res) => ok(res, PLANS));

// GET /api/subscription/status
router.get(
  '/status',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query('SELECT plan, premium_until FROM owners WHERE id = $1', [req.owner.id]);
    return ok(res, {
      ...rows[0],
      isPremium: req.owner.isPremium,
      trialActive: req.owner.trialActive,
      trialDaysLeft: req.owner.trialDaysLeft,
      trialEndsAt: req.owner.trialEndsAt,
      hasAccess: req.owner.hasAccess,
      plans: PLANS,
    });
  })
);

/**
 * POST /api/subscription/sync
 * Confere a assinatura direto na API do RevenueCat e atualiza a conta na hora.
 *
 * É o que garante que quem pagou passa a premium IMEDIATAMENTE: o app chama
 * este endpoint logo depois da compra, da restauração e na abertura, sem
 * depender do webhook (que continua valendo para renovações e cancelamentos).
 *
 * O app_user_id consultado é SEMPRE o id da conta autenticada — o cliente não
 * escolhe qual assinante verificar, então não dá para herdar a assinatura de
 * outra pessoa.
 */
router.post(
  '/sync',
  requireAuth,
  wrap(async (req, res) => {
    if (!revenuecat.isConfigured()) {
      return fail(res, 'Verificação de assinatura indisponível no servidor.', 503, {
        reason: 'revenuecat-unconfigured',
      });
    }

    let result;
    try {
      result = await revenuecat.fetchSubscriberEntitlement(req.owner.id);
    } catch (e) {
      console.error('[assinatura] sync falhou para owner=%s: %s', req.owner.id, e.message);
      return fail(res, 'Não foi possível confirmar sua assinatura agora. Tente novamente.', 502, {
        reason: e.code || 'revenuecat-error',
      });
    }

    // Assinante desconhecido no RevenueCat: não mexe na conta (pode ser trial
    // em andamento ou premium liberado manualmente) — só informa.
    if (!result.found) {
      return ok(
        res,
        { isPremium: req.owner.isPremium, hasAccess: req.owner.hasAccess, changed: false },
        'Nenhuma compra encontrada para esta conta.'
      );
    }

    const before = req.owner.isPremium;
    const updated = await applyEntitlement(req.owner.id, result);
    if (!updated) return fail(res, 'Conta não encontrada.', 404);

    const access = computeAccess(updated);
    console.log(
      '[assinatura] sync owner=%s ativo=%s expira=%s produto=%s',
      req.owner.id, result.active, result.expiresAt ? result.expiresAt.toISOString() : 'vitalicio',
      result.productId || '-'
    );

    return ok(
      res,
      {
        plan: updated.plan,
        premium_until: updated.premium_until,
        productId: result.productId,
        changed: before !== access.isPremium,
        ...access,
      },
      result.active ? 'Assinatura confirmada.' : 'Nenhuma assinatura ativa nesta conta.'
    );
  })
);

/**
 * POST /api/subscription/activate
 * Ativação manual de premium — exclusivo para ambiente de DESENVOLVIMENTO.
 * Em produção a ativação ocorre via /sync ou pelo webhook do RevenueCat.
 */
router.post(
  '/activate',
  requireAuth,
  wrap(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return fail(res, 'Ativação manual indisponível em produção.', 403);
    }
    const plan = req.body.plan === 'yearly' ? 'yearly' : 'monthly';
    const months = plan === 'yearly' ? 12 : 1;
    const { rows } = await query(
      `UPDATE owners
          SET plan = 'premium',
              premium_until = GREATEST(COALESCE(premium_until, now()), now()) + ($1 || ' months')::interval
        WHERE id = $2
        RETURNING plan, premium_until`,
      [String(months), req.owner.id]
    );
    return ok(res, { ...rows[0], isPremium: true }, '[DEV] Assinatura ativada manualmente.');
  })
);

/**
 * POST /api/subscription/webhook  (RevenueCat)
 * Mantém renovações, cancelamentos e expirações em dia.
 *
 * Configure em RevenueCat > Integrations > Webhooks:
 *   URL: {API}/api/subscription/webhook
 *   Authorization header: o MESMO valor de REVENUECAT_WEBHOOK_SECRET
 *   (com ou sem o prefixo "Bearer " — os dois formatos são aceitos aqui).
 *
 * O app_user_id precisa ser o id do owner, o que o app já garante ao chamar
 * Purchases.configure({ appUserID: ownerId }).
 */
router.post(
  '/webhook',
  express.json({ type: '*/*', limit: '100kb' }),
  wrap(async (req, res) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

    // Em produção o segredo é obrigatório: sem ele, qualquer um poderia liberar
    // premium chamando este endpoint.
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[assinatura] webhook recusado: REVENUECAT_WEBHOOK_SECRET não definido.');
        return fail(res, 'Webhook não configurado no servidor.', 503);
      }
      console.warn('[assinatura] webhook SEM segredo — aceitando apenas porque não é produção.');
    } else {
      const header = String(req.headers.authorization || '');
      const sent = header.startsWith('Bearer ') ? header.slice(7) : header;
      if (sent !== secret) {
        console.warn('[assinatura] webhook com Authorization inválido.');
        return fail(res, 'Assinatura do webhook inválida.', 401);
      }
    }

    const ev = req.body && req.body.event;
    if (!ev || !ev.app_user_id) return ok(res, null, 'Ignorado.');

    // app_user_id precisa ser o UUID do owner. Ids anônimos do RevenueCat
    // ($RCAnonymousID:...) aparecem quando a compra ocorreu antes do configure
    // com o id da conta — não há a quem aplicar, então apenas registramos.
    if (!UUID_RE.test(String(ev.app_user_id))) {
      console.warn('[assinatura] webhook %s com app_user_id fora do padrão: %s', ev.type, ev.app_user_id);
      return ok(res, null, 'Ignorado: app_user_id não é uma conta deste app.');
    }

    const type = ev.type;
    const expiresAt = ev.expiration_at_ms ? new Date(Number(ev.expiration_at_ms)) : null;
    const GRANT = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'];
    const REVOKE = ['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED'];

    let action = 'ignorado';
    if (GRANT.includes(type)) {
      // Concede/estende o acesso. CANCELLATION não entra aqui de propósito: no
      // RevenueCat ele significa "não vai renovar", e o acesso continua válido
      // até a data de expiração — quem encerra de fato é o EXPIRATION.
      const { rowCount } = await query(
        `UPDATE owners SET plan = 'premium', premium_until = $1 WHERE id = $2`,
        [expiresAt, ev.app_user_id]
      );
      action = rowCount ? 'premium' : 'conta-inexistente';
    } else if (REVOKE.includes(type) && (!expiresAt || expiresAt <= new Date())) {
      const { rowCount } = await query(
        `UPDATE owners SET plan = 'free', premium_until = NULL WHERE id = $1`,
        [ev.app_user_id]
      );
      action = rowCount ? 'free' : 'conta-inexistente';
    }

    console.log(
      '[assinatura] webhook %s owner=%s expira=%s -> %s',
      type, ev.app_user_id, expiresAt ? expiresAt.toISOString() : '-', action
    );
    return ok(res, null, 'Processado.');
  })
);

module.exports = router;
