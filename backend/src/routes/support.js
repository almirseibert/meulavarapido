const express = require('express');
const { query } = require('../db');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { adminPushTokens } = require('../utils/admins');
const { sendPush } = require('../utils/push');

const router = express.Router();

// Contato do desenvolvedor exibido no app. Vem SEMPRE do ambiente
// (SUPPORT_NAME / SUPPORT_EMAIL / SUPPORT_WHATSAPP): sem e-mail hardcoded aqui,
// para trocar o contato sem publicar nova versão do app. Campos não definidos
// voltam vazios e o app simplesmente não exibe o link correspondente.
const DEV_CONTACT = {
  name: process.env.SUPPORT_NAME || 'Studio Mythos',
  email: process.env.SUPPORT_EMAIL || '',
  whatsapp: process.env.SUPPORT_WHATSAPP || '',
};

const KINDS = ['elogio', 'melhoria', 'bug', 'outro'];
const KIND_LABEL = { elogio: 'Elogio', melhoria: 'Sugestão', bug: 'Problema', outro: 'Mensagem' };

// GET /api/support/contact — dados de contato do desenvolvedor (público)
router.get('/contact', (req, res) => ok(res, DEV_CONTACT));

/**
 * POST /api/support/message — "Contate o desenvolvedor"
 * Grava a mensagem em support_messages e avisa os administradores por push.
 * O administrador lê tudo em Ajustes > Mensagens recebidas (GET /api/admin/support-messages).
 *
 * Body: { subject, message, kind }  kind: 'elogio' | 'melhoria' | 'bug' | 'outro'
 */
router.post(
  '/message',
  requireAuth,
  wrap(async (req, res) => {
    const subject = String(req.body.subject || '').trim().slice(0, 200);
    const message = String(req.body.message || '').trim().slice(0, 5000);
    const kind = KINDS.includes(req.body.kind) ? req.body.kind : 'outro';
    if (!message) return fail(res, 'Escreva sua mensagem.');

    // Copia os dados de quem escreveu para a mensagem sobreviver à exclusão da conta.
    const { rows: who } = await query(
      'SELECT name, email, phone FROM owners WHERE id = $1',
      [req.owner.id]
    );
    const author = who[0] || {};

    const { rows } = await query(
      `INSERT INTO support_messages
         (owner_id, owner_name, owner_email, owner_phone, kind, subject, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, created_at`,
      [req.owner.id, author.name || null, author.email || null, author.phone || null,
       kind, subject || null, message]
    );

    // Avisa os aparelhos do administrador. Falha aqui não invalida a mensagem,
    // que já está gravada — por isso o envio é isolado num try/catch.
    try {
      const tokens = await adminPushTokens();
      if (tokens.length) {
        await sendPush(tokens, {
          title: `${KIND_LABEL[kind]} de ${author.name || 'um usuário'}`,
          body: subject ? `${subject} — ${message}`.slice(0, 160) : message.slice(0, 160),
          data: { type: 'support_message', id: rows[0].id },
        });
      }
    } catch (e) {
      console.error('[suporte] Falha ao avisar o administrador:', e.message);
    }

    console.log('[suporte] %s | owner=%s | %s', kind, req.owner.id, subject || '(sem assunto)');
    return ok(res, { id: rows[0].id }, 'Mensagem enviada ao desenvolvedor. Obrigado!');
  })
);

module.exports = router;
