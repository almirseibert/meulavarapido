const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

// GET /api/clients?search= — clientes com seus veículos
router.get(
  '/',
  wrap(async (req, res) => {
    const search = (req.query.search || '').trim();
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $2 OR phone ILIKE $2)`;
    }
    const { rows: clients } = await query(
      `SELECT * FROM clients WHERE ${where} ORDER BY name`,
      params
    );
    const { rows: vehicles } = await query(
      'SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY created_at',
      [req.owner.id]
    );
    const byClient = {};
    for (const v of vehicles) (byClient[v.client_id] ||= []).push(v);
    const data = clients.map((c) => ({ ...c, vehicles: byClient[c.id] || [] }));
    return ok(res, data);
  })
);

// POST /api/clients
router.post(
  '/',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return fail(res, 'Informe o nome do cliente.');
    const { rows } = await query(
      `INSERT INTO clients (owner_id, name, phone, is_company, document, allow_credit, address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.owner.id, name, req.body.phone || null, !!req.body.is_company, req.body.document || null,
       !!req.body.allow_credit, req.body.address || null, req.body.notes || null]
    );
    return ok(res, { ...rows[0], vehicles: [] }, 'Cliente criado.', 201);
  })
);

// PUT /api/clients/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE clients SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         is_company = COALESCE($3, is_company),
         document = COALESCE($4, document),
         allow_credit = COALESCE($7, allow_credit),
         address = COALESCE($8, address),
         notes = COALESCE($9, notes)
       WHERE id = $5 AND owner_id = $6 RETURNING *`,
      [
        req.body.name ?? null,
        req.body.phone ?? null,
        req.body.is_company ?? null,
        req.body.document ?? null,
        req.params.id,
        req.owner.id,
        req.body.allow_credit ?? null,
        req.body.address ?? null,
        req.body.notes ?? null,
      ]
    );
    if (!rows.length) return fail(res, 'Cliente não encontrado.', 404);
    return ok(res, rows[0], 'Cliente atualizado.');
  })
);

// DELETE /api/clients/:id
router.delete(
  '/:id',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM clients WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Cliente não encontrado.', 404);
    return ok(res, null, 'Cliente removido.');
  })
);

// ----- Veículos do cliente -----

// POST /api/clients/:id/vehicles
router.post(
  '/:id/vehicles',
  wrap(async (req, res) => {
    const client = await query('SELECT 1 FROM clients WHERE id = $1 AND owner_id = $2', [
      req.params.id,
      req.owner.id,
    ]);
    if (!client.rows.length) return fail(res, 'Cliente não encontrado.', 404);

    const { rows } = await query(
      `INSERT INTO vehicles (owner_id, client_id, make, model, license_plate, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.owner.id,
        req.params.id,
        req.body.make || null,
        req.body.model || null,
        req.body.license_plate || null,
        req.body.color || null,
      ]
    );
    return ok(res, rows[0], 'Veículo adicionado.', 201);
  })
);

// PUT /api/clients/vehicles/:vehicleId
router.put(
  '/vehicles/:vehicleId',
  wrap(async (req, res) => {
    const { rows } = await query(
      `UPDATE vehicles SET
         make = COALESCE($1, make),
         model = COALESCE($2, model),
         license_plate = COALESCE($3, license_plate),
         color = COALESCE($4, color)
       WHERE id = $5 AND owner_id = $6 RETURNING *`,
      [
        req.body.make ?? null,
        req.body.model ?? null,
        req.body.license_plate ?? null,
        req.body.color ?? null,
        req.params.vehicleId,
        req.owner.id,
      ]
    );
    if (!rows.length) return fail(res, 'Veículo não encontrado.', 404);
    return ok(res, rows[0], 'Veículo atualizado.');
  })
);

// DELETE /api/clients/vehicles/:vehicleId
router.delete(
  '/vehicles/:vehicleId',
  wrap(async (req, res) => {
    const { rowCount } = await query(
      'DELETE FROM vehicles WHERE id = $1 AND owner_id = $2',
      [req.params.vehicleId, req.owner.id]
    );
    if (!rowCount) return fail(res, 'Veículo não encontrado.', 404);
    return ok(res, null, 'Veículo removido.');
  })
);

module.exports = router;
