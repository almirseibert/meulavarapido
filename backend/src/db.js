const { Pool } = require('pg');

const useUrl = !!process.env.DATABASE_URL;

const pool = new Pool(
  useUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'meulavarapido',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
      }
);

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err.message);
});

/** Executa uma query simples. */
const query = (text, params) => pool.query(text, params);

/** Executa um callback dentro de uma transação (commit/rollback automático). */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
