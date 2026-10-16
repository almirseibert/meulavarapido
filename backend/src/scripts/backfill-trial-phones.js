/**
 * Backfill da tabela trial_phones.
 *
 * A trava do teste grátis só vale para quem se cadastrar DEPOIS da mudança:
 * as contas que já existem não têm o telefone registrado em trial_phones e,
 * portanto, ainda conseguiriam excluir a conta e ganhar outros 14 dias.
 *
 * Este script percorre as contas existentes que já receberam teste
 * (trial_ends_at preenchido) e grava o hash do telefone de cada uma.
 * É idempotente (ON CONFLICT DO NOTHING) — pode rodar quantas vezes quiser.
 *
 * Uso, uma vez, logo após o deploy:
 *   node src/scripts/backfill-trial-phones.js
 *
 * IMPORTANTE: rode com o MESMO TRIAL_PHONE_SALT que o servidor usa, senão os
 * hashes não vão bater com os gerados no cadastro.
 */
const crypto = require('crypto');
const { pool, query } = require('../db');

const phoneDigits = (s) => String(s || '').replace(/\D/g, '');
const trialSalt = () => process.env.TRIAL_PHONE_SALT || process.env.JWT_SECRET || '';
const phoneTrialHash = (phone) =>
  crypto.createHmac('sha256', trialSalt()).update(phoneDigits(phone)).digest('hex');

async function backfill() {
  if (!trialSalt()) {
    throw new Error('Defina TRIAL_PHONE_SALT (ou JWT_SECRET) antes de rodar.');
  }

  const { rows } = await query(
    `SELECT id, phone FROM owners
      WHERE trial_ends_at IS NOT NULL
        AND phone IS NOT NULL
        AND phone <> ''`
  );

  let inserted = 0;
  let skipped = 0;
  for (const o of rows) {
    const digits = phoneDigits(o.phone);
    if (!digits) { skipped++; continue; }
    const { rowCount } = await query(
      'INSERT INTO trial_phones (phone_hash) VALUES ($1) ON CONFLICT DO NOTHING',
      [phoneTrialHash(o.phone)]
    );
    if (rowCount) inserted++; else skipped++;
  }

  console.log(
    '[backfill] %d conta(s) com teste concedido | %d telefone(s) registrado(s) | %d já constavam ou sem número',
    rows.length, inserted, skipped
  );
}

backfill()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] Falha:', err.message);
    process.exit(1);
  });
