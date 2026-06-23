const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { washesToday, FREE_LIMITS } = require('../utils/plan');

const router = express.Router();
router.use(requireAuth);

// GET /api/washes
// Filtros: from, to, client_id, vehicle_id, payment_type, status (open|paid),
//          credit_only (clientes a prazo), pickup (tele-busca ativa).
router.get(
  '/',
  wrap(async (req, res) => {
    const q = req.query;
    const params = [req.owner.id];
    let where = 'w.owner_id = $1';
    const add = (val, clause) => { params.push(val); return clause.replace('$$', `$${params.length}`); };

    if (q.from)         where += add(q.from, ' AND w.date >= $$');
    if (q.to)           where += add(q.to, ' AND w.date <= $$');
    if (q.client_id)    where += add(q.client_id, ' AND w.client_id = $$');
    if (q.vehicle_id)   where += add(q.vehicle_id, ' AND w.vehicle_id = $$');
    if (q.payment_type) where += add(q.payment_type, ' AND w.payment_type = $$');
    if (q.status === 'open') where += ' AND w.is_charged = false';
    if (q.status === 'paid') where += ' AND w.is_charged = true';
    // Apenas lavagens de clientes configurados para pagar a prazo.
    if (q.credit_only)  where += ' AND c.allow_credit = true';
    // Tele-busca: somente itens com busca ativa (status diferente de concluído).
    if (q.pickup) where += ` AND w.pickup = true AND COALESCE(w.pickup_status, '') <> 'concluido'`;

    const order = q.pickup ? 'w.date ASC' : 'w.date DESC';
    const { rows } = await query(
      `SELECT w.*, c.allow_credit AS client_allow_credit, c.phone AS client_phone
         FROM washes w
         LEFT JOIN clients c ON c.id = w.client_id
        WHERE ${where} ORDER BY ${order} LIMIT 1000`,
      params
    );
    return ok(res, rows);
  })
);

// POST /api/washes/settle — baixa em lote (marca lavagens em aberto como pagas).
// Body: { ids?: [], from?, to?, client_id?, payment_type? }. Sem ids, usa filtros.
router.post(
  '/settle',
  wrap(async (req, res) => {
    const b = req.body || {};
    const params = [req.owner.id];
    let where = 'owner_id = $1 AND is_charged = false';
    if (Array.isArray(b.ids) && b.ids.length) {
      params.push(b.ids);
      where += ` AND id = ANY($${params.length}::uuid[])`;
    } else {
      if (b.from)         { params.push(b.from); where += ` AND date >= $${params.length}`; }
      if (b.to)           { params.push(b.to); where += ` AND date <= $${params.length}`; }
      if (b.client_id)    { params.push(b.client_id); where += ` AND client_id = $${params.length}`; }
      if (b.payment_type) { params.push(b.payment_type); where += ` AND payment_type = $${params.length}`; }
    }
    const { rowCount } = await query(
      `UPDATE washes SET is_charged = true WHERE ${where}`,
      params
    );
    return ok(res, { settled: rowCount }, `${rowCount} lavagem(ns) marcada(s) como paga(s).`);
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
          price, payment_type, is_charged, services, observations,
          pickup, pickup_address, pickup_fee, pickup_status, pickup_time)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, now()),$7,$8,COALESCE($9,true),$10,$11,
               COALESCE($12,false),$13,COALESCE($14,0),$15,$16)
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
        b.pickup,
        b.pickup_address || null,
        b.pickup_fee != null ? Number(b.pickup_fee) || 0 : null,
        b.pickup ? (b.pickup_status || 'a_buscar') : null,
        b.pickup ? (b.pickup_time || null) : null,
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
         observations = COALESCE($10, observations),
         pickup = COALESCE($13, pickup),
         pickup_address = COALESCE($14, pickup_address),
         pickup_fee = COALESCE($15, pickup_fee),
         pickup_status = COALESCE($16, pickup_status),
         pickup_time = COALESCE($17, pickup_time)
       WHERE id = $11 AND owner_id = $12 RETURNING *`,
      [
        b.client_id ?? null, b.vehicle_id ?? null, b.client_name ?? null, b.vehicle_info ?? null,
        b.date ?? null, b.price ?? null, b.payment_type ?? null, b.is_charged ?? null,
        services, b.observations ?? null, req.params.id, req.owner.id,
        b.pickup ?? null, b.pickup_address ?? null, b.pickup_fee ?? null, b.pickup_status ?? null,
        b.pickup_time ?? null,
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

// PATCH /api/washes/:id/pickup-status — define o status da tele-busca
router.patch(
  '/:id/pickup-status',
  wrap(async (req, res) => {
    const valid = ['a_buscar', 'em_servico', 'a_entregar', 'concluido'];
    const status = valid.includes(req.body.status) ? req.body.status : null;
    if (!status) return fail(res, 'Status inválido.');
    const { rows } = await query(
      `UPDATE washes SET pickup_status = $1
       WHERE id = $2 AND owner_id = $3 RETURNING *`,
      [status, req.params.id, req.owner.id]
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
