const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/expenses?from=&to=
router.get(
  '/',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (req.query.from) { params.push(req.query.from); where += ` AND date >= $${params.length}`; }
    if (req.query.to) { params.push(req.query.to); where += ` AND date <= $${params.length}`; }
    const { rows } = await query(
      `SELECT * FROM expenses WHERE ${where} ORDER BY date DESC LIMIT 500`,
      params
    );
    return ok(res, rows);
  })
);

// POST /api/expenses
router.post(
  '/',
  wrap(async (req, res) => {
    const b = req.body;
    if (!b.type) return fail(res, 'Informe o tipo da despesa.');
    const { rows } = await query(
      `INSERT INTO expenses
         (owner_id, type, date, description, value, is_paid, supplier_id, supplier_name)
       VALUES ($1,$2,COALESCE($3, now()),$4,$5,COALESCE($6,false),$7,$8) RETURNING *`,
      [req.owner.id, b.type, b.date || null, b.description || null, Number(b.value) || 0,
       b.is_paid, b.supplier_id || null, b.supplier_name || null]
    );
    return ok(res, rows[0], 'Despesa registrada.', 201);
  })
);

// PUT /api/expenses/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `UPDATE expenses SET
         type = COALESCE($1, type),
         date = COALESCE($2, date),
         description = COALESCE($3, description),
         value = COALESCE($4, value),
         is_paid = COALESCE($5, is_paid),
         supplier_id = COALESCE($6, supplier_id),
         supplier_name = COALESCE($7, supplier_name)
       WHERE id = $8 AND owner_id = $9 RETURNING *`,
      [b.type ?? null, b.date ?? null, b.description ?? null, b.value ?? null, b.is_paid ?? null,
       b.supplier_id ?? null, b.supplier_name ?? null, req.params.id, req.owner.id]
    );
    if (!rows.length) return fail(res, 'Despesa não encontrada.', 404);
    return ok(res, rows[0], 'Despesa atualizada.');
  })
);

// DELETE /api/expenses/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM expenses WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Despesa não encontrada.', 404);
    return ok(res, null, 'Despesa removida.');
  })
);

module.exports = router;
