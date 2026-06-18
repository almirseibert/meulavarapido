const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/services
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query(
      'SELECT * FROM services WHERE owner_id = $1 ORDER BY sort_order, name',
      [req.owner.id]
    );
    return ok(res, rows);
  })
);

// POST /api/services
router.post(
  '/',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price) || 0;
    if (!name) return fail(res, 'Informe o nome do serviço.');
    const sort = Number(req.body.sort_order) || 0;
    const { rows } = await query(
      `INSERT INTO services (owner_id, name, price, active, sort_order)
       VALUES ($1, $2, $3, COALESCE($4, true), $5) RETURNING *`,
      [req.owner.id, name, price, req.body.active ?? true, sort]
    );
    return ok(res, rows[0], 'Serviço criado.', 201);
  })
);

// PUT /api/services/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE services SET
         name = COALESCE($1, name),
         price = COALESCE($2, price),
         active = COALESCE($3, active),
         sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND owner_id = $6 RETURNING *`,
      [
        req.body.name ?? null,
        req.body.price ?? null,
        req.body.active ?? null,
        req.body.sort_order ?? null,
        req.params.id,
        req.owner.id,
      ]
    );
    if (!rows.length) return fail(res, 'Serviço não encontrado.', 404);
    return ok(res, rows[0], 'Serviço atualizado.');
  })
);

// DELETE /api/services/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM services WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Serviço não encontrado.', 404);
    return ok(res, null, 'Serviço removido.');
  })
);

module.exports = router;
