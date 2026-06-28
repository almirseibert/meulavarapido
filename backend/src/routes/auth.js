const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { computeAccess } = require('../utils/access');
const firebase = require('../utils/firebase');

const router = express.Router();

const sign = (id) =>
  jwt.sign({ sub: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

// Normaliza telefone para E.164 (heurística BR: assume DDI 55 se ausente).
const phoneDigits = (s) => String(s || '').replace(/\D/g, '');
function normalizePhone(input) {
  let d = phoneDigits(input);
  if (!d) return null;
  if (d.length <= 11) d = '55' + d; // sem DDI -> Brasil
  return '+' + d;
}

const publicOwner = (o) => {
  const access = computeAccess(o);
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    phone: o.phone || null,
    plan: o.plan,
    premium_until: o.premium_until,
    trial_ends_at: o.trial_ends_at,
    isPremium: access.isPremium,
    trialActive: access.trialActive,
    trialDaysLeft: access.trialDaysLeft,
    hasAccess: access.hasAccess,
  };
};

// POST /api/auth/register  — cadastro com telefone verificado e trial de 14 dias
router.post(
  '/register',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const firebaseIdToken = req.body.firebaseIdToken || null;

    if (!name || !email || !password) return fail(res, 'Nome, e-mail e senha são obrigatórios.');
    if (password.length < 6) return fail(res, 'A senha deve ter ao menos 6 caracteres.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 'E-mail inválido.');

    // Resolve o telefone: por token verificado (produção) ou fallback de dev.
    let phone = null;
    let phoneVerified = false;
    let firebaseUid = null;

    if (firebaseIdToken) {
      try {
        const v = await firebase.verifyPhoneToken(firebaseIdToken);
        if (!v.phone) return fail(res, 'O token não contém um telefone verificado.');
        phone = normalizePhone(v.phone);
        firebaseUid = v.uid;
        phoneVerified = true;
      } catch (e) {
        return fail(res, 'Não foi possível validar o código do telefone. Tente novamente.', 401);
      }
    } else if (firebase.isConfigured()) {
      // Verificação ativa no servidor: o token é obrigatório.
      return fail(res, 'Confirme seu telefone para concluir o cadastro.');
    } else {
      // Modo dev (sem Firebase configurado): aceita telefone informado, não verificado.
      phone = normalizePhone(req.body.phone);
      if (!phone) return fail(res, 'Informe um telefone válido.');
    }

    const exists = await query('SELECT 1 FROM owners WHERE email = $1', [email]);
    if (exists.rows.length) return fail(res, 'Já existe uma conta com este e-mail.', 409);

    // Telefone único entre contas (impede recriar conta para renovar o trial).
    if (phone) {
      const dupPhone = await query(
        `SELECT 1 FROM owners WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1 LIMIT 1`,
        [phoneDigits(phone)]
      );
      if (dupPhone.rows.length) return fail(res, 'Já existe uma conta com este telefone.', 409);
    }

    const hash = await bcrypt.hash(password, 10);

    let owner;
    try {
      owner = await withTransaction(async (c) => {
        const { rows } = await c.query(
          `INSERT INTO owners (name, email, password_hash, phone, phone_verified, firebase_uid, trial_ends_at)
           VALUES ($1, $2, $3, $4, $5, $6, now() + interval '14 days')
           RETURNING id, name, email, phone, plan, premium_until, trial_ends_at`,
          [name, email, hash, phone, phoneVerified, firebaseUid]
        );
        const o = rows[0];
        await c.query(
          'INSERT INTO company_settings (owner_id, name, email) VALUES ($1, $2, $3)',
          [o.id, name, email]
        );
        return o;
      });
    } catch (e) {
      // Colisão do índice único de telefone (corrida).
      if (e.code === '23505') return fail(res, 'Já existe uma conta com este telefone.', 409);
      throw e;
    }

    return ok(res, { token: sign(owner.id), owner: publicOwner(owner) }, 'Conta criada.', 201);
  })
);

// POST /api/auth/login
router.post(
  '/login',
  wrap(async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    if (!email || !password) return fail(res, 'Informe e-mail e senha.');

    const { rows } = await query(
      'SELECT id, name, email, phone, password_hash, plan, premium_until, trial_ends_at FROM owners WHERE email = $1',
      [email]
    );
    if (!rows.length) return fail(res, 'E-mail ou senha incorretos.', 401);

    const owner = rows[0];
    const valid = await bcrypt.compare(password, owner.password_hash);
    if (!valid) return fail(res, 'E-mail ou senha incorretos.', 401);

    return ok(res, { token: sign(owner.id), owner: publicOwner(owner) }, 'Login efetuado.');
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query(
      'SELECT id, name, email, phone, plan, premium_until, trial_ends_at FROM owners WHERE id = $1',
      [req.owner.id]
    );
    if (!rows.length) return fail(res, 'Conta não encontrada.', 404);
    return ok(res, publicOwner(rows[0]));
  })
);

// PUT /api/auth/me — atualizar nome/senha
router.put(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    const password = req.body.password;

    if (name) await query('UPDATE owners SET name = $1 WHERE id = $2', [name, req.owner.id]);
    if (password) {
      if (password.length < 6) return fail(res, 'A senha deve ter ao menos 6 caracteres.');
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE owners SET password_hash = $1 WHERE id = $2', [hash, req.owner.id]);
    }

    const { rows } = await query(
      'SELECT id, name, email, phone, plan, premium_until, trial_ends_at FROM owners WHERE id = $1',
      [req.owner.id]
    );
    return ok(res, publicOwner(rows[0]), 'Conta atualizada.');
  })
);

module.exports = router;
