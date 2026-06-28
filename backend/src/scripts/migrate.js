// Aplica o schema.sql ao banco. Idempotente (CREATE TABLE IF NOT EXISTS).
// Pode ser rodado manualmente (`npm run migrate`) ou no boot do servidor.
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

// Erros aceitáveis: statement que já foi aplicado ou conflito de dados preexistentes.
const IGNORABLE_CODES = new Set([
  '42701', // duplicate_column (ADD COLUMN IF NOT EXISTS às vezes não existe)
  '42P07', // duplicate_table
  '42710', // duplicate_object (índice, extensão)
  '23505', // unique_violation (CREATE UNIQUE INDEX com dados duplicados)
  '42P16', // invalid_table_definition
]);

async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Remove comentários de linha e divide por ';' para executar um statement por vez.
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const client = await pool.connect();
  let errors = 0;
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        if (IGNORABLE_CODES.has(err.code)) {
          console.warn(`[migrate] Aviso (${err.code}): ${err.message.split('\n')[0]}`);
        } else {
          console.error(`[migrate] Erro inesperado (${err.code}): ${err.message.split('\n')[0]}`);
          errors++;
        }
      }
    }
  } finally {
    client.release();
  }

  if (errors > 0) {
    throw new Error(`Schema aplicado com ${errors} erro(s) inesperado(s). Verifique os logs acima.`);
  }
  console.log('[migrate] Schema aplicado com sucesso.');
}

// Permite uso como módulo (await migrate()) ou via CLI.
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Falha:', err.message);
      process.exit(1);
    });
}

module.exports = { migrate };
