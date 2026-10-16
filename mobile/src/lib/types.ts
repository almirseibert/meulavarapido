export interface Owner {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  plan: 'free' | 'premium';
  premium_until: string | null;
  trial_ends_at?: string | null;
  isPremium: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  hasAccess: boolean;
  // false quando o telefone já tinha usado o teste grátis numa conta anterior
  // (o teste vale uma vez por telefone, mesmo depois de excluir a conta).
  hadTrial?: boolean;
}

export interface Company {
  owner_id: string;
  name?: string;
  document?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  logo_url?: string;
  receipt_footer?: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
  /** Detalhamento do serviço — preenche automaticamente recibos e orçamentos. */
  description?: string;
}

/** Uma vigência de preço do serviço (o passado nunca é reprecificado). */
export interface ServicePrice {
  id: string;
  price: number;
  valid_from: string;
}

export interface Vehicle {
  id: string;
  client_id: string;
  nickname?: string;
  make?: string;
  model?: string;
  license_plate?: string;
  color?: string;
  year?: string;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  is_company: boolean;
  document?: string;
  allow_credit?: boolean;
  address?: string;
  city?: string;
  birth_date?: string;
  notes?: string;
  vehicles: Vehicle[];
}

export interface Wash {
  id: string;
  client_id?: string;
  vehicle_id?: string;
  client_name?: string;
  vehicle_info?: string;
  date: string;
  price: number;
  payment_type?: string;
  is_charged: boolean;
  services: { id?: string; name: string; price: number; description?: string | null }[];
  observations?: string;
  pickup?: boolean;
  pickup_address?: string;
  pickup_fee?: number;
  pickup_status?: PickupStatus | null;
  pickup_time?: string | null;
  client_allow_credit?: boolean;
  client_phone?: string | null;
  client_document?: string | null;
}

export type PickupStatus = 'a_buscar' | 'em_servico' | 'a_entregar' | 'concluido';

export const PICKUP_STATUS: { id: PickupStatus; label: string; next?: PickupStatus }[] = [
  { id: 'a_buscar', label: 'A buscar', next: 'em_servico' },
  { id: 'em_servico', label: 'Em serviço', next: 'a_entregar' },
  { id: 'a_entregar', label: 'A entregar', next: 'concluido' },
  { id: 'concluido', label: 'Concluído' },
];

export interface Helper {
  id: string;
  name: string;
  daily_rate: number;
  active: boolean;
  /** Quanto ainda se deve ao colaborador (débitos - créditos). Zero = quitado. */
  saldo?: number;
  total_debitos?: number;
  total_diarias?: number;
  total_bonus?: number;
  total_vales?: number;
  total_pagamentos?: number;
  total_debitos_pagos?: number;
}

/** Linha do extrato do colaborador (lançamentos na tabela de despesas). */
export interface HelperEntry {
  id: string;
  type: string;
  date: string;
  description?: string;
  value: number;
  is_paid: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  company_name?: string;
  document?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  products?: string;
  notes?: string;
}

export interface AppDocument {
  id: string;
  kind: 'receipt' | 'quote';
  number: number;
  client_name?: string;
  client_phone?: string;
  client_document?: string;
  vehicle_info?: string;
  items: { name: string; price: number; description?: string }[];
  total: number;
  payment_type?: string;
  observations?: string;
  via_ad?: boolean;
  created_at: string;
}

// Forma de pagamento que nasce EM ABERTO (dívida do cliente): a lavagem fica
// com is_charged = false até a baixa. Exportada para o app não repetir a string.
export const FATURAMENTO_POSTERIOR = 'Faturamento Posterior';

export const PAYMENT_TYPES = [
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'PIX',
  FATURAMENTO_POSTERIOR,
];

export const EXPENSE_TYPES = ['Produto', 'Energia', 'Água', 'Aluguel', 'Outro'];

// Lançamentos financeiros de colaborador (mesma tabela de despesas).
// kind: 'debito' aumenta o saldo devido ao colaborador; 'credito' abate.
export const HELPER_EXPENSE_TYPES: { id: string; label: string; kind: 'debito' | 'credito' }[] = [
  { id: 'AjudaDiaria', label: 'Diária de trabalho', kind: 'debito' },
  { id: 'AjudaBonus', label: 'Bônus', kind: 'debito' },
  { id: 'AjudaVale', label: 'Vale (adiantamento)', kind: 'credito' },
  { id: 'AjudaPagamento', label: 'Pagamento (acerto)', kind: 'credito' },
];

export const HELPER_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  HELPER_EXPENSE_TYPES.map((t) => [t.id, t.label])
);
export const HELPER_TYPE_IDS: string[] = HELPER_EXPENSE_TYPES.map((t) => t.id);
