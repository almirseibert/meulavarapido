const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

// GET /api/helpers — colaboradores com saldo (diárias - vales - pagamentos)
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT h.*,
              COALESCE(SUM(CASE WHEN e.type = 'AjudaDiaria'   THEN e.value ELSE 0 END), 0)::float AS total_diarias,
              COALESCE(SUM(CASE WHEN e.type = 'AjudaVale'     THEN e.value ELSE 0 END), 0)::float AS total_vales,
              COALESCE(SUM(CASE WHEN e.type = 'AjudaPagamento' THEN e.value ELSE 0 END), 0)::float AS total_pagamentos
         FROM helpers h
         LEFT JOIN expenses e ON e.helper_id = h.id AND e.owner_id = h.owner_id
        WHERE h.owner_id = $1
        GROUP BY h.id
        ORDER BY h.active DESC, h.name ASC`,
      [req.owner.id]
    );
    const data = rows.map((h) => ({
      ...h,
      saldo: h.total_diarias - h.total_vales - h.total_pagamentos,
    }));
    return ok(res, data);
  })
);

// POST /api/helpers
router.post(
  '/',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return fail(res, 'Informe o nome do colaborador.');
    const { rows } = await query(
      `INSERT INTO helpers (owner_id, name, daily_rate, active)
       VALUES ($1,$2,$3,COALESCE($4,true)) RETURNING *`,
      [req.owner.id, name, Number(req.body.daily_rate) || 0, req.body.active]
    );
    return ok(res, { ...rows[0], saldo: 0 }, 'Colaborador criado.', 201);
  })
);

// PUT /api/helpers/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE helpers SET
         name = COALESCE($1, name),
         daily_rate = COALESCE($2, daily_rate),
         active = COALESCE($3, active)
       WHERE id = $4 AND owner_id = $5 RETURNING *`,
      [
        req.body.name ?? null,
        req.body.daily_rate ?? null,
        req.body.active ?? null,
        req.params.id,
        req.owner.id,
      ]
    );
    if (!rows.length) return fail(res, 'Colaborador não encontrado.', 404);
    return ok(res, rows[0], 'Colaborador atualizado.');
  })
);

// PATCH /api/helpers/:id/active — alternar ativo/inativo
router.patch(
  '/:id/active',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE helpers SET active = NOT active
       WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [req.params.id, req.owner.id]
    );
    if (!rows.length) return fail(res, 'Colaborador não encontrado.', 404);
    return ok(res, rows[0]);
  })
);

// DELETE /api/helpers/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM helpers WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Colaborador não encontrado.', 404);
    return ok(res, null, 'Colaborador removido.');
  })
);

module.exports = router;
