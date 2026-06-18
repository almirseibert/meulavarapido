const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const COLS = ['name', 'company_name', 'document', 'phone', 'whatsapp', 'email', 'address', 'products', 'notes'];

// GET /api/suppliers?search=
router.get(
  '/',
  wrap(async (req, res) => {
    const search = (req.query.search || '').trim();
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $2 OR company_name ILIKE $2 OR products ILIKE $2)`;
    }
    const { rows } = await query(`SELECT * FROM suppliers WHERE ${where} ORDER BY name`, params);
    return ok(res, rows);
  })
);

// POST /api/suppliers
router.post(
  '/',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return fail(res, 'Informe o nome do fornecedor.');
    const vals = [req.owner.id, ...COLS.map((c) => req.body[c] ?? null)];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await query(
      `INSERT INTO suppliers (owner_id, ${COLS.join(',')}) VALUES (${placeholders}) RETURNING *`,
      vals
    );
    return ok(res, rows[0], 'Fornecedor cadastrado.', 201);
  })
);

// PUT /api/suppliers/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const sets = COLS.map((c, i) => `${c} = COALESCE($${i + 1}, ${c})`).join(', ');
    const vals = [...COLS.map((c) => req.body[c] ?? null), req.params.id, req.owner.id];
    const { rows } = await query(
      `UPDATE suppliers SET ${sets} WHERE id = $${COLS.length + 1} AND owner_id = $${COLS.length + 2} RETURNING *`,
      vals
    );
    if (!rows.length) return fail(res, 'Fornecedor não encontrado.', 404);
    return ok(res, rows[0], 'Fornecedor atualizado.');
  })
);

// DELETE /api/suppliers/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM suppliers WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Fornecedor não encontrado.', 404);
    return ok(res, null, 'Fornecedor removido.');
  })
);

module.exports = router;
