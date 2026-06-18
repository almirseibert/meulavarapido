// Formatadores manuais — Hermes (RN) NÃO suporta Intl/toLocale*.
// Nunca reintroduza Intl.NumberFormat / toLocaleDateString aqui.

export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}R$ ${withDots},${dec}`;
}

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function toDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  return new Date(input);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(input: string | number | Date): string {
  const d = toDate(input);
  if (isNaN(d.getTime())) return '--';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateShort(input: string | number | Date): string {
  const d = toDate(input);
  if (isNaN(d.getTime())) return '--';
  return `${pad(d.getDate())} ${MESES[d.getMonth()]}`;
}

export function formatTime(input: string | number | Date): string {
  const d = toDate(input);
  if (isNaN(d.getTime())) return '--';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(input: string | number | Date): string {
  return `${formatDate(input)} ${formatTime(input)}`;
}

export function monthLabel(month: string): string {
  // month = "YYYY-MM"
  const [y, m] = month.split('-').map(Number);
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[(m || 1) - 1]} de ${y}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// Monta um Date a partir de "DD/MM/AAAA" + "HH:MM". Retorna null se inválido.
export function parseDateTime(dateStr: string, timeStr: string): Date | null {
  const dm = (dateStr || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const tm = (timeStr || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!dm) return null;
  const [, d, mo, y] = dm;
  const h = tm ? Number(tm[1]) : 0;
  const min = tm ? Number(tm[2]) : 0;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), h, min, 0, 0);
  if (isNaN(date.getTime())) return null;
  return date;
}

// Date -> "DD/MM/AAAA"
export function toDateInput(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// "55519..." -> link de WhatsApp normalizado (DDI 55 / DDD 51 quando faltar)
export function whatsappNumber(phone?: string | null): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 9) digits = '51' + digits;   // sem DDD -> assume 51
  if (digits.length <= 11) digits = '55' + digits;  // sem DDI -> assume 55
  return digits;
}
