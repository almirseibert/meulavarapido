const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');
const { usageSummary } = require('../utils/plan');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

// GET /api/documents/usage — resumo de limites (lavagens/recibos/orçamentos)
router.get(
  '/usage',
  wrap(async (req, res) => {
    const data = await usageSummary(req.owner);
    return ok(res, data);
  })
);

// GET /api/documents?kind=receipt|quote
router.get(
  '/',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (req.query.kind) { params.push(req.query.kind); where += ` AND kind = $${params.length}`; }
    const { rows } = await query(
      `SELECT * FROM documents WHERE ${where} ORDER BY created_at DESC LIMIT 300`,
      params
    );
    return ok(res, rows);
  })
);

// POST /api/documents — registra recibo/orçamento emitido (gera o número sequencial)
router.post(
  '/',
  wrap(async (req, res) => {
    const b = req.body;
    const kind = b.kind === 'quote' ? 'quote' : 'receipt';

    // número sequencial por owner + kind
    const seq = await query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS n FROM documents WHERE owner_id = $1 AND kind = $2',
      [req.owner.id, kind]
    );
    const number = seq.rows[0].n;

    const { rows } = await query(
      `INSERT INTO documents
         (owner_id, kind, number, client_name, vehicle_info, items, total, payment_type, observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        req.owner.id, kind, number, b.client_name || null, b.vehicle_info || null,
        JSON.stringify(Array.isArray(b.items) ? b.items : []), Number(b.total) || 0,
        b.payment_type || null, b.observations || null,
      ]
    );
    return ok(res, rows[0], kind === 'quote' ? 'Orçamento registrado.' : 'Recibo registrado.', 201);
  })
);

module.exports = router;
