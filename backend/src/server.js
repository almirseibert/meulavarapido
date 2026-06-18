require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { migrate } = require('./scripts/migrate');
const { fail } = require('./utils/http');

const app = express();
app.use(cors());

// O webhook do RevenueCat precisa do corpo cru; demais rotas usam JSON.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/subscription/webhook') return next();
  express.json({ limit: '5mb' })(req, res, next);
});

// Healthcheck
app.get('/', (req, res) => res.json({ ok: true, app: 'Meu Lava Rápido API' }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/company', require('./routes/company'));
app.use('/api/services', require('./routes/services'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/washes', require('./routes/washes'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/subscription', require('./routes/subscription'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/import', require('./routes/importData'));
app.use('/api/support', require('./routes/support'));

// 404
app.use((req, res) => fail(res, 'Rota não encontrada.', 404));

// Handler central de erros
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  return fail(res, 'Erro interno no servidor.', 500);
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await migrate(); // aplica o schema (idempotente) no boot
  } catch (e) {
    console.error('[boot] Falha ao aplicar schema:', e.message);
  }
  app.listen(PORT, () => console.log(`Meu Lava Rápido API rodando na porta ${PORT}`));
}

start();

module.exports = app;
