// Aplica o schema.sql ao banco. Idempotente (CREATE TABLE IF NOT EXISTS).
// Pode ser rodado manualmente (`npm run migrate`) ou no boot do servidor.
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
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
