const express = require('express');
const { query } = require('../db');
const { ok, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard?month=YYYY-MM  — KPIs do mês
router.get(
  '/',
  wrap(async (req, res) => {
    const id = req.owner.id;
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
      ? req.query.month
      : new Date().toISOString().slice(0, 7);
    const start = `${month}-01`;

    const [clients, washMonth, washToday, revenueMonth, receivable, expensesMonth, upcoming] =
      await Promise.all([
        query('SELECT COUNT(*)::int c FROM clients WHERE owner_id = $1', [id]),
        query(
          `SELECT COUNT(*)::int c, COALESCE(SUM(price),0)::float total FROM washes
            WHERE owner_id = $1 AND date >= $2::date AND date < ($2::date + interval '1 month')`,
          [id, start]
        ),
        query(
          `SELECT COUNT(*)::int c, COALESCE(SUM(price),0)::float total FROM washes
            WHERE owner_id = $1
              AND (date AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`,
          [id]
        ),
        Promise.resolve(null),
        query(
          `SELECT COALESCE(SUM(price),0)::float total FROM washes
            WHERE owner_id = $1 AND is_charged = false`,
          [id]
        ),
        query(
          `SELECT COALESCE(SUM(value),0)::float total FROM expenses
            WHERE owner_id = $1 AND is_paid = true
              AND date >= $2::date AND date < ($2::date + interval '1 month')`,
          [id, start]
        ),
        query(
          `SELECT * FROM schedules WHERE owner_id = $1 AND date >= now() ORDER BY date ASC LIMIT 5`,
          [id]
        ),
      ]);

    return ok(res, {
      month,
      clients: clients.rows[0].c,
      washesMonth: washMonth.rows[0].c,
      revenueMonth: washMonth.rows[0].total,
      washesToday: washToday.rows[0].c,
      revenueToday: washToday.rows[0].total,
      receivable: receivable.rows[0].total,
      expensesMonth: expensesMonth.rows[0].total,
      upcoming: upcoming.rows,
    });
  })
);

module.exports = router;
