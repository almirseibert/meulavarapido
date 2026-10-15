const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../utils/push');
// Administradores do app vêm de ADMIN_EMAILS (ver utils/admins.js).
const { isAdmin } = require('../utils/admins');

const router = express.Router();

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
  wrap(async (req, res) => {
    const admin = await isAdmin(req.owner.id);
    if (!admin) return ok(res, { is_admin: false, unread_support: 0 });
    // Contador para o selo de não lidas em Ajustes.
    const { rows } = await query(
      'SELECT COUNT(*)::int AS c FROM support_messages WHERE read_at IS NULL'
    );
    return ok(res, { is_admin: true, unread_support: rows[0].c });
  })
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

// ---------- Mensagens de suporte ("Contate o desenvolvedor") ----------

// GET /api/admin/support-messages — caixa de entrada do administrador.
// ?only=unread para ver só as não lidas.
router.get(
  '/support-messages',
  wrap(async (req, res) => {
    const onlyUnread = req.query.only === 'unread';
    const { rows } = await query(
      `SELECT id, owner_id, owner_name, owner_email, owner_phone,
              kind, subject, message, read_at, created_at
         FROM support_messages
        ${onlyUnread ? 'WHERE read_at IS NULL' : ''}
        ORDER BY created_at DESC
        LIMIT 200`
    );
    const { rows: counts } = await query(
      `SELECT COUNT(*)::int AS total,
              (COUNT(*) FILTER (WHERE read_at IS NULL))::int AS unread
         FROM support_messages`
    );
    return ok(res, { messages: rows, ...counts[0] });
  })
);

// PATCH /api/admin/support-messages/:id/read — marca uma como lida (ou não lida).
router.patch(
  '/support-messages/:id/read',
  wrap(async (req, res) => {
    const read = req.body.read === undefined ? true : !!req.body.read;
    const { rows } = await query(
      `UPDATE support_messages SET read_at = ${read ? 'now()' : 'NULL'}
        WHERE id = $1 RETURNING id, read_at`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 'Mensagem não encontrada.', 404);
    return ok(res, rows[0]);
  })
);

// POST /api/admin/support-messages/read-all — marca todas como lidas.
router.post(
  '/support-messages/read-all',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'UPDATE support_messages SET read_at = now() WHERE read_at IS NULL'
    );
    return ok(res, { updated: rowCount }, `${rowCount} mensagem(ns) marcada(s) como lida(s).`);
  })
);

// DELETE /api/admin/support-messages/:id
router.delete(
  '/support-messages/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query('DELETE FROM support_messages WHERE id = $1', [req.params.id]);
    if (!rowCount) return fail(res, 'Mensagem não encontrada.', 404);
    return ok(res, null, 'Mensagem removida.');
  })
);

module.exports = router;
