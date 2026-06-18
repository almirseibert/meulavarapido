-- ============================================================
--  Meu Lava Rápido — Schema PostgreSQL
--  Multi-tenant: cada "owner" (conta/lava-rápido) possui seus dados.
--  Aplicado automaticamente por src/scripts/migrate.js no start.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ---------- Contas (login básico) ----------
CREATE TABLE IF NOT EXISTS owners (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  plan           TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'premium'
  premium_until  TIMESTAMPTZ,                        -- null = sem assinatura ativa
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Dados da lavagem (cadastro completo, usado em recibos/conexão) ----------
CREATE TABLE IF NOT EXISTS company_settings (
  owner_id    UUID PRIMARY KEY REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT,            -- nome da lavagem
  document    TEXT,            -- CNPJ ou CPF
  address     TEXT,
  city        TEXT,
  state       TEXT,
  zip         TEXT,
  phone       TEXT,
  whatsapp    TEXT,
  email       TEXT,
  instagram   TEXT,
  logo_url    TEXT,
  receipt_footer TEXT,         -- mensagem fixa no rodapé de recibos/orçamentos
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Serviços e valores (editáveis) ----------
CREATE TABLE IF NOT EXISTS services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_id);

-- ---------- Clientes ----------
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  is_company  BOOLEAN NOT NULL DEFAULT FALSE,
  document    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);

-- ---------- Veículos ----------
CREATE TABLE IF NOT EXISTS vehicles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  make          TEXT,
  model         TEXT,
  license_plate TEXT,
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_client ON vehicles(client_id);

-- ---------- Lavagens ----------
CREATE TABLE IF NOT EXISTS washes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  vehicle_id    UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  client_name   TEXT,
  vehicle_info  TEXT,
  date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type  TEXT,
  is_charged    BOOLEAN NOT NULL DEFAULT TRUE,
  services      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array de {id,name,price}
  observations  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_washes_owner_date ON washes(owner_id, date);

-- ---------- Agendamentos ----------
CREATE TABLE IF NOT EXISTS schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  vehicle_id    UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  client_name   TEXT,
  vehicle_info  TEXT,
  date          TIMESTAMPTZ NOT NULL,
  observations  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedules_owner_date ON schedules(owner_id, date);

-- ---------- Fornecedores ----------
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,         -- nome fantasia / contato
  company_name  TEXT,                  -- razão social
  document      TEXT,                  -- CNPJ
  phone         TEXT,
  whatsapp      TEXT,
  email         TEXT,
  address       TEXT,
  products      TEXT,                  -- produtos que fornece
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_owner ON suppliers(owner_id);

-- ---------- Despesas ----------
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,         -- Produto, Energia, Água, Aluguel, Outro
  date          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description   TEXT,
  value         NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid       BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_owner_date ON expenses(owner_id, date);

-- ---------- Documentos emitidos (recibos e orçamentos) ----------
-- Usado para contabilizar limites do plano free (5 recibos + 5 orçamentos).
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,         -- 'receipt' | 'quote'
  number        INTEGER NOT NULL,      -- sequencial por owner+kind
  client_name   TEXT,
  vehicle_info  TEXT,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type  TEXT,
  observations  TEXT,
  via_ad        BOOLEAN NOT NULL DEFAULT FALSE, -- emitido após assistir anúncio (free, acima do limite)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner_kind ON documents(owner_id, kind);
