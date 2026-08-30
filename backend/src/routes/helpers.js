const express = require('express');
const { query, withTransaction } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

// Modelo financeiro do colaborador (tudo vive na tabela expenses, com helper_id):
//  - DÉBITOS  (aumentam o que a lavagem deve): AjudaDiaria, AjudaBonus.
//  - CRÉDITOS (abatem o que a lavagem deve):   AjudaVale, AjudaPagamento e
//    qualquer DÉBITO já marcado como pago em Despesas (a liquidação da despesa
//    É o pagamento daquele lançamento).
//  saldo = débitos - créditos. Zerou, está quitado.
const DEBIT_TYPES = ['AjudaDiaria', 'AjudaBonus'];
const CREDIT_TYPES = ['AjudaVale', 'AjudaPagamento'];

const BALANCE_SELECT = `
  COALESCE(SUM(CASE WHEN e.type = ANY($2) THEN e.value ELSE 0 END), 0)::float                          AS total_debitos,
  COALESCE(SUM(CASE WHEN e.type = 'AjudaDiaria' THEN e.value ELSE 0 END), 0)::float                     AS total_diarias,
  COALESCE(SUM(CASE WHEN e.type = 'AjudaBonus'  THEN e.value ELSE 0 END), 0)::float                     AS total_bonus,
  COALESCE(SUM(CASE WHEN e.type = 'AjudaVale'   THEN e.value ELSE 0 END), 0)::float                     AS total_vales,
  COALESCE(SUM(CASE WHEN e.type = 'AjudaPagamento' THEN e.value ELSE 0 END), 0)::float                  AS total_pagamentos,
  COALESCE(SUM(CASE WHEN e.type = ANY($2) AND e.is_paid THEN e.value ELSE 0 END), 0)::float             AS total_debitos_pagos
`;

const withSaldo = (h) => ({
  ...h,
  // Créditos = vales + pagamentos + débitos já liquidados nas Despesas.
  saldo: h.total_debitos - h.total_vales - h.total_pagamentos - h.total_debitos_pagos,
});

// GET /api/helpers — colaboradores com saldo em aberto
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT h.*, ${BALANCE_SELECT}
         FROM helpers h
         LEFT JOIN expenses e ON e.helper_id = h.id AND e.owner_id = h.owner_id
        WHERE h.owner_id = $1
        GROUP BY h.id
        ORDER BY h.active DESC, h.name ASC`,
      [req.owner.id, DEBIT_TYPES]
    );
    return ok(res, rows.map(withSaldo));
  })
);

// GET /api/helpers/:id/statement — extrato dos lançamentos do colaborador
router.get(
  '/:id/statement',
  wrap(async (req, res) => {
    const helper = await query('SELECT * FROM helpers WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      req.owner.id,
    ]);
    if (!helper.rows.length) return fail(res, 'Colaborador não encontrado.', 404);

    const { rows: items } = await query(
      `SELECT id, type, date, description, value::float, is_paid
         FROM expenses
        WHERE owner_id = $1 AND helper_id = $2
        ORDER BY date DESC, created_at DESC
        LIMIT 300`,
      [req.owner.id, req.params.id]
    );
    const totals = await query(
      `SELECT ${BALANCE_SELECT}
         FROM expenses e
        WHERE e.owner_id = $1 AND e.helper_id = $3`,
      [req.owner.id, DEBIT_TYPES, req.params.id]
    );
    return ok(res, { helper: withSaldo({ ...helper.rows[0], ...totals.rows[0] }), items });
  })
);

// POST /api/helpers/:id/settle — liquida o montante devido ao colaborador.
// Body: { value? (padrão: saldo cheio), date? }.
// Baixa os débitos em aberto do mais antigo para o mais novo; a sobra (quando o
// valor não fecha um débito inteiro) vira um lançamento de Pagamento.
router.post(
  '/:id/settle',
  wrap(async (req, res) => {
    const helper = await query('SELECT * FROM helpers WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      req.owner.id,
    ]);
    if (!helper.rows.length) return fail(res, 'Colaborador não encontrado.', 404);

    const totals = await query(
      `SELECT ${BALANCE_SELECT} FROM expenses e WHERE e.owner_id = $1 AND e.helper_id = $3`,
      [req.owner.id, DEBIT_TYPES, req.params.id]
    );
    const saldo = Math.round(withSaldo(totals.rows[0]).saldo * 100) / 100;
    if (saldo <= 0) return fail(res, 'Este colaborador não tem saldo em aberto.');

    let amount = req.body.value != null ? Number(req.body.value) || 0 : saldo;
    if (amount <= 0) return fail(res, 'Informe um valor válido.');
    if (amount > saldo) amount = saldo;

    const result = await withTransaction(async (c) => {
      const { rows: open } = await c.query(
        `SELECT id, value::float FROM expenses
          WHERE owner_id = $1 AND helper_id = $2 AND is_paid = false AND type = ANY($3)
          ORDER BY date ASC, created_at ASC`,
        [req.owner.id, req.params.id, DEBIT_TYPES]
      );

      let remaining = amount;
      const settledIds = [];
      for (const e of open) {
        if (remaining + 0.005 < e.value) break;   // não cobre o lançamento inteiro
        remaining = Math.round((remaining - e.value) * 100) / 100;
        settledIds.push(e.id);
      }
      if (settledIds.length) {
        await c.query(
          `UPDATE expenses SET is_paid = true WHERE owner_id = $1 AND id = ANY($2::uuid[])`,
          [req.owner.id, settledIds]
        );
      }
      // Sobra vira um Pagamento avulso (também abate o saldo).
      if (remaining > 0.004) {
        await c.query(
          `INSERT INTO expenses (owner_id, type, date, description, value, is_paid, helper_id, helper_name)
           VALUES ($1, 'AjudaPagamento', COALESCE($2, now()), $3, $4, true, $5, $6)`,
          [
            req.owner.id,
            req.body.date || null,
            `Pagamento (acerto): ${helper.rows[0].name}`,
            remaining,
            req.params.id,
            helper.rows[0].name,
          ]
        );
      }
      return { settled: settledIds.length, leftover: remaining };
    });

    const after = await query(
      `SELECT ${BALANCE_SELECT} FROM expenses e WHERE e.owner_id = $1 AND e.helper_id = $3`,
      [req.owner.id, DEBIT_TYPES, req.params.id]
    );
    const saldoFinal = withSaldo(after.rows[0]).saldo;
    return ok(
      res,
      { paid: amount, ...result, saldo: saldoFinal },
      saldoFinal <= 0.004 ? 'Saldo quitado.' : 'Pagamento registrado. Saldo atualizado.'
    );
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
