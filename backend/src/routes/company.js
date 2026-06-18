const express = require('express');
const { query } = require('../db');
const { ok, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const FIELDS = [
  'name', 'document', 'address', 'city', 'state', 'zip',
  'phone', 'whatsapp', 'email', 'instagram', 'logo_url', 'receipt_footer',
];

// GET /api/company — dados da lavagem (usados em recibos/orçamentos)
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query('SELECT * FROM company_settings WHERE owner_id = $1', [req.owner.id]);
    if (!rows.length) {
      await query('INSERT INTO company_settings (owner_id) VALUES ($1)', [req.owner.id]);
      return ok(res, { owner_id: req.owner.id });
    }
    return ok(res, rows[0]);
  })
);

// PUT /api/company — atualizar dados editáveis
router.put(
  '/',
  wrap(async (req, res) => {
    const updates = [];
    const values = [];
    let i = 1;
    for (const f of FIELDS) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        values.push(req.body[f]);
      }
    }
    if (!updates.length) {
      const { rows } = await query('SELECT * FROM company_settings WHERE owner_id = $1', [req.owner.id]);
      return ok(res, rows[0]);
    }
    updates.push(`updated_at = now()`);
    values.push(req.owner.id);

    const { rows } = await query(
      `INSERT INTO company_settings (owner_id) VALUES ($${i})
       ON CONFLICT (owner_id) DO UPDATE SET ${updates.join(', ')}
       RETURNING *`,
      values
    );
    return ok(res, rows[0], 'Dados da lavagem atualizados.');
  })
);

module.exports = router;
