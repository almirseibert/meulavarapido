const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { fail } = require('../utils/http');
const { computeAccess } = require('../utils/access');

/**
 * Exige um JWT válido. Popula req.owner com id, plan, premium_until, phone e o
 * estado de acesso (isPremium, trialActive, trialDaysLeft, trialEndsAt, hasAccess).
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(res, 'Token ausente.', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, plan, premium_until, trial_ends_at, phone FROM owners WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) return fail(res, 'Conta não encontrada.', 401);

    const owner = rows[0];
    req.owner = { ...owner, ...computeAccess(owner) };
    next();
  } catch (err) {
    return fail(res, 'Sessão inválida ou expirada.', 401);
  }
}

/**
 * Bloqueia operações de ESCRITA (não-GET/HEAD) quando o teste expirou e não há
 * assinatura ativa. Leitura permanece liberada (app fica somente leitura).
 * Deve ser usado depois de requireAuth.
 */
function requireActiveAccess(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.owner && req.owner.hasAccess) return next();
  return fail(res, 'Seu teste terminou. Assine para continuar.', 402, { requiresSubscription: true });
}

/**
 * Exige assinatura premium paga (nem o trial libera). Usado em recursos
 * exclusivos de assinantes, como a importação de backup.
 */
function requirePremium(req, res, next) {
  if (req.owner && req.owner.isPremium) return next();
  return fail(res, 'Disponível apenas para assinantes Premium.', 402, { requiresSubscription: true });
}

module.exports = { requireAuth, requireActiveAccess, requirePremium };
