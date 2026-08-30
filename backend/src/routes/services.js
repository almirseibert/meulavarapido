const express = require('express');
const { query, withTransaction } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

// GET /api/services
router.get(
  '/',
  wrap(async (req, res) => {
    const { rows } = await query(
      'SELECT * FROM services WHERE owner_id = $1 ORDER BY sort_order, name',
      [req.owner.id]
    );
    return ok(res, rows);
  })
);

// GET /api/services/price-at?date=ISO — preço vigente de cada serviço numa data.
// Usado para conferir/relatar quanto valia o serviço quando a lavagem foi feita.
router.get(
  '/price-at',
  wrap(async (req, res) => {
    const at = req.query.date || new Date().toISOString();
    const { rows } = await query(
      `SELECT s.id, s.name,
              COALESCE(
                (SELECT p.price FROM service_prices p
                  WHERE p.service_id = s.id AND p.valid_from <= $2
                  ORDER BY p.valid_from DESC, p.created_at DESC LIMIT 1),
                s.price
              )::float AS price
         FROM services s
        WHERE s.owner_id = $1
        ORDER BY s.sort_order, s.name`,
      [req.owner.id, at]
    );
    return ok(res, rows);
  })
);

// GET /api/services/:id/prices — histórico de vigências (mais recente primeiro)
router.get(
  '/:id/prices',
  wrap(async (req, res) => {
    const { rows } = await query(
      `SELECT id, price::float, valid_from
         FROM service_prices
        WHERE owner_id = $1 AND service_id = $2
        ORDER BY valid_from DESC, created_at DESC`,
      [req.owner.id, req.params.id]
    );
    return ok(res, rows);
  })
);

// POST /api/services
router.post(
  '/',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    const price = Number(req.body.price) || 0;
    if (!name) return fail(res, 'Informe o nome do serviço.');
    const sort = Number(req.body.sort_order) || 0;

    const service = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO services (owner_id, name, price, active, sort_order, description)
         VALUES ($1, $2, $3, COALESCE($4, true), $5, $6) RETURNING *`,
        [req.owner.id, name, price, req.body.active ?? true, sort, req.body.description || null]
      );
      const s = rows[0];
      await c.query(
        `INSERT INTO service_prices (owner_id, service_id, price, valid_from)
         VALUES ($1, $2, $3, COALESCE($4, now()))`,
        [req.owner.id, s.id, price, req.body.valid_from || null]
      );
      return s;
    });
    return ok(res, service, 'Serviço criado.', 201);
  })
);

// PUT /api/services/:id
// Alterar o preço abre uma NOVA vigência (valid_from, padrão agora). Lavagens já
// lançadas guardam o preço praticado, então o passado continua com o valor antigo.
router.put(
  '/:id',
  wrap(async (req, res) => {
    const newPrice = req.body.price ?? null;

    const service = await withTransaction(async (c) => {
      const current = await c.query(
        'SELECT * FROM services WHERE id = $1 AND owner_id = $2',
        [req.params.id, req.owner.id]
      );
      if (!current.rows.length) return null;

      const { rows } = await c.query(
        `UPDATE services SET
           name = COALESCE($1, name),
           price = COALESCE($2, price),
           active = COALESCE($3, active),
           sort_order = COALESCE($4, sort_order),
           description = COALESCE($7, description)
         WHERE id = $5 AND owner_id = $6 RETURNING *`,
        [
          req.body.name ?? null,
          newPrice,
          req.body.active ?? null,
          req.body.sort_order ?? null,
          req.params.id,
          req.owner.id,
          req.body.description ?? null,
        ]
      );

      const changed = newPrice != null && Number(newPrice) !== Number(current.rows[0].price);
      if (changed) {
        await c.query(
          `INSERT INTO service_prices (owner_id, service_id, price, valid_from)
           VALUES ($1, $2, $3, COALESCE($4, now()))`,
          [req.owner.id, req.params.id, Number(newPrice) || 0, req.body.valid_from || null]
        );
      }
      return rows[0];
    });

    if (!service) return fail(res, 'Serviço não encontrado.', 404);
    return ok(res, service, 'Serviço atualizado.');
  })
);

// DELETE /api/services/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM services WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Serviço não encontrado.', 404);
    return ok(res, null, 'Serviço removido.');
  })
);

module.exports = router;
