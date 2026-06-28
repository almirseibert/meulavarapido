const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

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
    // CNPJ/CPF é único entre contas (anti-abuso). Valida aqui para devolver
    // uma mensagem amigável; o índice uq_company_document é a rede de segurança.
    if (req.body.document !== undefined) {
      const digits = onlyDigits(req.body.document);
      if (digits) {
        const dup = await query(
          `SELECT 1 FROM company_settings
            WHERE owner_id <> $1
              AND regexp_replace(COALESCE(document, ''), '\\D', '', 'g') = $2
            LIMIT 1`,
          [req.owner.id, digits]
        );
        if (dup.rows.length) return fail(res, 'Este CNPJ/CPF já está em uso em outra conta.', 409);
      }
    }

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
