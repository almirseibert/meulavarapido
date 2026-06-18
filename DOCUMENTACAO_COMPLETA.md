# Lavagem da Dani — Documentação Completa & Script de Replicação do Sistema

> Sistema de gestão e controle de ponto para um lava-rápido ("Lavagem da Dani" — Lajeado/RS).
> Composto por um **aplicativo móvel React Native (Expo)** com banco de dados **local SQLite** e uma **API Node.js/Express + MySQL** hospedada na nuvem (Easypanel) usada exclusivamente para o **controle de ponto (timesheet)** dos ajudantes.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Pastas](#3-estrutura-de-pastas)
4. [Modelo de Dados (SQLite Local)](#4-modelo-de-dados-sqlite-local)
5. [Modelo de Dados (MySQL — Backend de Ponto)](#5-modelo-de-dados-mysql--backend-de-ponto)
6. [Módulos / Funcionalidades](#6-módulos--funcionalidades)
7. [Camada de Serviços (Frontend)](#7-camada-de-serviços-frontend)
8. [Telas (Screens) e Componentes](#8-telas-screens-e-componentes)
9. [Navegação e Autenticação](#9-navegação-e-autenticação)
10. [API Backend (Contrato + Implementação)](#10-api-backend-contrato--implementação)
11. [Regras de Negócio Importantes](#11-regras-de-negócio-importantes)
12. [Script de Replicação — Passo a Passo](#12-script-de-replicação--passo-a-passo)
13. [Build, Deploy e Publicação](#13-build-deploy-e-publicação)
14. [Checklist de Configuração / Personalização](#14-checklist-de-configuração--personalização)

---

## 1. Visão Geral da Arquitetura

O sistema é **híbrido (offline-first + nuvem parcial)**:

```
┌──────────────────────────────────────────────────────────────┐
│                     APP MÓVEL (Expo / RN)                      │
│                                                                │
│   ┌────────────────┐         ┌──────────────────────────┐     │
│   │  Modo PATRÃO   │         │     Modo AJUDANTE        │     │
│   │  (Admin)       │         │     (Funcionário)        │     │
│   └───────┬────────┘         └────────────┬─────────────┘     │
│           │                               │                   │
│   Gestão local (SQLite)            Controle de Ponto          │
│   - Clientes / Veículos            - Login online (PIN)       │
│   - Lavagens / Agenda              - Bate ponto via GPS       │
│   - Despesas / CRM                 - Geo-cerca (100 m)        │
│   - Relatórios PDF / Backup        - Bloqueio de print        │
│           │                               │                   │
│           ▼                               ▼                   │
│   ┌────────────────┐         ┌──────────────────────────┐     │
│   │ SQLite local   │         │   fetch() HTTPS → API    │     │
│   │ lavagemdadani  │         │                          │     │
│   └────────────────┘         └────────────┬─────────────┘     │
└──────────────────────────────────────────┼───────────────────┘
                                            │
                                            ▼
                     ┌────────────────────────────────────────┐
                     │  BACKEND  (Easypanel / Docker)          │
                     │  Node.js + Express + MySQL              │
                     │  /api/login  /api/punch                 │
                     │  /api/punches/today/:id                 │
                     │  /api/admin/timesheets                  │
                     └────────────────────────────────────────┘
```

Pontos-chave:

- **Toda a gestão do negócio** (clientes, veículos, lavagens, agenda, despesas, CRM, relatórios) roda **100% offline** num banco SQLite no dispositivo.
- **Apenas o controle de ponto** dos ajudantes usa a API online + MySQL, porque precisa ser compartilhado entre o celular do funcionário e o do patrão.
- **Backup/Restauração** é feito por arquivo JSON exportável/importável (não há sincronização automática em nuvem dos dados de gestão).

---

## 2. Stack Tecnológica

### Frontend (`AppLavegemReact`)

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| Runtime / SDK | Expo | `~54.0.13` |
| Framework | React Native | `0.81.5` |
| Linguagem | TypeScript | `~5.9.2` |
| React | React / React DOM | `19.1.0` |
| Navegação | `@react-navigation/native` + native-stack + bottom-tabs | `7.x` |
| Banco local | `expo-sqlite` | `~16.0.8` |
| UUID / Hash | `expo-crypto` | `~15.0.7` |
| GPS | `expo-location` | `~19.0.8` |
| Geração PDF | `expo-print` | `~15.0.7` |
| Compartilhar arquivos | `expo-sharing` | `~14.0.7` |
| Sistema de arquivos | `expo-file-system` (API **legacy**) | `~19.0.17` |
| Importar arquivo | `expo-document-picker` | `~14.0.7` |
| Bloqueio de print | `expo-screen-capture` | `~8.0.9` |
| Ícones | `@expo/vector-icons` (Ionicons) | `^15.0.3` |
| Date Picker | `@react-native-community/datetimepicker` | `8.4.4` |
| Select / Picker | `@react-native-picker/picker` | `^2.11.1` |

### Backend (`backend-danilavagem`)

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| Runtime | Node.js | `20-alpine` (Docker) |
| Framework | Express | `^4.19.2` |
| Banco | MySQL (driver `mysql2`) | `^3.9.7` |
| CORS | `cors` | `^2.8.5` |
| Env | `dotenv` | `^16.4.5` |
| Container | Docker | imagem `node:20-alpine` |
| Hospedagem | Easypanel | — |

> **Nota:** o código-fonte do backend (`src/server.js`) **não está presente** neste backup — apenas `package.json` e `Dockerfile`. A seção [10](#10-api-backend-contrato--implementação) reconstrói uma implementação completa e funcional a partir do contrato consumido pelo app (`src/services/apiService.ts`).

---

## 3. Estrutura de Pastas

```
AppLavagemantigo/
├── AppLavegemReact/                 # App móvel (Expo)
│   ├── App.tsx                      # Raiz: Providers + Navigation
│   ├── app.json                     # Config Expo (nome, ícones, splash, plugin sqlite)
│   ├── eas.json                     # Perfis de build EAS (dev/preview/production apk)
│   ├── package.json
│   ├── tsconfig.json
│   ├── assets/                      # icon, splash, adaptive-icon, favicon
│   ├── android/                     # Projeto nativo Android gerado
│   └── src/
│       ├── components/              # Formulários e modal reutilizáveis
│       │   ├── AppModal.tsx
│       │   ├── ClientForm.tsx
│       │   ├── VehicleForm.tsx
│       │   ├── WashForm.tsx
│       │   ├── ScheduleForm.tsx
│       │   ├── ExpenseForm.tsx
│       │   └── HelperForm.tsx
│       ├── database/
│       │   ├── database.ts          # initDB(): cria tabelas + seeds
│       │   └── databaseProvider.tsx # Context + injeção de serviços
│       ├── navigation/
│       │   └── AppNavigator.tsx     # Stack (Login) + BottomTabs (admin)
│       ├── screens/
│       │   ├── LoginScreen.tsx
│       │   ├── HelperCheckinScreen.tsx
│       │   ├── AdminTimesheetScreen.tsx
│       │   ├── DashboardScreen.tsx
│       │   ├── ClientScreen.tsx
│       │   ├── ScheduleScreen.tsx
│       │   ├── WashScreen.tsx
│       │   ├── CallBackScreen.tsx
│       │   ├── ExpenseScreen.tsx
│       │   ├── ReportScreen.tsx
│       │   └── BackupScreen.tsx
│       ├── services/
│       │   ├── apiService.ts        # Cliente HTTP do backend de ponto
│       │   ├── clientService.ts
│       │   ├── vehicleService.ts
│       │   ├── washService.ts
│       │   ├── scheduleService.ts
│       │   ├── helperService.ts
│       │   ├── expenseService.ts
│       │   ├── crmService.ts
│       │   ├── reportService.ts     # Geração de PDFs (recibos/relatórios)
│       │   └── backupService.ts     # Export/Import JSON
│       ├── types/
│       │   └── index.ts             # Interfaces + listas (serviços, pagamentos, COMPANY_INFO)
│       └── utils/
│           ├── formatters.ts        # Moeda, datas, número por extenso
│           ├── geoUtils.ts          # Haversine + geo-cerca da empresa
│           ├── pdfGenerator.ts      # (gerador auxiliar/legado)
│           └── reportGenerator.ts   # (gerador auxiliar/legado)
│
└── backend-danilavagem/             # API de ponto
    ├── Dockerfile
    ├── package.json
    └── src/server.js                # (AUSENTE no backup — reconstruído na seção 10)
```

---

## 4. Modelo de Dados (SQLite Local)

Arquivo: `lavagemdadani.db`. Criado em `src/database/database.ts` via `initDB()`. `PRAGMA foreign_keys = ON`.

### Tabela `clients`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID (`expo-crypto`) |
| `name` | TEXT NOT NULL | |
| `phone` | TEXT NOT NULL | |
| `isCompany` | INTEGER | 0/1 (PF ou PJ) |
| `createdAt` | INTEGER NOT NULL | timestamp ms |

### Tabela `vehicles`
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `clientId` | TEXT NOT NULL | FK → `clients.id` ON DELETE CASCADE |
| `make` | TEXT NOT NULL | marca |
| `model` | TEXT NOT NULL | modelo |
| `licensePlate` | TEXT NOT NULL | placa |
| `createdAt` | INTEGER NOT NULL | |

### Tabela `washes` (lavagens)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `clientId` | TEXT NOT NULL | FK → `clients.id` CASCADE |
| `vehicleId` | TEXT NOT NULL | FK → `vehicles.id` CASCADE |
| `clientName` | TEXT | desnormalizado (cache p/ UI/PDF) |
| `vehicleInfo` | TEXT | desnormalizado `"make model (placa)"` |
| `date` | INTEGER NOT NULL | timestamp |
| `price` | REAL NOT NULL | total |
| `paymentType` | TEXT NOT NULL | ver `paymentTypes` |
| `isCharged` | INTEGER | 0/1 — pago/cobrado |
| `services` | TEXT | **JSON array** de IDs de serviço |
| `observations` | TEXT | |
| `createdAt` | INTEGER NOT NULL | |

### Tabela `schedules` (agendamentos)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `clientId` | TEXT NOT NULL | FK CASCADE |
| `vehicleId` | TEXT NOT NULL | FK CASCADE |
| `clientName` / `vehicleInfo` | TEXT | desnormalizado |
| `date` | INTEGER NOT NULL | timestamp do agendamento |
| `observations` | TEXT | |
| `createdAt` | INTEGER NOT NULL | |

### Tabela `helpers` (ajudantes)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | |
| `dailyRate` | REAL NOT NULL | valor da diária |
| `active` | INTEGER DEFAULT 1 | **adicionada por migração automática** (`ALTER TABLE` em `HelperService`) |

### Tabela `expenses` (despesas)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `type` | TEXT NOT NULL | ver tipos abaixo |
| `date` | INTEGER NOT NULL | |
| `description` | TEXT | |
| `value` | REAL NOT NULL | |
| `isPaid` | INTEGER DEFAULT 0 | |
| `helperId` | TEXT | FK → `helpers.id` ON DELETE SET NULL |
| `helperName` | TEXT | desnormalizado |
| `createdAt` | INTEGER NOT NULL | |

Tipos de despesa:
- **Gerais:** `Produto`, `Energia`, `Água`, `Aluguel`, `Outro`
- **Ajudante:** `AjudaDiaria` (crédito de diária), `AjudaVale` (adiantamento/débito), `AjudaPagamento` (quitação de saldo)

### Tabela `settings` (config CRM)
| Coluna | Tipo |
|--------|------|
| `key` | TEXT PK |
| `value` | TEXT NOT NULL |

Seeds (`INSERT OR IGNORE`):
- `crm_inactivityDays = 30`
- `crm_snoozeDays = 15`
- `crm_messageBody = "Notamos que faz um tempinho..."`

### Tabela `crm_callbacks` (rastreamento de recontato)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `clientId` | TEXT PK | FK → `clients.id` CASCADE |
| `lastContactDate` | INTEGER | |
| `nextContactDate` | INTEGER | próximo lembrete (snooze) |
| `isIgnored` | INTEGER DEFAULT 0 | cliente "silenciado" |

### Diagrama de relacionamento (local)

```
clients 1──N vehicles
clients 1──N washes        N──1 vehicles
clients 1──N schedules     N──1 vehicles
clients 1──1 crm_callbacks
helpers 1──N expenses
settings (chave/valor)
```

---

## 5. Modelo de Dados (MySQL — Backend de Ponto)

Inferido a partir do contrato `apiService.ts` (`TimePunch`):

### Tabela `helpers` (no MySQL, para login)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | VARCHAR(36) PK | |
| `name` | VARCHAR(120) | |
| `username` | VARCHAR(60) UNIQUE | login do ajudante |
| `pin` | VARCHAR(10) | PIN de acesso (idealmente hash) |
| `hourlyRate` | DECIMAL(10,2) | valor base p/ cálculo |
| `active` | TINYINT(1) DEFAULT 1 | |

### Tabela `time_punches` (registros de ponto)
| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | VARCHAR(36) PK | |
| `helperId` | VARCHAR(36) | FK → helpers |
| `date` | DATE | `YYYY-MM-DD` |
| `entryMorning` | VARCHAR(5) | `HH:MM` ou NULL |
| `exitNoon` | VARCHAR(5) | |
| `entryAfternoon` | VARCHAR(5) | |
| `exitEvening` | VARCHAR(5) | |
| `payFullShift` | TINYINT(1) DEFAULT 0 | força pagar diária cheia |
| `hourlyRate` | DECIMAL(10,2) | |
| `totalCalculated` | DECIMAL(10,2) | total devido calculado |

Restrição: `UNIQUE(helperId, date)` — um registro por ajudante por dia.

---

## 6. Módulos / Funcionalidades

### Lado PATRÃO (Admin — acesso por senha mestre)
1. **Dashboard** — métricas do mês selecionável: nº de clientes, lavagens (mês/hoje), receita (mês/hoje), total a receber (faturamento em aberto acumulado), despesas pagas do mês, próximos 5 agendamentos.
2. **Clientes** — CRUD de clientes + veículos (relação 1-N), busca.
3. **Agenda** — CRUD de agendamentos futuros (cliente + veículo + data/hora + obs).
4. **Lavagens** — CRUD de lavagens, seleção múltipla de serviços, tipo de pagamento, marcar pago/aberto, gerar recibo PDF.
5. **CRM / Call Back** — lista clientes inativos (sem lavagem há N dias), envio de mensagem via WhatsApp (deep link), snooze e "ignorar", configuração de regras.
6. **Despesas** — CRUD de despesas gerais e de ajudantes; saldos por ajudante (diárias − vales); quitação de saldo.
7. **Ponto (Admin Timesheet)** — consome a API; lista pontos de todos os ajudantes; edição manual de horários; flag "pagar turno cheio".
8. **Relatórios** — filtros por tipo/cliente/período; pré-visualização; geração de PDF; baixa em massa de faturamento em aberto.
9. **Backup** — exportar/importar JSON (sobrescreve tudo na importação).

### Lado AJUDANTE (Funcionário — login online por usuário+PIN)
1. **Login** online contra a API.
2. **Check-in/Ponto** com 4 batidas (entrada manhã, saída meio-dia, entrada tarde, saída fim), validadas por **geo-cerca de 100 m** da empresa e com **bloqueio de captura de tela**.

---

## 7. Camada de Serviços (Frontend)

Todos os serviços recebem a instância `SQLiteDatabase` no construtor (exceto `ReportService`, instanciável sem DB), e são injetados via `DatabaseProvider` (Context) consumido pelo hook `useDatabase()`.

| Serviço | Métodos principais |
|---------|--------------------|
| `ClientService` | `add`, `update`, `deleteClient`, `getAllClients` (ordena por nome `COLLATE NOCASE`), `getClientById` |
| `VehicleService` | `getAll`, `getByClientId`, `add`, `update`, `delete` |
| `WashService` | `getAll` (JOIN clients+vehicles, parse JSON de `services`), `add`, `update`, `toggleCharged`, `delete` |
| `ScheduleService` | `getAll` (apenas futuros: `date >= now`, JOIN), `add`, `update`, `delete` |
| `HelperService` | `ensureActiveColumn` (migração), `getAll` (ativos primeiro), `add`, `update`, `toggleActive`, `delete` |
| `ExpenseService` | `getAll` (JOIN helpers), `getHelperBalances` (diárias−vales pendentes), `add`, `update`, `togglePaid`, `delete`, `payHelperBalance` (quita saldo + cria `AjudaPagamento`) |
| `CrmService` | `getSettings`, `updateSettings` (transação), `getInactiveClients`, `registerContact` (upsert snooze), `ignoreClient` |
| `ReportService` | `generateReceipt`, `generateWashesReport`, `generateExpensesReport`, `generateHelperBalanceReport` (HTML→PDF via `expo-print` → `Sharing`) |
| `BackupService` | `exportData` (JSON de 6 tabelas → Sharing), `importData` (DocumentPicker → DELETE all + reinsert em transação) |
| `ApiService` (estático) | `loginHelper`, `registerPunch`, `getTodayPunches`, `getAdminTimesheets`, `updateTimesheet` |

### Detalhes relevantes
- **UUID:** `Crypto.randomUUID()`.
- **Serviços de lavagem** armazenados como **JSON string** na coluna `services` e parseados na leitura (com fallback defensivo `[]`).
- **`getHelperBalances`** usa agregação SQL: soma de `AjudaDiaria` menos `AjudaVale` apenas para registros `isPaid = 0`.
- **`payHelperBalance`** marca diárias/vales pendentes como pagas e insere uma despesa `AjudaPagamento` (que é a saída real de caixa).
- **PDFs** usam `expo-file-system/legacy` (importante: evita crash de depreciação no Expo 54).

---

## 8. Telas (Screens) e Componentes

| Tela | Função | Serviços usados |
|------|--------|-----------------|
| `LoginScreen` | Alterna Ajudante/Admin. Admin: senha mestre `123456` (hardcoded). Ajudante: API. | `ApiService` |
| `HelperCheckinScreen` | Geo-cerca + 4 batidas sequenciais + anti-print. | `ApiService`, `expo-location`, `expo-screen-capture` |
| `AdminTimesheetScreen` | Lista/edita pontos (modal). | `ApiService` |
| `DashboardScreen` | KPIs do mês + próximos agendamentos. | client/wash/schedule/expense |
| `ClientScreen` | Lista clientes + veículos (CRUD). | client/vehicle |
| `ScheduleScreen` | Agenda futura (CRUD). | schedule/client/vehicle |
| `WashScreen` | Lavagens (CRUD), recibo PDF. | wash/report |
| `CallBackScreen` | CRM de recuperação, WhatsApp deep link. | crm |
| `ExpenseScreen` | Despesas + saldos de ajudantes. | expense/helper |
| `ReportScreen` | Relatórios filtrados + PDF + baixa em massa. | wash/expense/client/helper/report |
| `BackupScreen` | Exportar/Importar JSON. | backup |

Componentes (`src/components/`): `AppModal` (bottom sheet modal genérico), e os formulários `ClientForm`, `VehicleForm`, `WashForm`, `ScheduleForm`, `ExpenseForm`, `HelperForm`.

---

## 9. Navegação e Autenticação

`AppNavigator.tsx`:

- **Stack** (sem header):
  - `Login` → `LoginScreen`
  - `MainTabs` → `MainTabNavigator` (área do patrão)
  - `HelperCheckin` → `HelperCheckinScreen` (área do ajudante)
- **Bottom Tabs** (`MainTabNavigator`, cor ativa `#EAB308`):
  `Início` · `Clientes` · `Agenda` · `Lavagens` · `CRM` (Call Back) · `Despesas` · `Ponto` · `Relatórios` · `Backup`

**Autenticação:**
- **Admin:** PIN mestre **`123456`** comparado localmente em `LoginScreen.handleAdminLogin` → `navigation.replace('MainTabs')`. ⚠️ Hardcoded — trocar em produção.
- **Ajudante:** `ApiService.loginHelper(username, pin)` → retorna dados do ajudante → `navigation.replace('HelperCheckin', { helper })`.

---

## 10. API Backend (Contrato + Implementação)

### Base URL (produção atual)
```
https://sites-apidanilavagem.oehpg2.easypanel.host/api
```
Configurada em `src/services/apiService.ts` (`API_BASE_URL`).

### Endpoints consumidos pelo app

| Método | Rota | Body / Params | Resposta |
|--------|------|---------------|----------|
| POST | `/login` | `{ username, pin }` | dados do ajudante (`{ helperId, name, ... }`) ou `{ error }` |
| POST | `/punch` | `{ helperId, type, time }` (`type`: `entryMorning`/`exitNoon`/`entryAfternoon`/`exitEvening`, `time` `HH:MM` BRT) | registro atualizado |
| GET | `/punches/today/:helperId` | — | `TimePunch \| null` do dia |
| GET | `/admin/timesheets?start=YYYY-MM-DD&end=YYYY-MM-DD` | — | `TimePunch[]` |
| PUT | `/admin/timesheets/:punchId` | `Partial<TimePunch>` | registro atualizado |

`TimePunch`:
```ts
interface TimePunch {
  id: string;
  helperId: string;
  date: string;                 // YYYY-MM-DD
  entryMorning: string | null;  // HH:MM
  exitNoon: string | null;
  entryAfternoon: string | null;
  exitEvening: string | null;
  payFullShift: boolean;
  hourlyRate: number;
  totalCalculated: number;
}
```

### Implementação de referência (`backend-danilavagem/src/server.js`)

> Reconstruída a partir do contrato. **Ausente no backup** — use esta como base.

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const todayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD

// Converte "HH:MM" -> minutos
const toMin = (t) => (t ? (+t.split(':')[0]) * 60 + (+t.split(':')[1]) : null);

function calcTotal(p) {
  if (p.payFullShift) return Number(p.dailyRate || p.hourlyRate * 8 || 0);
  const blocks = [
    [toMin(p.entryMorning), toMin(p.exitNoon)],
    [toMin(p.entryAfternoon), toMin(p.exitEvening)],
  ];
  let minutes = 0;
  for (const [a, b] of blocks) if (a != null && b != null && b > a) minutes += b - a;
  return +((minutes / 60) * Number(p.hourlyRate || 0)).toFixed(2);
}

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, pin } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id AS helperId, name, hourlyRate FROM helpers WHERE username = ? AND pin = ? AND active = 1',
      [username, pin]
    );
    if (!rows.length) return res.status(401).json({ error: 'Usuário ou PIN inválidos.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// GET /api/punches/today/:helperId
app.get('/api/punches/today/:helperId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM time_punches WHERE helperId = ? AND date = ?',
      [req.params.helperId, todayStr()]
    );
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar pontos.' });
  }
});

// POST /api/punch
app.post('/api/punch', async (req, res) => {
  const { helperId, type, time } = req.body;
  const valid = ['entryMorning', 'exitNoon', 'entryAfternoon', 'exitEvening'];
  if (!valid.includes(type)) return res.status(400).json({ error: 'Tipo inválido.' });
  const date = todayStr();
  try {
    const [h] = await pool.query('SELECT hourlyRate, dailyRate FROM helpers WHERE id = ?', [helperId]);
    const hourlyRate = h[0]?.hourlyRate || 0;

    let [rows] = await pool.query(
      'SELECT * FROM time_punches WHERE helperId = ? AND date = ?', [helperId, date]
    );
    let punch = rows[0];
    if (!punch) {
      const id = crypto.randomUUID();
      await pool.query(
        'INSERT INTO time_punches (id, helperId, date, hourlyRate, payFullShift) VALUES (?, ?, ?, ?, 0)',
        [id, helperId, date, hourlyRate]
      );
      punch = { id, helperId, date, hourlyRate, payFullShift: 0 };
    }
    punch[type] = time;
    punch.totalCalculated = calcTotal(punch);
    await pool.query(
      `UPDATE time_punches SET ${type} = ?, totalCalculated = ? WHERE id = ?`,
      [time, punch.totalCalculated, punch.id]
    );
    res.json(punch);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao registrar ponto.' });
  }
});

// GET /api/admin/timesheets?start=&end=
app.get('/api/admin/timesheets', async (req, res) => {
  const { start, end } = req.query;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM time_punches WHERE date BETWEEN ? AND ? ORDER BY date DESC',
      [start, end]
    );
    res.json(rows.map(r => ({ ...r, payFullShift: !!r.payFullShift })));
  } catch (e) {
    res.status(500).json({ error: 'Erro ao obter planilhas.' });
  }
});

// PUT /api/admin/timesheets/:id
app.put('/api/admin/timesheets/:id', async (req, res) => {
  const u = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM time_punches WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado.' });
    const punch = { ...rows[0], ...u };
    punch.totalCalculated = calcTotal(punch);
    await pool.query(
      `UPDATE time_punches SET entryMorning=?, exitNoon=?, entryAfternoon=?, exitEvening=?,
         payFullShift=?, totalCalculated=? WHERE id=?`,
      [punch.entryMorning, punch.exitNoon, punch.entryAfternoon, punch.exitEvening,
       punch.payFullShift ? 1 : 0, punch.totalCalculated, req.params.id]
    );
    res.json(punch);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao atualizar.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
```

### Schema MySQL de inicialização

```sql
CREATE TABLE helpers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60) UNIQUE NOT NULL,
  pin VARCHAR(10) NOT NULL,
  hourlyRate DECIMAL(10,2) DEFAULT 0,
  dailyRate DECIMAL(10,2) DEFAULT 0,
  active TINYINT(1) DEFAULT 1
);

CREATE TABLE time_punches (
  id VARCHAR(36) PRIMARY KEY,
  helperId VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  entryMorning VARCHAR(5),
  exitNoon VARCHAR(5),
  entryAfternoon VARCHAR(5),
  exitEvening VARCHAR(5),
  payFullShift TINYINT(1) DEFAULT 0,
  hourlyRate DECIMAL(10,2) DEFAULT 0,
  totalCalculated DECIMAL(10,2) DEFAULT 0,
  UNIQUE KEY uq_helper_date (helperId, date),
  CONSTRAINT fk_punch_helper FOREIGN KEY (helperId) REFERENCES helpers(id)
);
```

### `.env` do backend
```env
DB_HOST=seu-host-mysql
DB_PORT=3306
DB_USER=usuario
DB_PASSWORD=senha
DB_NAME=danilavagem
PORT=3000
```

---

## 11. Regras de Negócio Importantes

### Geo-cerca (controle de ponto)
- `src/utils/geoUtils.ts`: coordenadas da empresa `lat -29.436328...`, `lon -51.966856...`.
- Raio permitido: **100 metros** (`ALLOWED_RADIUS_METERS`).
- Fórmula de **Haversine** para distância. Validação **dupla**: ao abrir a tela e novamente no instante do clique de cada batida.
- Batidas são **sequenciais** (não se pode bater saída sem a entrada correspondente).
- `expo-screen-capture` bloqueia prints enquanto a tela está ativa.

### CRM (recuperação de clientes)
- "Inativo" = cliente com pelo menos uma lavagem, cuja **última lavagem** foi há mais de `inactivityDays` (padrão 30) e que **não está em snooze** (`nextContactDate`) nem ignorado.
- Ao avisar via WhatsApp: monta deep link `whatsapp://send?phone=...&text=...`, normaliza o telefone (adiciona DDI `55` e DDD `51` conforme o nº de dígitos), e oferece registrar o contato (aplica snooze de `snoozeDays`, padrão 15).

### Financeiro
- **A Receber:** soma de lavagens com `paymentType = 'Faturamento Posterior'` e `isCharged = false` (dívida acumulada, independente do mês).
- **Despesas do mês (Dashboard):** apenas `isPaid = true` e **excluindo** `AjudaDiaria` e `AjudaVale` (movimentos internos de saldo); `AjudaPagamento` conta como saída real.
- **Saldo do ajudante:** `Σ AjudaDiaria(pendente) − Σ AjudaVale(pendente)`.
- **Baixa em massa** (Relatórios): marca todas as lavagens em aberto do filtro como cobradas.

### Pagamentos (`paymentTypes`)
`Dinheiro`, `Cartão de Débito`, `Cartão de Crédito`, `PIX`, `Faturamento Posterior`.

### Tabela de serviços (`serviceList` em `types/index.ts`)
19 serviços com preços fixos (ex.: Lavagem Simples R$40, Completa Hatch R$60, Detalhada R$450, Higienização Interna R$800, etc.).

### Backup
- **Export:** JSON com `clients, vehicles, schedules, washes, helpers, expenses` → salvo em `cacheDirectory/backups/backup_dani_carwash_YYYY-MM-DD.json` → `Sharing`.
- **Import:** ⚠️ **DESTRUTIVO** — `DELETE` em todas as tabelas e reinserção dentro de transação (FK desligadas durante o processo). Não inclui `settings`/`crm_callbacks`.

---

## 12. Script de Replicação — Passo a Passo

### Pré-requisitos
- Node.js 20+, npm
- `npm i -g expo-cli eas-cli` (ou usar `npx`)
- Android Studio (emulador) ou app **Expo Go / Dev Client** no celular
- Docker (para o backend) e uma instância MySQL
- Conta Expo (EAS) para builds

### Passo 1 — Frontend

```bash
# 1. Criar o projeto Expo (TypeScript)
npx create-expo-app AppLavegemReact --template blank-typescript
cd AppLavegemReact

# 2. Instalar dependências exatas
npx expo install expo-sqlite expo-crypto expo-location expo-print \
  expo-sharing expo-file-system expo-document-picker expo-screen-capture \
  expo-status-bar expo-system-ui expo-dev-client

npm install @react-navigation/native @react-navigation/native-stack \
  @react-navigation/bottom-tabs @expo/vector-icons \
  @react-native-community/datetimepicker @react-native-picker/picker

npx expo install react-native-gesture-handler react-native-reanimated \
  react-native-safe-area-context react-native-screens
```

### Passo 2 — `app.json`
Configurar nome, slug, ícones, splash `#EAB308`, package `com.dani.lavagem` e o plugin do SQLite:
```json
"plugins": [["expo-sqlite", { "useNext": true }]]
```

### Passo 3 — Estrutura `src/`
Recriar as pastas e arquivos conforme a [seção 3](#3-estrutura-de-pastas):
1. `types/index.ts` — interfaces, `serviceList`, `paymentTypes`, tipos de despesa, `COMPANY_INFO`.
2. `database/database.ts` — `initDB()` com os `CREATE TABLE` e seeds da [seção 4](#4-modelo-de-dados-sqlite-local).
3. `database/databaseProvider.tsx` — Context que instancia os serviços quando `db` está pronto.
4. `services/*` — implementar cada classe conforme a [seção 7](#7-camada-de-serviços-frontend).
5. `utils/*` — `formatters.ts`, `geoUtils.ts` (ajustar coordenadas da SUA empresa).
6. `components/*` e `screens/*`.
7. `navigation/AppNavigator.tsx` — Stack + BottomTabs.
8. `App.tsx` — `SafeAreaProvider` → `DatabaseProvider` → `NavigationContainer` → `AppNavigator`.

### Passo 4 — Configurações a personalizar
- `LoginScreen.tsx`: `MASTER_PIN` (senha do patrão).
- `apiService.ts`: `API_BASE_URL` apontando para o seu backend.
- `geoUtils.ts`: `COMPANY_COORDS` e `ALLOWED_RADIUS_METERS`.
- `types/index.ts`: `COMPANY_INFO`, `serviceList`, preços.

### Passo 5 — Rodar em desenvolvimento
```bash
npx expo start            # Expo Go / web
# ou, por usar libs nativas (sqlite/location), gerar dev client:
npx expo run:android
```

### Passo 6 — Backend

```bash
mkdir backend-danilavagem && cd backend-danilavagem
npm init -y
npm install express cors dotenv mysql2
mkdir src
# criar src/server.js (seção 10) e .env
```

`package.json` → `"main": "src/server.js"`, `"scripts": { "start": "node src/server.js" }`.

Criar o schema MySQL (seção 10) e popular `helpers` com ao menos um ajudante de teste.

```bash
node src/server.js     # local em http://localhost:3000
```

### Passo 7 — Docker (opcional / produção)
`Dockerfile` (já presente, `node:20-alpine`, expõe 3000, `npm start`).
```bash
docker build -t dani-lavagem-api .
docker run -p 3000:3000 --env-file .env dani-lavagem-api
```

---

## 13. Build, Deploy e Publicação

### App (EAS Build) — `eas.json`
```bash
eas login
eas build:configure
# APK de produção:
eas build -p android --profile production
```
Perfis disponíveis:
- `development` — dev client, distribuição interna.
- `preview` — distribuição interna.
- `production` — `buildType: apk`.

`projectId` (EAS) atual em `app.json`: `c3747938-c499-478a-9306-a429c5d8ef5b` (gerar o seu próprio com `eas init`).

### Backend (Easypanel)
1. Subir o repositório com `Dockerfile`.
2. Criar serviço App apontando para o Docker.
3. Provisionar MySQL (serviço de banco do Easypanel) e configurar as variáveis de ambiente (`DB_*`, `PORT`).
4. Anotar a URL pública gerada e colocá-la em `apiService.ts`.

---

## 14. Checklist de Configuração / Personalização

| Item | Arquivo | Ação |
|------|---------|------|
| Senha do patrão | `src/screens/LoginScreen.tsx` | Trocar `MASTER_PIN = '123456'` (⚠️ mover p/ backend idealmente) |
| URL da API | `src/services/apiService.ts` | `API_BASE_URL` |
| Coordenadas da empresa | `src/utils/geoUtils.ts` | `COMPANY_COORDS`, raio |
| Dados da empresa (recibo) | `src/types/index.ts` | `COMPANY_INFO` |
| Tabela de serviços/preços | `src/types/index.ts` | `serviceList` |
| Mensagem CRM padrão | `src/database/database.ts` | seed `crm_messageBody` |
| Ícones/splash/cores | `app.json` + `assets/` | `#EAB308` é a cor da marca |
| Package Android | `app.json` | `com.dani.lavagem` |
| Variáveis do banco | `backend-danilavagem/.env` | `DB_*`, `PORT` |

---

## ⚠️ Observações de Segurança (dívidas técnicas conhecidas)

1. **PIN de admin hardcoded** (`123456`) no app — qualquer um com o APK descompilado o vê. Migrar para autenticação no backend.
2. **PIN de ajudante** trafega/armazena possivelmente em texto puro — usar hash (bcrypt) no MySQL.
3. **API sem autenticação** nas rotas admin (`/admin/timesheets`) — adicionar token/JWT.
4. **Backup/Import destrutivo** sem mesclagem — orientar o usuário; considerar versionamento.
5. **`settings` e `crm_callbacks` não entram no backup** — perda dessas configs na restauração.

---

*Documento gerado a partir da engenharia reversa completa do código-fonte em `AppLavegemReact/` e `backend-danilavagem/`. O `src/server.js` do backend foi reconstruído a partir do contrato consumido pelo app, por não estar presente neste backup.*
