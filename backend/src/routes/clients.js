const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth, requireActiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireActiveAccess);

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const plateKey = (s) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

// Impede o mesmo CPF/CNPJ duas vezes DENTRO da mesma conta (contas diferentes podem
// atender o mesmo cliente). Retorna o cliente conflitante, ou null.
async function findClientByDocument(ownerId, document, exceptId = null) {
  const digits = onlyDigits(document);
  if (!digits) return null;
  const params = [ownerId, digits];
  let where = `owner_id = $1 AND regexp_replace(COALESCE(document, ''), '\\D', '', 'g') = $2`;
  if (exceptId) { params.push(exceptId); where += ` AND id <> $${params.length}`; }
  const { rows } = await query(`SELECT id, name FROM clients WHERE ${where} LIMIT 1`, params);
  return rows[0] || null;
}

// Mesma placa não pode repetir na conta — nem no mesmo cliente, nem em outro.
async function findVehicleByPlate(ownerId, plate, exceptId = null) {
  const key = plateKey(plate);
  if (!key) return null;
  const params = [ownerId, key];
  let where = `v.owner_id = $1 AND upper(regexp_replace(COALESCE(v.license_plate, ''), '[^A-Za-z0-9]', '', 'g')) = $2`;
  if (exceptId) { params.push(exceptId); where += ` AND v.id <> $${params.length}`; }
  const { rows } = await query(
    `SELECT v.id, v.license_plate, c.name AS client_name
       FROM vehicles v LEFT JOIN clients c ON c.id = v.client_id
      WHERE ${where} LIMIT 1`,
    params
  );
  return rows[0] || null;
}

// GET /api/clients?search= — clientes com seus veículos
router.get(
  '/',
  wrap(async (req, res) => {
    const search = (req.query.search || '').trim();
    const params = [req.owner.id];
    let where = 'owner_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (name ILIKE $2 OR phone ILIKE $2 OR COALESCE(document, '') ILIKE $2)`;
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

    const dup = await findClientByDocument(req.owner.id, req.body.document);
    if (dup) {
      return fail(res, `Este CPF/CNPJ já está cadastrado para "${dup.name}".`, 409, { clientId: dup.id });
    }

    const { rows } = await query(
      `INSERT INTO clients (owner_id, name, phone, is_company, document, allow_credit, address, notes,
                            email, city, birth_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [req.owner.id, name, req.body.phone || null, !!req.body.is_company, req.body.document || null,
       !!req.body.allow_credit, req.body.address || null, req.body.notes || null, req.body.email || null,
       req.body.city || null, req.body.birth_date || null]
    );
    return ok(res, { ...rows[0], vehicles: [] }, 'Cliente criado.', 201);
  })
);

// PUT /api/clients/:id
router.put(
  '/:id',
  wrap(async (req, res) => {
    if (req.body.document !== undefined && req.body.document !== null) {
      const dup = await findClientByDocument(req.owner.id, req.body.document, req.params.id);
      if (dup) {
        return fail(res, `Este CPF/CNPJ já está cadastrado para "${dup.name}".`, 409, { clientId: dup.id });
      }
    }

    const { rows } = await query(
      `UPDATE clients SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         is_company = COALESCE($3, is_company),
         document = COALESCE($4, document),
         allow_credit = COALESCE($7, allow_credit),
         address = COALESCE($8, address),
         notes = COALESCE($9, notes),
         email = COALESCE($10, email),
         city = COALESCE($11, city),
         birth_date = COALESCE($12, birth_date)
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
        req.body.email ?? null,
        req.body.city ?? null,
        req.body.birth_date ?? null,
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

    const dup = await findVehicleByPlate(req.owner.id, req.body.license_plate);
    if (dup) {
      return fail(
        res,
        `A placa ${dup.license_plate} já está cadastrada para "${dup.client_name || 'outro cliente'}".`,
        409,
        { vehicleId: dup.id }
      );
    }

    const { rows } = await query(
      `INSERT INTO vehicles (owner_id, client_id, make, model, license_plate, color, nickname, year, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.owner.id,
        req.params.id,
        req.body.make || null,
        req.body.model || null,
        req.body.license_plate || null,
        req.body.color || null,
        req.body.nickname || null,
        req.body.year || null,
        req.body.notes || null,
      ]
    );
    return ok(res, rows[0], 'Veículo adicionado.', 201);
  })
);

// PUT /api/clients/vehicles/:vehicleId
router.put(
  '/vehicles/:vehicleId',
  wrap(async (req, res) => {
    if (req.body.license_plate !== undefined && req.body.license_plate !== null) {
      const dup = await findVehicleByPlate(req.owner.id, req.body.license_plate, req.params.vehicleId);
      if (dup) {
        return fail(
          res,
          `A placa ${dup.license_plate} já está cadastrada para "${dup.client_name || 'outro cliente'}".`,
          409,
          { vehicleId: dup.id }
        );
      }
    }

    const { rows } = await query(
      `UPDATE vehicles SET
         make = COALESCE($1, make),
         model = COALESCE($2, model),
         license_plate = COALESCE($3, license_plate),
         color = COALESCE($4, color),
         nickname = COALESCE($7, nickname),
         year = COALESCE($8, year),
         notes = COALESCE($9, notes)
       WHERE id = $5 AND owner_id = $6 RETURNING *`,
      [
        req.body.make ?? null,
        req.body.model ?? null,
        req.body.license_plate ?? null,
        req.body.color ?? null,
        req.params.vehicleId,
        req.owner.id,
        req.body.nickname ?? null,
        req.body.year ?? null,
        req.body.notes ?? null,
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
