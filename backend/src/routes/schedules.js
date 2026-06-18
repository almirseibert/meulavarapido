const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/schedules?upcoming=1
router.get(
  '/',
  wrap(async (req, res) => {
    const onlyUpcoming = req.query.upcoming === '1';
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (onlyUpcoming) where += ' AND date >= now()';
    const { rows } = await query(
      `SELECT * FROM schedules WHERE ${where} ORDER BY date ASC LIMIT 200`,
      params
    );
    return ok(res, rows);
  })
);

// POST /api/schedules
router.post(
  '/',
  wrap(async (req, res) => {
    const b = req.body;
    if (!b.date) return fail(res, 'Informe a data do agendamento.');
    const { rows } = await query(
      `INSERT INTO schedules
         (owner_id, client_id, vehicle_id, client_name, vehicle_info, date, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.owner.id, b.client_id || null, b.vehicle_id || null, b.client_name || null,
       b.vehicle_info || null, b.date, b.observations || null]
    );
    return ok(res, rows[0], 'Agendamento criado.', 201);
  })
);

// PUT /api/schedules/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE schedules SET
         client_id = COALESCE($1, client_id),
         vehicle_id = COALESCE($2, vehicle_id),
         client_name = COALESCE($3, client_name),
         vehicle_info = COALESCE($4, vehicle_info),
         date = COALESCE($5, date),
         observations = COALESCE($6, observations)
       WHERE id = $7 AND owner_id = $8 RETURNING *`,
      [b.client_id ?? null, b.vehicle_id ?? null, b.client_name ?? null, b.vehicle_info ?? null,
       b.date ?? null, b.observations ?? null, req.params.id, req.owner.id]
    );
    if (!rows.length) return fail(res, 'Agendamento não encontrado.', 404);
    return ok(res, rows[0], 'Agendamento atualizado.');
  })
);

// DELETE /api/schedules/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM schedules WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Agendamento não encontrado.', 404);
    return ok(res, null, 'Agendamento removido.');
  })
);

module.exports = router;
