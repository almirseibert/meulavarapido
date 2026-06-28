/* Gera um diagrama do fluxo de publicação na Play Store. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const OUT = path.join(__dirname, 'assets');
const FONT = `'Segoe UI', Arial, sans-serif`;
const C = { brand: '#0B4F6C', brand2: '#0E6B8F', cyan: '#0891b2', light: '#22d3ee', ink: '#0f172a', muted: '#475569', card: '#FFFFFF', line: '#dbe4ea' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size||16}" fill="${o.color||C.ink}" font-weight="${o.weight||400}" text-anchor="${o.anchor||'start'}">${esc(s)}</text>`;

const steps = [
  ['1', 'Gerar o AAB', 'eas build -p android --profile production'],
  ['2', 'Criar conta no Play Console', 'Taxa única de US$ 25 (cartão)'],
  ['3', 'Criar o aplicativo', 'Nome, idioma, app gratuito'],
  ['4', 'Preencher a ficha da loja', 'Textos + ícone + capturas + destaque'],
  ['5', 'Conteúdo do app', 'Privacidade, classificação, segurança de dados'],
  ['6', 'Configurar assinaturas', 'Planos mensal e anual + teste de 14 dias'],
  ['7', 'Teste interno', 'Envie o AAB e instale você mesmo'],
  ['8', 'Teste fechado (obrigatório)', '12 testadores por 14 dias (contas novas)'],
  ['9', 'Enviar para produção', 'Google revisa e publica (horas a dias)'],
];

const W = 900, top = 130, rowH = 118, H = top + steps.length * rowH + 40;
const cardX = 150, cardW = W - cardX - 50, cardH = 92;

let body = '';
steps.forEach((s, i) => {
  const y = top + i * rowH;
  const cy = y + cardH / 2;
  // linha conectora
  if (i < steps.length - 1) body += `<line x1="95" y1="${cy}" x2="95" y2="${y + rowH + cardH/2}" stroke="${C.light}" stroke-width="4"/>`;
  // bolinha numero
  body += `<circle cx="95" cy="${cy}" r="34" fill="${C.cyan}"/>`;
  body += `<circle cx="95" cy="${cy}" r="34" fill="none" stroke="#fff" stroke-width="4"/>`;
  body += T(95, cy + 11, s[0], { size: 30, weight: 800, color: '#fff', anchor: 'middle' });
  // card
  body += `<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="18" fill="${C.card}" stroke="${C.line}" stroke-width="1.5"/>`;
  body += T(cardX + 26, y + 40, s[1], { size: 23, weight: 800, color: C.brand });
  body += T(cardX + 26, y + 70, s[2], { size: 17, color: C.muted });
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F1F5F9"/>
  <rect width="${W}" height="86" fill="${C.brand}"/>
  ${T(40, 54, 'Fluxo de publicação na Google Play', { size: 30, weight: 800, color: '#fff' })}
  ${body}
</svg>`;
sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'fluxo-publicacao.png')).then(() => console.log('OK fluxo'));
