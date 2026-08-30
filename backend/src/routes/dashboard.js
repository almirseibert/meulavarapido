const express = require('express');
const { query } = require('../db');
const { ok, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Resolve o período exibido: ?from&to (ISO) tem prioridade; senão ?month=YYYY-MM;
// sem nada, o mês atual. Devolve limites [from, to) já no fuso de operação, para
// que "agosto" comece à meia-noite de São Paulo e não à meia-noite UTC.
const TZ = 'America/Sao_Paulo';

async function resolvePeriod(q) {
  if (q.from && q.to) {
    return { from: q.from, to: q.to, month: null, label: 'periodo' };
  }
  const month = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : new Date().toISOString().slice(0, 7);
  const { rows } = await query(
    `SELECT ($1::date AT TIME ZONE $2) AS from_ts,
            (($1::date + interval '1 month') AT TIME ZONE $2) AS to_ts`,
    [`${month}-01`, TZ]
  );
  return { from: rows[0].from_ts, to: rows[0].to_ts, month, label: 'mes' };
}

// GET /api/dashboard?month=YYYY-MM | ?from=ISO&to=ISO — KPIs do período
router.get(
  '/',
  wrap(async (req, res) => {
    const id = req.owner.id;
    const { from, to, month, label } = await resolvePeriod(req.query);

    const [clients, washPeriod, washToday, receivable, expensesPeriod, upcoming] = await Promise.all([
      query('SELECT COUNT(*)::int c FROM clients WHERE owner_id = $1', [id]),
      query(
        `SELECT COUNT(*)::int c, COALESCE(SUM(price),0)::float total FROM washes
          WHERE owner_id = $1 AND date >= $2 AND date < $3`,
        [id, from, to]
      ),
      query(
        `SELECT COUNT(*)::int c, COALESCE(SUM(price),0)::float total FROM washes
          WHERE owner_id = $1
            AND (date AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date`,
        [id]
      ),
      // "A receber" = TODO o valor ainda não recebido (não se limita ao período nem
      // à forma de pagamento). É o mesmo conjunto que o relatório "Lavagens em
      // aberto" lista e permite baixar — os dois números têm de bater.
      query(
        `SELECT COALESCE(SUM(price),0)::float total, COUNT(*)::int c FROM washes
          WHERE owner_id = $1 AND is_charged = false`,
        [id]
      ),
      query(
        `SELECT COALESCE(SUM(value),0)::float total FROM expenses
          WHERE owner_id = $1 AND is_paid = true AND date >= $2 AND date < $3`,
        [id, from, to]
      ),
      query(
        `SELECT * FROM schedules WHERE owner_id = $1 AND date >= now() ORDER BY date ASC LIMIT 5`,
        [id]
      ),
    ]);

    return ok(res, {
      month,
      period: { from, to, kind: label },
      clients: clients.rows[0].c,
      washesMonth: washPeriod.rows[0].c,
      revenueMonth: washPeriod.rows[0].total,
      washesToday: washToday.rows[0].c,
      revenueToday: washToday.rows[0].total,
      receivable: receivable.rows[0].total,
      receivableCount: receivable.rows[0].c,
      expensesMonth: expensesPeriod.rows[0].total,
      upcoming: upcoming.rows,
    });
  })
);

module.exports = router;
