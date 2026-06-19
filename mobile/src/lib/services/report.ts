import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatCurrency, formatDate } from '../utils';
import type { Company } from '../types';

export interface ReportRow {
  left: string;       // título (cliente/veículo ou grupo)
  sub?: string;       // subtítulo (data / detalhe)
  value: number;      // valor monetário
  flag?: string;      // ex.: "(Aberto)"
}

export interface ReportData {
  title: string;
  period?: string;
  rows: ReportRow[];
  total: number;
}

function esc(s?: string) {
  return (s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
}

function buildReportHtml(company: Company, data: ReportData): string {
  const rows = data.rows
    .map(
      (r) => `<tr>
        <td style="padding:8px 4px;border-bottom:1px solid #eee">
          <div style="font-weight:600">${esc(r.left)}</div>
          ${r.sub ? `<div style="font-size:11px;color:#64748b">${esc(r.sub)}</div>` : ''}
        </td>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
          ${formatCurrency(r.value)} ${r.flag ? `<span style="color:#dc2626;font-size:11px">${esc(r.flag)}</span>` : ''}
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color:#0f172a; }
    body { padding: 28px; }
    .brand { font-size: 22px; font-weight: 800; color:#0B4F6C; }
    .title { margin-top: 14px; font-size: 18px; font-weight: 700; color:#0891b2; }
    .muted { color:#64748b; font-size: 12px; }
    table { width:100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    .total { margin-top: 14px; text-align:right; font-size: 18px; font-weight: 800; color:#16a34a; }
    .footer { margin-top: 28px; font-size: 11px; color:#94a3b8; text-align:center; }
  </style></head><body>
    <div class="brand">${esc(company.name || 'Meu Lava Rápido')}</div>
    <div class="title">${esc(data.title)}</div>
    ${data.period ? `<div class="muted">Período: ${esc(data.period)}</div>` : ''}
    <div class="muted">${data.rows.length} registro(s)</div>
    <table><tbody>${rows}</tbody></table>
    <div class="total">Total: ${formatCurrency(data.total)}</div>
    <div class="footer">Relatório gerado pelo app Meu Lava Rápido — ${formatDate(Date.now())}</div>
  </body></html>`;
}

/** Gera o PDF do relatório e abre o compartilhamento nativo. */
export async function generateReportPdf(company: Company, data: ReportData) {
  const html = buildReportHtml(company, data);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório' });
  }
  return uri;
}
