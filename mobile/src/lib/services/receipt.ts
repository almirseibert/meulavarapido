import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from '../utils';
import type { Company } from '../types';

export interface DocItem {
  name: string;
  price: number;
}

export interface ReceiptData {
  kind: 'receipt' | 'quote';
  number: number;
  clientName?: string;
  vehicleInfo?: string;
  items: DocItem[];
  total: number;
  paymentType?: string;
  observations?: string;
  date?: string | number | Date;
}

function esc(s?: string) {
  return (s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

function buildHtml(company: Company, doc: ReceiptData): string {
  const title = doc.kind === 'quote' ? 'ORÇAMENTO' : 'RECIBO';
  const rows = doc.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 4px;border-bottom:1px solid #eee">${esc(i.name)}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(i.price)}</td>
      </tr>`
    )
    .join('');

  const contactLines = [
    company.address,
    [company.city, company.state].filter(Boolean).join(' - '),
    company.phone && `Tel: ${esc(company.phone)}`,
    company.whatsapp && `WhatsApp: ${esc(company.whatsapp)}`,
    company.email && esc(company.email),
    company.instagram && `Instagram: ${esc(company.instagram)}`,
    company.document && `CNPJ/CPF: ${esc(company.document)}`,
  ]
    .filter(Boolean)
    .map((l) => `<div>${esc(String(l))}</div>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; }
    body { padding: 28px; }
    .brand { font-size: 24px; font-weight: 800; color:#0B4F6C; }
    .title { margin-top: 16px; font-size: 18px; font-weight: 700; letter-spacing: 1px; color:#0891b2; }
    .muted { color:#64748b; font-size: 12px; }
    table { width:100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    .total { margin-top: 12px; text-align:right; font-size: 18px; font-weight: 800; }
    .box { border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-top:14px; }
    .footer { margin-top: 28px; font-size: 11px; color:#94a3b8; text-align:center; }
  </style></head><body>
    <div class="brand">${esc(company.name || 'Meu Lava Rápido')}</div>
    <div class="muted">${contactLines}</div>

    <div class="title">${title} Nº ${String(doc.number).padStart(4, '0')}</div>
    <div class="muted">Data: ${formatDate(doc.date || Date.now())}</div>

    <div class="box">
      <div><strong>Cliente:</strong> ${esc(doc.clientName || '-')}</div>
      ${doc.vehicleInfo ? `<div><strong>Veículo:</strong> ${esc(doc.vehicleInfo)}</div>` : ''}
      ${doc.paymentType ? `<div><strong>Pagamento:</strong> ${esc(doc.paymentType)}</div>` : ''}
    </div>

    <table>
      <thead><tr>
        <th style="text-align:left;padding:8px 4px;border-bottom:2px solid #0B4F6C">Serviço</th>
        <th style="text-align:right;padding:8px 4px;border-bottom:2px solid #0B4F6C">Valor</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="total">Total: ${formatCurrency(doc.total)}</div>
    ${doc.observations ? `<div class="box muted">${esc(doc.observations)}</div>` : ''}

    <div class="footer">
      ${esc(company.receipt_footer || 'Obrigado pela preferência!')}<br/>
      Documento gerado pelo app Meu Lava Rápido.
    </div>
  </body></html>`;
}

/** Gera o PDF e abre o compartilhamento nativo. */
export async function generateAndShare(company: Company, doc: ReceiptData) {
  const html = buildHtml(company, doc);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar documento' });
  }
  return uri;
}
