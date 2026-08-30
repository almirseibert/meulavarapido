const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/devices — registra/atualiza o token push do aparelho.
// Chamado no login e a cada abertura do app (o token pode mudar).
router.post(
  '/',
  wrap(async (req, res) => {
    const token = (req.body.token || '').trim();
    if (!token.startsWith('Expo')) return fail(res, 'Token de notificação inválido.');

    // O token é a chave: se o aparelho trocou de conta, o vínculo migra junto.
    await query(
      `INSERT INTO push_tokens (token, owner_id, platform, app_version, disabled, updated_at)
       VALUES ($1, $2, $3, $4, false, now())
       ON CONFLICT (token) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         platform = COALESCE(EXCLUDED.platform, push_tokens.platform),
         app_version = COALESCE(EXCLUDED.app_version, push_tokens.app_version),
         disabled = false,
         updated_at = now()`,
      [token, req.owner.id, req.body.platform || null, req.body.app_version || null]
    );
    return ok(res, null, 'Aparelho registrado para notificações.');
  })
);

// DELETE /api/devices/:token — desativa (logout / usuário desligou os avisos)
router.delete(
  '/:token',
  wrap(async (req, res) => {
    await query(
      'UPDATE push_tokens SET disabled = true, updated_at = now() WHERE token = $1 AND owner_id = $2',
      [req.params.token, req.owner.id]
    );
    return ok(res, null, 'Aparelho removido das notificações.');
  })
);

module.exports = router;
