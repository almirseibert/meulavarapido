const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../utils/push');

const router = express.Router();

// Administradores do app (quem pode disparar novidades/promoções) vêm do ambiente:
// ADMIN_EMAILS="voce@dominio.com,outro@dominio.com".
const adminEmails = () =>
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

async function isAdmin(ownerId) {
  const list = adminEmails();
  if (!list.length) return false;
  const { rows } = await query('SELECT email FROM owners WHERE id = $1', [ownerId]);
  return !!rows.length && list.includes(String(rows[0].email).toLowerCase());
}

const requireAdmin = (req, res, next) => {
  isAdmin(req.owner.id)
    .then((allowed) => (allowed ? next() : fail(res, 'Acesso restrito ao administrador do app.', 403)))
    .catch(next);
};

router.use(requireAuth);

// Públicos os dois abaixo só para quem já está logado: o app usa para decidir se
// mostra o item "Central de novidades" em Ajustes.
router.get(
  '/me',
  wrap(async (req, res) => ok(res, { is_admin: await isAdmin(req.owner.id) }))
);

router.use(requireAdmin);

// Recorte de público. "free" = todo mundo que não é assinante pagante
// (inclui quem está no teste grátis e quem já expirou).
const AUDIENCES = {
  all: '1 = 1',
  premium: `o.plan = 'premium' AND (o.premium_until IS NULL OR o.premium_until > now())`,
  free: `NOT (o.plan = 'premium' AND (o.premium_until IS NULL OR o.premium_until > now()))`,
  trial: `NOT (o.plan = 'premium' AND (o.premium_until IS NULL OR o.premium_until > now()))
          AND o.trial_ends_at IS NOT NULL AND o.trial_ends_at > now()`,
  expired: `NOT (o.plan = 'premium' AND (o.premium_until IS NULL OR o.premium_until > now()))
            AND (o.trial_ends_at IS NULL OR o.trial_ends_at <= now())`,
};

async function audienceTokens(audience) {
  const clause = AUDIENCES[audience];
  if (!clause) return null;
  const { rows } = await query(
    `SELECT t.token
       FROM push_tokens t
       JOIN owners o ON o.id = t.owner_id
      WHERE t.disabled = false AND ${clause}`
  );
  return rows.map((r) => r.token);
}

// GET /api/admin/audiences — quantos aparelhos e contas em cada recorte
router.get(
  '/audiences',
  wrap(async (req, res) => {
    const entries = await Promise.all(
      Object.entries(AUDIENCES).map(async ([key, clause]) => {
        const { rows } = await query(
          `SELECT COUNT(DISTINCT o.id)::int AS accounts,
                  (COUNT(t.token) FILTER (WHERE t.disabled = false))::int AS devices
             FROM owners o
             LEFT JOIN push_tokens t ON t.owner_id = o.id
            WHERE ${clause}`
        );
        return [key, rows[0]];
      })
    );
    return ok(res, Object.fromEntries(entries));
  })
);

// POST /api/admin/broadcast — envia a novidade/promoção para o recorte escolhido
router.post(
  '/broadcast',
  wrap(async (req, res) => {
    const audience = String(req.body.audience || 'all');
    const title = (req.body.title || '').trim();
    const body = (req.body.body || '').trim();
    if (!AUDIENCES[audience]) return fail(res, 'Público inválido.');
    if (!title || !body) return fail(res, 'Informe título e mensagem.');

    const tokens = await audienceTokens(audience);
    if (!tokens.length) return fail(res, 'Nenhum aparelho registrado neste público.');

    const data = { type: 'broadcast', ...(req.body.data || {}) };
    const { sent, failed, invalidTokens } = await sendPush(tokens, { title, body, data });

    if (invalidTokens.length) {
      await query('UPDATE push_tokens SET disabled = true WHERE token = ANY($1::text[])', [invalidTokens]);
    }

    const { rows } = await query(
      `INSERT INTO broadcasts (audience, title, body, data, sent, failed, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [audience, title, body, JSON.stringify(data), sent, failed, req.owner.id]
    );
    return ok(res, rows[0], `Enviado para ${sent} aparelho(s).${failed ? ` ${failed} falharam.` : ''}`);
  })
);

// POST /api/admin/broadcast/test — envia só para os aparelhos do próprio admin
router.post(
  '/broadcast/test',
  wrap(async (req, res) => {
    const title = (req.body.title || '').trim() || 'Teste';
    const body = (req.body.body || '').trim() || 'Mensagem de teste.';
    const { rows } = await query(
      'SELECT token FROM push_tokens WHERE owner_id = $1 AND disabled = false',
      [req.owner.id]
    );
    if (!rows.length) return fail(res, 'Nenhum aparelho seu está registrado para notificações.');
    const result = await sendPush(rows.map((r) => r.token), { title, body, data: { type: 'test' } });
    return ok(res, result, `Teste enviado para ${result.sent} aparelho(s).`);
  })
);

// GET /api/admin/broadcasts — histórico de envios
router.get(
  '/broadcasts',
  wrap(async (req, res) => {
    const { rows } = await query('SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 50');
    return ok(res, rows);
  })
);

module.exports = router;
