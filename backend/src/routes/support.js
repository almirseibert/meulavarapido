const express = require('express');
const { ok, fail, wrap } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

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

// GET /api/support/contact — dados de contato do desenvolvedor (público)
router.get('/contact', (req, res) => ok(res, DEV_CONTACT));

/**
 * POST /api/support/message — "Contate o desenvolvedor"
 * Recebe elogios / sugestões / bugs. Por ora apenas registra no log do servidor;
 * basta plugar um envio de e-mail (nodemailer/Resend) ou gravar em tabela depois.
 * Body: { subject, message, kind }  kind: 'elogio' | 'melhoria' | 'bug' | 'outro'
 */
router.post(
  '/message',
  requireAuth,
  wrap(async (req, res) => {
    const subject = (req.body.subject || '').trim();
    const message = (req.body.message || '').trim();
    const kind = req.body.kind || 'outro';
    if (!message) return fail(res, 'Escreva sua mensagem.');

    console.log('[suporte] %s | owner=%s | %s | %s', kind, req.owner.id, subject, message);
    // TODO (fase 2): gravar em tabela 'support_messages' (hoje a mensagem só vai para o log).

    return ok(res, { contact: DEV_CONTACT }, 'Mensagem enviada ao desenvolvedor. Obrigado!');
  })
);

module.exports = router;
