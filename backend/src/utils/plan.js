// Regras de limite do plano FREE. Premium = ilimitado e sem anúncios.
const { query } = require('../db');

const FREE_LIMITS = {
  washesPerDay: 5,   // a partir da 6ª lavagem do dia -> exige vídeo recompensado
  receipts: 5,       // total de recibos antes de exigir anúncio por emissão
  quotes: 5,         // total de orçamentos antes de exigir anúncio por emissão
};

/** Conta lavagens criadas hoje (timezone America/Sao_Paulo). */
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

/** Conta documentos emitidos por tipo ('receipt' | 'quote'). */
async function documentCount(ownerId, kind) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS c FROM documents WHERE owner_id = $1 AND kind = $2',
    [ownerId, kind]
  );
  return rows[0].c;
}

/**
 * Resumo de uso/limites para o app decidir quando exibir anúncio.
 * requiresAd = ação atual exigiria assistir vídeo (free acima do limite).
 */
async function usageSummary(owner) {
  const [today, receipts, quotes] = await Promise.all([
    washesToday(owner.id),
    documentCount(owner.id, 'receipt'),
    documentCount(owner.id, 'quote'),
  ]);

  return {
    isPremium: owner.isPremium,
    limits: FREE_LIMITS,
    washes: {
      today,
      remaining: owner.isPremium ? null : Math.max(0, FREE_LIMITS.washesPerDay - today),
      requiresAd: owner.isPremium ? false : today >= FREE_LIMITS.washesPerDay,
    },
    receipts: {
      total: receipts,
      remaining: owner.isPremium ? null : Math.max(0, FREE_LIMITS.receipts - receipts),
      requiresAd: owner.isPremium ? false : receipts >= FREE_LIMITS.receipts,
    },
    quotes: {
      total: quotes,
      remaining: owner.isPremium ? null : Math.max(0, FREE_LIMITS.quotes - quotes),
      requiresAd: owner.isPremium ? false : quotes >= FREE_LIMITS.quotes,
    },
  };
}

module.exports = { FREE_LIMITS, washesToday, documentCount, usageSummary };
