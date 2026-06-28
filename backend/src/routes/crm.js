const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

const DEFAULT_MESSAGE =
  'Notamos que faz um tempinho que seu veículo não nos visita. Que tal agendar uma lavagem e deixá-lo brilhando novamente?';

// Busca (ou cria) as configurações de CRM do owner.
async function getSettings(ownerId) {
  const { rows } = await query('SELECT * FROM crm_settings WHERE owner_id = $1', [ownerId]);
  if (rows.length) return rows[0];
  const { rows: created } = await query(
    `INSERT INTO crm_settings (owner_id, message_body) VALUES ($1, $2) RETURNING *`,
    [ownerId, DEFAULT_MESSAGE]
  );
  return created[0];
}

// GET /api/crm/settings
router.get('/settings', wrap(async (req, res) => {
  return ok(res, await getSettings(req.owner.id));
}));

// PUT /api/crm/settings
router.put('/settings', wrap(async (req, res) => {
  await getSettings(req.owner.id); // garante linha existente
  const b = req.body;
  const { rows } = await query(
    `UPDATE crm_settings SET
       inactivity_days = COALESCE($1, inactivity_days),
       snooze_days = COALESCE($2, snooze_days),
       message_body = COALESCE($3, message_body),
       updated_at = now()
     WHERE owner_id = $4 RETURNING *`,
    [b.inactivity_days ?? null, b.snooze_days ?? null, b.message_body ?? null, req.owner.id]
  );
  return ok(res, rows[0], 'Configurações salvas.');
}));

// GET /api/crm/inactive — clientes sem lavar há mais de N dias, fora de snooze/ignorados
router.get('/inactive', wrap(async (req, res) => {
  const settings = await getSettings(req.owner.id);
  const { rows } = await query(
    `SELECT c.id AS client_id, c.name, c.phone,
            MAX(w.date) AS last_wash_date,
            cb.last_contact_date
       FROM clients c
       JOIN washes w ON w.client_id = c.id AND w.owner_id = c.owner_id
       LEFT JOIN crm_callbacks cb ON cb.client_id = c.id AND cb.owner_id = c.owner_id
      WHERE c.owner_id = $1
        AND COALESCE(cb.is_ignored, false) = false
      GROUP BY c.id, cb.last_contact_date, cb.next_contact_date
     HAVING MAX(w.date) <= now() - ($2 || ' days')::interval
        AND (cb.next_contact_date IS NULL OR cb.next_contact_date <= now())
      ORDER BY MAX(w.date) ASC`,
    [req.owner.id, String(settings.inactivity_days)]
  );
  return ok(res, { settings, clients: rows });
}));

// POST /api/crm/:clientId/contact — registra contato e agenda próximo aviso (snooze)
router.post('/:clientId/contact', wrap(async (req, res) => {
  const settings = await getSettings(req.owner.id);
  const snooze = Number(req.body.snooze_days ?? settings.snooze_days) || 0;
  const { rows } = await query(
    `INSERT INTO crm_callbacks (owner_id, client_id, last_contact_date, next_contact_date, is_ignored)
     VALUES ($1, $2, now(), now() + ($3 || ' days')::interval, false)
     ON CONFLICT (owner_id, client_id) DO UPDATE SET
       last_contact_date = excluded.last_contact_date,
       next_contact_date = excluded.next_contact_date,
       is_ignored = false
     RETURNING *`,
    [req.owner.id, req.params.clientId, String(snooze)]
  );
  return ok(res, rows[0], 'Contato registrado.');
}));

// POST /api/crm/:clientId/ignore — não exibir mais este cliente
router.post('/:clientId/ignore', wrap(async (req, res) => {
  const { rows } = await query(
    `INSERT INTO crm_callbacks (owner_id, client_id, is_ignored)
     VALUES ($1, $2, true)
     ON CONFLICT (owner_id, client_id) DO UPDATE SET is_ignored = true
     RETURNING *`,
    [req.owner.id, req.params.clientId]
  );
  return ok(res, rows[0], 'Cliente ignorado.');
}));

module.exports = router;
