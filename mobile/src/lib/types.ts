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
}

export interface Vehicle {
  id: string;
  client_id: string;
  make?: string;
  model?: string;
  license_plate?: string;
  color?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  is_company: boolean;
  document?: string;
  allow_credit?: boolean;
  address?: string;
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
  services: { id?: string; name: string; price: number }[];
  observations?: string;
  pickup?: boolean;
  pickup_address?: string;
  pickup_fee?: number;
  pickup_status?: PickupStatus | null;
  pickup_time?: string | null;
  client_allow_credit?: boolean;
  client_phone?: string | null;
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
  saldo?: number;
  total_diarias?: number;
  total_vales?: number;
  total_pagamentos?: number;
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
  vehicle_info?: string;
  items: { name: string; price: number }[];
  total: number;
  payment_type?: string;
  observations?: string;
  via_ad?: boolean;
  created_at: string;
}

export const PAYMENT_TYPES = [
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'PIX',
  'Faturamento Posterior',
];

export const EXPENSE_TYPES = ['Produto', 'Energia', 'Água', 'Aluguel', 'Outro'];

// Lançamentos financeiros de colaborador (mesma tabela de despesas).
export const HELPER_EXPENSE_TYPES: { id: string; label: string }[] = [
  { id: 'AjudaDiaria', label: 'Diária de trabalho' },
  { id: 'AjudaVale', label: 'Vale (adiantamento)' },
  { id: 'AjudaPagamento', label: 'Pagamento (acerto)' },
];
