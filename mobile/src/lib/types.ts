export interface Owner {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'premium';
  premium_until: string | null;
  isPremium: boolean;
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

export interface Usage {
  isPremium: boolean;
  limits: { washesPerDay: number; receipts: number; quotes: number };
  washes: { today: number; remaining: number | null; requiresAd: boolean };
  receipts: { total: number; remaining: number | null; requiresAd: boolean };
  quotes: { total: number; remaining: number | null; requiresAd: boolean };
}

export const PAYMENT_TYPES = [
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito',
  'PIX',
  'Faturamento Posterior',
];

export const EXPENSE_TYPES = ['Produto', 'Energia', 'Água', 'Aluguel', 'Outro'];
