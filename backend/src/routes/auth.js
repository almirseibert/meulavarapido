const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const sign = (id) =>
  jwt.sign({ sub: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

const publicOwner = (o) => {
  const isPremium =
    o.plan === 'premium' && (!o.premium_until || new Date(o.premium_until) > new Date());
  return {
    id: o.id,
    name: o.name,
    email: o.email,
    plan: o.plan,
    premium_until: o.premium_until,
    isPremium,
  };
};

// POST /api/auth/register  — cadastro básico
router.post(
  '/register',
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) return fail(res, 'Nome, e-mail e senha são obrigatórios.');
    if (password.length < 6) return fail(res, 'A senha deve ter ao menos 6 caracteres.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 'E-mail inválido.');

    const exists = await query('SELECT 1 FROM owners WHERE email = $1', [email]);
    if (exists.rows.length) return fail(res, 'Já existe uma conta com este e-mail.', 409);

    const hash = await bcrypt.hash(password, 10);

    const owner = await withTransaction(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO owners (name, email, password_hash) VALUES ($1, $2, $3)
         RETURNING id, name, email, plan, premium_until`,
        [name, email, hash]
      );
      const o = rows[0];
      // cria a linha de configurações já com o nome informado
      await c.query(
        'INSERT INTO company_settings (owner_id, name, email) VALUES ($1, $2, $3)',
        [o.id, name, email]
      );
      return o;
    });

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
      'SELECT id, name, email, password_hash, plan, premium_until FROM owners WHERE email = $1',
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
      'SELECT id, name, email, plan, premium_until FROM owners WHERE id = $1',
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
      'SELECT id, name, email, plan, premium_until FROM owners WHERE id = $1',
      [req.owner.id]
    );
    return ok(res, publicOwner(rows[0]), 'Conta atualizada.');
  })
);

module.exports = router;
