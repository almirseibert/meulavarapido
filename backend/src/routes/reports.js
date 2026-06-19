const express = require('express');
const { query } = require('../db');
const { ok, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Monta o filtro de período (from/to) reaproveitável.
function periodWhere(params, from, to) {
  let where = '';
  if (from) { params.push(from); where += ` AND date >= $${params.length}`; }
  if (to) { params.push(to); where += ` AND date <= $${params.length}`; }
  return where;
}

// GET /api/reports/washes?from&to&client_id — lavagens por período/cliente
router.get(
  '/washes',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    where += periodWhere(params, req.query.from, req.query.to);
    if (req.query.client_id) {
      params.push(req.query.client_id);
      where += ` AND client_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT * FROM washes WHERE ${where} ORDER BY date DESC`,
      params
    );
    const total = rows.reduce((a, w) => a + Number(w.price || 0), 0);
    return ok(res, { items: rows, total, count: rows.length });
  })
);

// GET /api/reports/by-vehicle?from&to — lavagens agrupadas por marca do veículo
router.get(
  '/by-vehicle',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = 'w.owner_id = $1';
    if (req.query.from) { params.push(req.query.from); where += ` AND w.date >= $${params.length}`; }
    if (req.query.to) { params.push(req.query.to); where += ` AND w.date <= $${params.length}`; }
    const { rows } = await query(
      `SELECT COALESCE(NULLIF(TRIM(v.make), ''), 'Outros') AS make,
              COUNT(*)::int AS count,
              COALESCE(SUM(w.price), 0)::float AS total
         FROM washes w
         LEFT JOIN vehicles v ON v.id = w.vehicle_id
        WHERE ${where}
        GROUP BY 1
        ORDER BY total DESC`,
      params
    );
    const total = rows.reduce((a, r) => a + Number(r.total || 0), 0);
    return ok(res, { groups: rows, total });
  })
);

// GET /api/reports/open?client_id — lavagens em aberto (faturamento posterior a receber)
router.get(
  '/open',
  wrap(async (req, res) => {
    const params = [req.owner.id];
    let where = `owner_id = $1 AND is_charged = false AND payment_type = 'Faturamento Posterior'`;
    if (req.query.client_id) {
      params.push(req.query.client_id);
      where += ` AND client_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT * FROM washes WHERE ${where} ORDER BY client_name ASC, date ASC`,
      params
    );
    const total = rows.reduce((a, w) => a + Number(w.price || 0), 0);
    return ok(res, { items: rows, total, count: rows.length });
  })
);

module.exports = router;
