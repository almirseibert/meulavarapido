const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { washesToday, FREE_LIMITS } = require('../utils/plan');

const router = express.Router();
router.use(requireAuth);

// GET /api/washes?from=&to=
router.get(
  '/',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (req.query.from) {
      params.push(req.query.from);
      where += ` AND date >= $${params.length}`;
    }
    if (req.query.to) {
      params.push(req.query.to);
      where += ` AND date <= $${params.length}`;
    }
    const { rows } = await query(
      `SELECT * FROM washes WHERE ${where} ORDER BY date DESC LIMIT 500`,
      params
    );
    return ok(res, rows);
  })
);

// POST /api/washes
// Plano free: a partir da 6ª lavagem do dia exige confirmação de anúncio (via_ad=true).
router.post(
  '/',
  wrap(async (req, res) => {
    const b = req.body;
    if (!req.owner.isPremium) {
      const count = await washesToday(req.owner.id);
      if (count >= FREE_LIMITS.washesPerDay && !b.ad_watched) {
        return fail(
          res,
          `Limite de ${FREE_LIMITS.washesPerDay} lavagens diárias no plano gratuito. Assista a um vídeo para registrar esta lavagem ou assine o plano premium.`,
          402,
          { requiresAd: true }
        );
      }
    }

    const services = Array.isArray(b.services) ? b.services : [];
    const { rows } = await query(
      `INSERT INTO washes
         (owner_id, client_id, vehicle_id, client_name, vehicle_info, date,
          price, payment_type, is_charged, services, observations)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, now()),$7,$8,COALESCE($9,true),$10,$11)
       RETURNING *`,
      [
        req.owner.id,
        b.client_id || null,
        b.vehicle_id || null,
        b.client_name || null,
        b.vehicle_info || null,
        b.date || null,
        Number(b.price) || 0,
        b.payment_type || null,
        b.is_charged,
        JSON.stringify(services),
        b.observations || null,
      ]
    );
    return ok(res, rows[0], 'Lavagem registrada.', 201);
  })
);

// PUT /api/washes/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const b = req.body;
    const services = b.services !== undefined ? JSON.stringify(b.services) : null;
    const { rows } = await query(
      `UPDATE washes SET
         client_id = COALESCE($1, client_id),
         vehicle_id = COALESCE($2, vehicle_id),
         client_name = COALESCE($3, client_name),
         vehicle_info = COALESCE($4, vehicle_info),
         date = COALESCE($5, date),
         price = COALESCE($6, price),
         payment_type = COALESCE($7, payment_type),
         is_charged = COALESCE($8, is_charged),
         services = COALESCE($9::jsonb, services),
         observations = COALESCE($10, observations)
       WHERE id = $11 AND owner_id = $12 RETURNING *`,
      [
        b.client_id ?? null, b.vehicle_id ?? null, b.client_name ?? null, b.vehicle_info ?? null,
        b.date ?? null, b.price ?? null, b.payment_type ?? null, b.is_charged ?? null,
        services, b.observations ?? null, req.params.id, req.owner.id,
      ]
    );
    if (!rows.length) return fail(res, 'Lavagem não encontrada.', 404);
    return ok(res, rows[0], 'Lavagem atualizada.');
  })
);

// PATCH /api/washes/:id/charge — alternar pago/aberto
router.patch(
  '/:id/charge',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE washes SET is_charged = NOT is_charged
       WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [req.params.id, req.owner.id]
    );
    if (!rows.length) return fail(res, 'Lavagem não encontrada.', 404);
    return ok(res, rows[0]);
  })
);

// DELETE /api/washes/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM washes WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Lavagem não encontrada.', 404);
    return ok(res, null, 'Lavagem removida.');
  })
);

module.exports = router;
