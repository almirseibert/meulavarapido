// Estado de uso/acesso da conta. Sem anúncios e sem limites por contagem:
// o acesso é definido pelo trial de 14 dias ou pela assinatura premium.
const { query } = require('../db');
const { computeAccess } = require('./access');

/** Conta lavagens criadas hoje (timezone America/Sao_Paulo) — informativo. */
async function washesToday(ownerId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS c
       FROM washes
      WHERE owner_id = $1
        AND (date AT TIME ZONE 'America/Sao_Paulo')::date
            = (now() AT TIME ZONE 'America/Sao_Paulo')::date`,
    [ownerId]
  );
  return rows[0].c;
}

/** Conta documentos emitidos por tipo ('receipt' | 'quote') — informativo. */
async function documentCount(ownerId, kind) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS c FROM documents WHERE owner_id = $1 AND kind = $2',
    [ownerId, kind]
  );
  return rows[0].c;
}

/**
 * Resumo de acesso para o app decidir entre liberar tudo (trial/premium) ou
 * entrar em modo somente leitura. Mantém contadores apenas como informação.
 */
async function usageSummary(owner) {
  const access = owner.hasAccess !== undefined ? owner : computeAccess(owner);
  const [today, receipts, quotes] = await Promise.all([
    washesToday(owner.id),
    documentCount(owner.id, 'receipt'),
    documentCount(owner.id, 'quote'),
  ]);

  return {
    isPremium: access.isPremium,
    trialActive: access.trialActive,
    trialDaysLeft: access.trialDaysLeft,
    trialEndsAt: access.trialEndsAt,
    hasAccess: access.hasAccess,
    counts: { washesToday: today, receipts, quotes },
  };
}

module.exports = { washesToday, documentCount, usageSummary };
