const express = require('express');
const { withTransaction } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/import
 * Importa o backup JSON gerado pelo app antigo (SQLite local) para a conta online.
 * Aceita o formato { clients, vehicles, washes, schedules, expenses, services }.
 * Mapeia os IDs antigos (texto/UUID do SQLite) para os novos UUIDs do Postgres.
 * NÃO é destrutivo: adiciona aos dados existentes da conta.
 *
 * Body: { data: {...}, mode?: 'append' }
 */
router.post(
  '/',
  wrap(async (req, res) => {
    const data = req.body.data || req.body; // aceita o JSON cru também
    if (!data || typeof data !== 'object') return fail(res, 'Backup inválido.');

    const ownerId = req.owner.id;
    const counts = { clients: 0, vehicles: 0, washes: 0, schedules: 0, expenses: 0, services: 0, helpers: 0 };

    await withTransaction(async (c) => {
      const clientIdMap = {}; // oldId -> newId
      const vehicleIdMap = {};
      const helperIdMap = {};

      // Colaboradores (ex-"ajudantes")
      for (const h of toArr(data.helpers)) {
        const { rows } = await c.query(
          `INSERT INTO helpers (owner_id, name, daily_rate, active)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [ownerId, h.name || 'Colaborador', num(h.dailyRate), h.active === undefined ? true : !!h.active]
        );
        helperIdMap[h.id] = rows[0].id;
        counts.helpers++;
      }

      // Serviços (do app antigo: serviceList fixo) — opcional
      for (const s of toArr(data.services)) {
        await c.query(
          `INSERT INTO services (owner_id, name, price, active) VALUES ($1,$2,$3,true)`,
          [ownerId, s.name || s.label || 'Serviço', num(s.price)]
        );
        counts.services++;
      }

      // Clientes
      for (const cl of toArr(data.clients)) {
        const { rows } = await c.query(
          `INSERT INTO clients (owner_id, name, phone, is_company, created_at)
           VALUES ($1,$2,$3,$4, to_timestamp($5)) RETURNING id`,
          [ownerId, cl.name || 'Cliente', cl.phone || null, !!cl.isCompany, sec(cl.createdAt)]
        );
        clientIdMap[cl.id] = rows[0].id;
        counts.clients++;
      }

      // Veículos
      for (const v of toArr(data.vehicles)) {
        const newClient = clientIdMap[v.clientId] || null;
        const { rows } = await c.query(
          `INSERT INTO vehicles (owner_id, client_id, make, model, license_plate, created_at)
           VALUES ($1,$2,$3,$4,$5, to_timestamp($6)) RETURNING id`,
          [ownerId, newClient, v.make || null, v.model || null, v.licensePlate || null, sec(v.createdAt)]
        );
        vehicleIdMap[v.id] = rows[0].id;
        counts.vehicles++;
      }

      // Lavagens
      for (const w of toArr(data.washes)) {
        let services = [];
        try { services = typeof w.services === 'string' ? JSON.parse(w.services) : (w.services || []); }
        catch { services = []; }
        await c.query(
          `INSERT INTO washes
             (owner_id, client_id, vehicle_id, client_name, vehicle_info, date, price,
              payment_type, is_charged, services, observations, created_at)
           VALUES ($1,$2,$3,$4,$5, to_timestamp($6),$7,$8,$9,$10,$11, to_timestamp($12))`,
          [
            ownerId, clientIdMap[w.clientId] || null, vehicleIdMap[w.vehicleId] || null,
            w.clientName || null, w.vehicleInfo || null, sec(w.date), num(w.price),
            w.paymentType || null, w.isCharged === undefined ? true : !!w.isCharged,
            JSON.stringify(services), w.observations || null, sec(w.createdAt),
          ]
        );
        counts.washes++;
      }

      // Agendamentos
      for (const s of toArr(data.schedules)) {
        await c.query(
          `INSERT INTO schedules
             (owner_id, client_id, vehicle_id, client_name, vehicle_info, date, observations, created_at)
           VALUES ($1,$2,$3,$4,$5, to_timestamp($6),$7, to_timestamp($8))`,
          [ownerId, clientIdMap[s.clientId] || null, vehicleIdMap[s.vehicleId] || null,
           s.clientName || null, s.vehicleInfo || null, sec(s.date), s.observations || null, sec(s.createdAt)]
        );
        counts.schedules++;
      }

      // Despesas (inclui os lançamentos de colaborador: Diária/Vale/Pagamento)
      for (const e of toArr(data.expenses)) {
        await c.query(
          `INSERT INTO expenses (owner_id, type, date, description, value, is_paid, helper_id, helper_name, created_at)
           VALUES ($1,$2, to_timestamp($3),$4,$5,$6,$7,$8, to_timestamp($9))`,
          [ownerId, e.type || 'Outro', sec(e.date), e.description || null, num(e.value),
           !!e.isPaid, helperIdMap[e.helperId] || null, e.helperName || null, sec(e.createdAt)]
        );
        counts.expenses++;
      }
    });

    return ok(res, counts, 'Backup importado com sucesso.');
  })
);

const toArr = (x) => (Array.isArray(x) ? x : []);
const num = (x) => (x == null ? 0 : Number(x) || 0);
// O app antigo guarda timestamps em ms. Converte para segundos; default = agora.
const sec = (ms) => (ms ? Math.floor(Number(ms) / 1000) : Math.floor(Date.now() / 1000));

module.exports = router;
