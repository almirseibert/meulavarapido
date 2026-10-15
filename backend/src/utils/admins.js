// Quem é administrador do app (vê a central de novidades e as mensagens de
// suporte) sai da variável de ambiente ADMIN_EMAILS, separada por vírgula.
// Sem a variável, ninguém é admin — o padrão é fechado de propósito.
const { query } = require('../db');

/** Lista de e-mails administradores, normalizada em minúsculas. */
function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True se a conta informada é de um administrador. */
async function isAdmin(ownerId) {
  const list = adminEmails();
  if (!list.length) return false;
  const { rows } = await query('SELECT email FROM owners WHERE id = $1', [ownerId]);
  return !!rows.length && list.includes(String(rows[0].email).toLowerCase());
}

/** Tokens de push dos aparelhos dos administradores (para avisos internos). */
async function adminPushTokens() {
  const list = adminEmails();
  if (!list.length) return [];
  const { rows } = await query(
    `SELECT t.token
       FROM push_tokens t
       JOIN owners o ON o.id = t.owner_id
      WHERE t.disabled = false
        AND lower(o.email) = ANY($1::text[])`,
    [list]
  );
  return rows.map((r) => r.token);
}

module.exports = { adminEmails, isAdmin, adminPushTokens };
