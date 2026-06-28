// Estado de acesso de uma conta (owner): trial de 14 dias OU assinatura premium.
// hasAccess = isPremium || trialActive. readOnly (no app) = !hasAccess.
const MS_DAY = 86400000;

function computeAccess(o) {
  const now = Date.now();
  const isPremium =
    o.plan === 'premium' && (!o.premium_until || new Date(o.premium_until).getTime() > now);
  const trialEndsAt = o.trial_ends_at ? new Date(o.trial_ends_at) : null;
  const trialActive = !isPremium && !!trialEndsAt && trialEndsAt.getTime() > now;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / MS_DAY))
    : 0;
  const hasAccess = isPremium || trialActive;
  return { isPremium, trialActive, trialDaysLeft, trialEndsAt, hasAccess };
}

module.exports = { computeAccess };
