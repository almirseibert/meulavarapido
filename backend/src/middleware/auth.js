const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { fail } = require('../utils/http');

/**
 * Exige um JWT válido. Popula req.owner = { id, plan, premium_until, isPremium }.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return fail(res, 'Token ausente.', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query(
      'SELECT id, plan, premium_until FROM owners WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) return fail(res, 'Conta não encontrada.', 401);

    const owner = rows[0];
    const isPremium =
      owner.plan === 'premium' &&
      (!owner.premium_until || new Date(owner.premium_until) > new Date());

    req.owner = { id: owner.id, plan: owner.plan, premium_until: owner.premium_until, isPremium };
    next();
  } catch (err) {
    return fail(res, 'Sessão inválida ou expirada.', 401);
  }
}

module.exports = { requireAuth };
