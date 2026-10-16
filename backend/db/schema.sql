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

-- ---------- Trial de 14 dias + anti-abuso por telefone ----------
-- Modelo: acesso = isPremium OU (now() < trial_ends_at). Sem anúncios.
ALTER TABLE owners ADD COLUMN IF NOT EXISTS trial_ends_at  TIMESTAMPTZ;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS phone          TEXT;            -- E.164, verificado no cadastro
ALTER TABLE owners ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS firebase_uid   TEXT;           -- uid do Firebase Phone Auth
-- Backfill: contas já existentes ganham 14 dias a partir da criação.
UPDATE owners SET trial_ends_at = created_at + interval '14 days' WHERE trial_ends_at IS NULL;
-- Telefone único entre contas (impede recriar conta para renovar o trial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_owners_phone ON owners(phone) WHERE phone IS NOT NULL;

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
-- CNPJ/CPF único entre contas (compara apenas dígitos, ignorando formatação).
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_document
  ON company_settings (regexp_replace(document, E'\\D', '', 'g'))
  WHERE document IS NOT NULL AND document <> '';

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
-- Cliente autorizado a pagar a prazo (faturamento posterior) + endereço p/ tele-busca.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS allow_credit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes   TEXT;
-- Contato adicional propagável para recibos/orçamentos/relatórios.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email   TEXT;

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
-- Dados extras do veículo (todos opcionais), usados no filtro e propagados aos documentos.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS nickname TEXT;   -- apelido ("carro do trabalho")
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS year     TEXT;   -- ano/modelo

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

-- ---------- Colaboradores (ex-"ajudantes") ----------
CREATE TABLE IF NOT EXISTS helpers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  daily_rate  NUMERIC(10,2) NOT NULL DEFAULT 0,   -- diária padrão
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_helpers_owner ON helpers(owner_id);

-- Vínculo das despesas de colaborador (Diária/Vale/Pagamento) ao colaborador.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS helper_id   UUID REFERENCES helpers(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS helper_name TEXT;

-- ---------- CRM / Recuperação de clientes (módulo "Call") ----------
CREATE TABLE IF NOT EXISTS crm_settings (
  owner_id        UUID PRIMARY KEY REFERENCES owners(id) ON DELETE CASCADE,
  inactivity_days INTEGER NOT NULL DEFAULT 30,    -- dias sem lavar p/ considerar inativo
  snooze_days     INTEGER NOT NULL DEFAULT 15,    -- dias p/ avisar novamente após contato
  message_body    TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_callbacks (
  owner_id          UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  last_contact_date TIMESTAMPTZ,
  next_contact_date TIMESTAMPTZ,
  is_ignored        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (owner_id, client_id)
);

-- ---------- Tele-busca (busca e entrega do veículo) ----------
ALTER TABLE washes    ADD COLUMN IF NOT EXISTS pickup         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE washes    ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE washes    ADD COLUMN IF NOT EXISTS pickup_fee     NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE washes    ADD COLUMN IF NOT EXISTS pickup_status  TEXT;  -- a_buscar|em_servico|a_entregar|concluido
ALTER TABLE washes    ADD COLUMN IF NOT EXISTS pickup_time    TIMESTAMPTZ;  -- horário marcado para buscar o veículo
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS pickup         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS pickup_fee     NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS pickup_status  TEXT;

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
-- Contato/documento do cliente no momento da emissão (mantém o recibo reimprimível).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_phone    TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_document TEXT;

-- ---------- Cadastro complementar (todos opcionais) ----------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city       TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_date TEXT;  -- DD/MM/AAAA (felicitações/CRM)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS notes     TEXT;  -- avarias, preferências do dono

-- ---------- Antiduplicidade por conta ----------
-- Mesmo CPF/CNPJ não pode repetir DENTRO da mesma lavagem (owners diferentes podem
-- atender o mesmo cliente). Compara só os dígitos, ignorando a formatação.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_owner_document
  ON clients (owner_id, regexp_replace(document, E'\D', '', 'g'))
  WHERE document IS NOT NULL AND document <> '';
-- Mesma placa não pode repetir na conta, nem no mesmo cliente nem em outro.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_owner_plate
  ON vehicles (owner_id, upper(regexp_replace(license_plate, E'[^A-Za-z0-9]', '', 'g')))
  WHERE license_plate IS NOT NULL AND license_plate <> '';

-- ---------- Serviços: descrição + histórico de preços ----------
-- description alimenta automaticamente o detalhamento de recibos e orçamentos.
ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT;

-- Cada alteração de preço vira uma vigência. O preço de um serviço numa data D é o
-- da vigência mais recente com valid_from <= D. Lavagens já lançadas guardam o preço
-- praticado dentro de washes.services (snapshot), por isso o passado nunca muda.
CREATE TABLE IF NOT EXISTS service_prices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  valid_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_prices_service ON service_prices(service_id, valid_from DESC);
-- Backfill: serviços existentes ganham a vigência inicial com o preço atual.
INSERT INTO service_prices (owner_id, service_id, price, valid_from)
  SELECT s.owner_id, s.id, s.price, s.created_at FROM services s
  WHERE NOT EXISTS (SELECT 1 FROM service_prices p WHERE p.service_id = s.id);

-- ---------- Notificações push (novidades e promoções) ----------
CREATE TABLE IF NOT EXISTS push_tokens (
  token      TEXT PRIMARY KEY,                -- ExponentPushToken[...]
  owner_id   UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  platform   TEXT,                            -- android | ios
  app_version TEXT,
  disabled   BOOLEAN NOT NULL DEFAULT FALSE,  -- marcado quando o Expo devolve DeviceNotRegistered
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_owner ON push_tokens(owner_id);

-- Histórico dos envios feitos pelo painel do administrador.
CREATE TABLE IF NOT EXISTS broadcasts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience   TEXT NOT NULL,                   -- all | premium | free | trial | expired
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent       INTEGER NOT NULL DEFAULT 0,
  failed     INTEGER NOT NULL DEFAULT 0,
  sent_by    UUID REFERENCES owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

-- ---------- Mensagens de suporte ("Contate o desenvolvedor") ----------
-- Lidas pelo administrador (ADMIN_EMAILS) na tela "Mensagens recebidas".
-- Nome/e-mail/telefone ficam copiados aqui de propósito: a mensagem precisa
-- continuar legível mesmo que a conta de origem seja excluída depois.
CREATE TABLE IF NOT EXISTS support_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID REFERENCES owners(id) ON DELETE SET NULL,
  owner_name  TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  kind        TEXT NOT NULL DEFAULT 'outro',  -- elogio | melhoria | bug | outro
  subject     TEXT,
  message     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages(read_at) WHERE read_at IS NULL;

-- ---------- Controle do teste grátis por telefone ----------
-- A exclusão de conta no app (exigida pelo Google Play) apaga a linha de
-- `owners` e, com ela, o telefone — o que permitiria excluir e cadastrar de
-- novo para ganhar outro teste de 14 dias indefinidamente. Esta tabela guarda,
-- SEPARADA das contas, quais telefones já receberam o teste.
-- O número nunca é gravado aqui em claro: só o HMAC-SHA256 dele, para não
-- manter dado pessoal de quem pediu exclusão. Sem FK para owners de propósito,
-- para não ser apagada em cascata junto com a conta.
CREATE TABLE IF NOT EXISTS trial_phones (
  phone_hash   TEXT PRIMARY KEY,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
