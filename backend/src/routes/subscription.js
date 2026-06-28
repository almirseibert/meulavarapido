const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Catálogo de planos (preços que o app exibe; a cobrança real ocorre via IAP/RevenueCat).
const PLANS = {
  monthly: { id: 'meulavarapido_premium_monthly', label: 'Premium Mensal', price: 49.9, period: 'mês' },
  yearly: { id: 'meulavarapido_premium_yearly', label: 'Premium Anual', price: 499.9, period: 'ano' },
};

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
 * POST /api/subscription/activate
 * Ativa/renova o premium. Em produção, o backend deve VALIDAR o recibo da loja
 * (App Store / Play) ou confiar no webhook do RevenueCat. Aqui registramos a
 * vigência para liberar os recursos no app.
 *
 * Body: { plan: 'monthly' | 'yearly', receipt?: string }
 */
router.post(
  '/activate',
  requireAuth,
  wrap(async (req, res) => {
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
    return ok(res, { ...rows[0], isPremium: true }, 'Assinatura ativada.');
  })
);

/**
 * POST /api/subscription/webhook  (RevenueCat)
 * Fonte da verdade para renovações/cancelamentos. Configure
 * REVENUECAT_WEBHOOK_SECRET e o app_user_id = owners.id no RevenueCat.
 */
router.post(
  '/webhook',
  express.json({ type: '*/*' }),
  wrap(async (req, res) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (secret) {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${secret}`) return fail(res, 'Assinatura do webhook inválida.', 401);
    }
    const ev = req.body && req.body.event;
    if (!ev || !ev.app_user_id) return ok(res, null, 'Ignorado.');

    const type = ev.type; // INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, ...
    const expiresMs = ev.expiration_at_ms ? new Date(ev.expiration_at_ms) : null;

    if (['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'].includes(type)) {
      await query(
        `UPDATE owners SET plan = 'premium', premium_until = $1 WHERE id = $2`,
        [expiresMs, ev.app_user_id]
      );
    } else if (['EXPIRATION', 'CANCELLATION'].includes(type) && expiresMs && expiresMs <= new Date()) {
      await query(
        `UPDATE owners SET plan = 'free' WHERE id = $1`,
        [ev.app_user_id]
      );
    }
    return ok(res, null, 'Processado.');
  })
);

module.exports = router;
