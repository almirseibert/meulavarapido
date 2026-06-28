/* Gera as artes da Google Play Store (PNG) a partir de SVG, usando sharp.
 * Saída em ./assets
 *  - icon-512.png            (ícone alta resolução 512x512)
 *  - feature-graphic.png     (gráfico de destaque 1024x500)
 *  - screenshot-01..06.png   (capturas promocionais 1080x1920)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, 'assets');
fs.mkdirSync(OUT, { recursive: true });

// ---------- Paleta da marca ----------
const C = {
  brand: '#0B4F6C',
  brand700: '#0E6B8F',
  cyan: '#0891b2',
  cyan2: '#06b6d4',
  light: '#22d3ee',
  lighter: '#a5f3fc',
  bg: '#F1F5F9',
  card: '#FFFFFF',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#E2E8F0',
  green: '#16a34a',
  greenBg: '#dcfce7',
  red: '#dc2626',
  orange: '#ea580c',
  amber: '#f59e0b',
  amberBg: '#fef3c7',
  amberInk: '#b45309',
};
const FONT = `'Segoe UI', 'Trebuchet MS', Arial, sans-serif`;

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function txt(x, y, s, { size = 16, color = C.ink, weight = 400, anchor = 'start', spacing = 0, opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}">${esc(s)}</text>`;
}
function rrect(x, y, w, h, r, { fill = C.card, stroke = 'none', sw = 0, opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"/>`;
}

// ---------- logotipo: gota d'água com carrinho ----------
function droplet(cx, cy, s, { bulb = C.cyan2, hl = C.light, car = '#FFFFFF', wheel = C.brand, glass = C.lighter } = {}) {
  // unidade: apex em y=-1.15, bulbo centrado em y=0.35 raio 0.95
  const dPath = `M0,-1.15 C0.45,-0.5 0.95,-0.05 0.95,0.35 A0.95,0.95 0 1 1 -0.95,0.35 C-0.95,-0.05 -0.45,-0.5 0,-1.15 Z`;
  // carro em coords da unidade (centrado em 0,0.45, largura 1.5)
  const cw = 1.5, ch = 0.5;
  const bodyY = 0.45;
  const wheelR = 0.16;
  const wy = bodyY + ch / 2 - 0.02;
  const car_ = `
    <g>
      <rect x="${-cw/2}" y="${bodyY-ch/2}" width="${cw}" height="${ch}" rx="0.16" fill="${car}"/>
      <path d="M${-0.36},${bodyY-ch/2} a0.5,0.5 0 0 1 0.72,0 Z" fill="${car}"/>
      <path d="M${-0.30},${bodyY-ch/2-0.005} a0.40,0.40 0 0 1 0.60,0 Z" fill="${glass}"/>
      <circle cx="${-cw/2+0.42}" cy="${wy}" r="${wheelR}" fill="${wheel}"/>
      <circle cx="${cw/2-0.42}" cy="${wy}" r="${wheelR}" fill="${wheel}"/>
      <circle cx="${-cw/2+0.42}" cy="${wy}" r="0.06" fill="#FFFFFF"/>
      <circle cx="${cw/2-0.42}" cy="${wy}" r="0.06" fill="#FFFFFF"/>
      <circle cx="${cw/2-0.18}" cy="${bodyY}" r="0.05" fill="${C.amber}"/>
    </g>`;
  return `
  <g transform="translate(${cx},${cy}) scale(${s})">
    <path d="${dPath}" fill="${bulb}"/>
    <ellipse cx="-0.42" cy="-0.25" rx="0.16" ry="0.30" fill="${hl}" opacity="0.55"/>
    ${car_}
  </g>`;
}

// ---------- mini glifos (estilo lucide, traço) ----------
function chip(x, y, s, bg, glyph) {
  return `<g transform="translate(${x},${y})">${rrect(0, 0, s, s, s * 0.28, { fill: bg })}${glyph(s)}</g>`;
}
const stroke = (d, col, sw = 2) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const G = {
  drop: (col) => (s) => stroke(`M${s*0.5},${s*0.22} C${s*0.7},${s*0.45} ${s*0.74},${s*0.58} ${s*0.5},${s*0.74} C${s*0.26},${s*0.58} ${s*0.3},${s*0.45} ${s*0.5},${s*0.22} Z`, col, 2.2),
  trend: (col) => (s) => stroke(`M${s*0.24},${s*0.64} L${s*0.42},${s*0.46} L${s*0.54},${s*0.56} L${s*0.74},${s*0.34} M${s*0.62},${s*0.34} L${s*0.76},${s*0.34} L${s*0.76},${s*0.48}`, col, 2.2),
  wallet: (col) => (s) => `${stroke(`M${s*0.24},${s*0.34} h${s*0.5} a${s*0.04},${s*0.04} 0 0 1 ${s*0.04},${s*0.04} v${s*0.24} a${s*0.04},${s*0.04} 0 0 1 -${s*0.04},${s*0.04} h-${s*0.5} a${s*0.04},${s*0.04} 0 0 1 -${s*0.04},-${s*0.04} v-${s*0.24} a${s*0.04},${s*0.04} 0 0 1 ${s*0.04},-${s*0.04} Z`, col, 2.2)}<circle cx="${s*0.66}" cy="${s*0.5}" r="${s*0.045}" fill="${col}"/>`,
  calendar: (col) => (s) => `${stroke(`M${s*0.26},${s*0.3} h${s*0.48} a${s*0.04},${s*0.04} 0 0 1 ${s*0.04},${s*0.04} v${s*0.36} a${s*0.04},${s*0.04} 0 0 1 -${s*0.04},${s*0.04} h-${s*0.48} a${s*0.04},${s*0.04} 0 0 1 -${s*0.04},-${s*0.04} v-${s*0.36} a${s*0.04},${s*0.04} 0 0 1 ${s*0.04},-${s*0.04} Z M${s*0.22},${s*0.44} h${s*0.56} M${s*0.36},${s*0.26} v${s*0.08} M${s*0.64},${s*0.26} v${s*0.08}`, col, 2.2)}`,
  bars: (col) => (s) => stroke(`M${s*0.3},${s*0.72} v-${s*0.14} M${s*0.5},${s*0.72} v-${s*0.30} M${s*0.7},${s*0.72} v-${s*0.22}`, col, 3),
  phone: (col) => (s) => stroke(`M${s*0.3},${s*0.28} c0,0 0.02,0 0.1,${s*0.0} l${s*0.06},${s*0.0} a0.02,0.02 0 0 1 0.02,0.02 l${s*0.0},${s*0.08} c0,${s*0.04} -${s*0.02},${s*0.05} -${s*0.04},${s*0.06} c${s*0.0},${s*0.12} ${s*0.18},${s*0.30} ${s*0.30},${s*0.30} c${s*0.01},-${s*0.02} ${s*0.02},-${s*0.04} ${s*0.06},-${s*0.04} l${s*0.08},${s*0.0} a0.02,0.02 0 0 1 0.02,0.02 l${s*0.0},${s*0.10}`, col, 2.2),
  truck: (col) => (s) => `${stroke(`M${s*0.22},${s*0.38} h${s*0.30} v${s*0.22} h-${s*0.30} Z M${s*0.52},${s*0.46} h${s*0.14} l${s*0.10},${s*0.10} v${s*0.04} h-${s*0.24} Z`, col, 2.2)}<circle cx="${s*0.36}" cy="${s*0.64}" r="${s*0.05}" fill="none" stroke="${col}" stroke-width="2.2"/><circle cx="${s*0.66}" cy="${s*0.64}" r="${s*0.05}" fill="none" stroke="${col}" stroke-width="2.2"/>`,
  user: (col) => (s) => `<circle cx="${s*0.5}" cy="${s*0.4}" r="${s*0.1}" fill="none" stroke="${col}" stroke-width="2.2"/>${stroke(`M${s*0.3},${s*0.72} c0,-${s*0.13} ${s*0.1},-${s*0.18} ${s*0.2},-${s*0.18} c${s*0.1},0 ${s*0.2},${s*0.05} ${s*0.2},${s*0.18}`, col, 2.2)}`,
  crown: (col) => (s) => `<path d="M${s*0.26},${s*0.66} l-${s*0.02},-${s*0.26} l${s*0.14},${s*0.12} l${s*0.12},-${s*0.18} l${s*0.12},${s*0.18} l${s*0.14},-${s*0.12} l-${s*0.02},${s*0.26} Z" fill="${col}"/>`,
  search: (col) => (s) => `<circle cx="${s*0.46}" cy="${s*0.46}" r="${s*0.16}" fill="none" stroke="${col}" stroke-width="2.4"/>${stroke(`M${s*0.58},${s*0.58} L${s*0.72},${s*0.72}`, col, 2.6)}`,
  clock: (col) => (s) => `<circle cx="${s*0.5}" cy="${s*0.5}" r="${s*0.22}" fill="none" stroke="${col}" stroke-width="2.2"/>${stroke(`M${s*0.5},${s*0.38} v${s*0.14} h${s*0.1}`, col, 2.2)}`,
  pin: (col) => (s) => `${stroke(`M${s*0.5},${s*0.74} c-${s*0.16},-${s*0.18} -${s*0.18},-${s*0.28} -${s*0.18},-${s*0.36} a${s*0.18},${s*0.18} 0 0 1 ${s*0.36},0 c0,${s*0.08} -${s*0.02},${s*0.18} -${s*0.18},${s*0.36} Z`, col, 2.2)}<circle cx="${s*0.5}" cy="${s*0.38}" r="${s*0.06}" fill="${col}"/>`,
};

// ---------- componentes da UI do app ----------
function kpi(x, y, w, h, glyphChip, value, label) {
  return `${rrect(x, y, w, h, 18, { fill: C.card, stroke: C.line, sw: 1 })}
    ${glyphChip(x + 16, y + 16)}
    ${txt(x + 16, y + h - 30, value, { size: 26, weight: 800, color: C.ink })}
    ${txt(x + 16, y + h - 12, label, { size: 13, color: C.muted })}`;
}
function badge(x, y, label, fg, bg) {
  const w = label.length * 7.4 + 22;
  return `${rrect(x, y, w, 24, 12, { fill: bg })}${txt(x + 11, y + 16, label, { size: 12, weight: 700, color: fg })}`;
}
function tabbar(ox, oy, w, h, active) {
  const tabs = [
    [G.drop, 'Início'], [G.wallet, 'Lavagens'], [G.user, 'Clientes'], [G.calendar, 'Agenda'], [G.bars, 'Mais'],
  ];
  const by = oy + h - 96, tw = w / tabs.length;
  let s = rrect(ox, by, w, 96, 0, { fill: '#fff' });
  s += `<line x1="${ox}" y1="${by}" x2="${ox + w}" y2="${by}" stroke="${C.line}" stroke-width="1"/>`;
  tabs.forEach((t, i) => {
    const cx = ox + tw * i + tw / 2;
    const on = i === active;
    const col = on ? C.cyan : '#94a3b8';
    s += `<g transform="translate(${cx - 14},${by + 16})">${t[0](col)(28)}</g>`;
    s += txt(cx, by + 60, t[1], { size: 12, weight: on ? 700 : 500, color: col, anchor: 'middle' });
  });
  return s;
}
function statusbar(ox, oy, w, accent) {
  return `${txt(ox + 22, oy + 30, '9:41', { size: 15, weight: 700, color: C.ink })}
    <g transform="translate(${ox + w - 92},${oy + 18})">
      ${rrect(0, 4, 18, 11, 2, { fill: C.ink })}${rrect(22, 4, 18, 11, 2, { fill: C.ink })}
      ${rrect(46, 2, 24, 13, 3, { fill: 'none', stroke: C.ink, sw: 1.5 })}${rrect(49, 5, 16, 7, 1, { fill: C.ink })}
    </g>`;
}

// ===== TELA 1: Dashboard =====
function scrDashboard(ox, oy, w, h) {
  const P = 22, gap = 14, cw = (w - P * 2 - gap) / 2, ch = 92;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w, C.cyan);
  // header
  s += droplet(ox + P + 18, oy + 78, 22);
  s += txt(ox + P + 44, oy + 74, 'Olá, Almir', { size: 19, weight: 800 });
  s += txt(ox + P + 44, oy + 94, 'Junho de 2026', { size: 13, color: C.muted });
  s += rrect(ox + w - P - 112, oy + 60, 112, 34, 17, { fill: C.amberBg });
  s += chip(ox + w - P - 104, oy + 64, 26, 'transparent', G.crown(C.amberInk));
  s += txt(ox + w - P - 74, oy + 82, 'Premium', { size: 14, weight: 700, color: C.amberInk });
  // KPIs
  const c1 = (gx, gy) => chip(gx, gy, 30, '#cffafe', G.drop(C.cyan));
  const c2 = (gx, gy) => chip(gx, gy, 30, C.greenBg, G.trend(C.green));
  const c3 = (gx, gy) => chip(gx, gy, 30, '#fee2e2', G.wallet(C.red));
  const c4 = (gx, gy) => chip(gx, gy, 30, '#ffedd5', G.wallet(C.orange));
  let ky = oy + 118;
  s += kpi(ox + P, ky, cw, ch, c1, '128', 'Lavagens no mês');
  s += kpi(ox + P + cw + gap, ky, cw, ch, c2, 'R$ 8.420', 'Receita do mês');
  ky += ch + gap;
  s += kpi(ox + P, ky, cw, ch, c1, '9', 'Lavagens hoje');
  s += kpi(ox + P + cw + gap, ky, cw, ch, c3, 'R$ 640', 'A receber');
  ky += ch + gap;
  s += kpi(ox + P, ky, cw, ch, c4, 'R$ 1.150', 'Despesas (mês)');
  s += kpi(ox + P + cw + gap, ky, cw, ch, c2, 'R$ 720', 'Receita hoje');
  ky += ch + gap + 8;
  s += txt(ox + P, ky, 'Atalhos', { size: 14, weight: 700, color: C.muted });
  ky += 14;
  const shorts = [
    [G.bars(C.cyan), 'Relatórios'], [G.phone(C.cyan), 'Recuperação'],
    [G.user(C.cyan), 'Colaboradores'], [G.truck(C.cyan), 'Tele-busca'],
  ];
  shorts.forEach((it, i) => {
    const gx = ox + P + (i % 2) * (cw + gap);
    const gy = ky + Math.floor(i / 2) * (78 + gap);
    s += rrect(gx, gy, cw, 78, 18, { fill: C.card, stroke: C.line, sw: 1 });
    s += chip(gx + cw / 2 - 16, gy + 14, 32, '#ecfeff', it[0]);
    s += txt(gx + cw / 2, gy + 66, it[1], { size: 13, weight: 700, anchor: 'middle' });
  });
  // próximos agendamentos
  let uy = ky + 2 * (78 + gap) + 18;
  s += txt(ox + P, uy, 'Próximos agendamentos', { size: 14, weight: 700, color: C.muted });
  uy += 14;
  const up = [['Carlos Mendes', 'Onix • Lavagem completa', 'Hoje, 14:30'], ['Ana Souza', 'HB20 • Lavagem + cera', 'Hoje, 16:00'], ['Marcos Lima', 'Strada • Simples', 'Amanhã, 09:00']];
  up.forEach((u) => {
    s += rrect(ox + P, uy, w - P * 2, 72, 16, { fill: C.card, stroke: C.line, sw: 1 });
    s += chip(ox + P + 14, uy + 18, 36, '#ecfeff', G.clock(C.cyan));
    s += txt(ox + P + 62, uy + 30, u[0], { size: 15, weight: 800 });
    s += txt(ox + P + 62, uy + 50, u[1], { size: 13, color: C.muted });
    s += txt(ox + w - P - 16, uy + 30, u[2], { size: 13, weight: 700, color: C.cyan, anchor: 'end' });
    uy += 72 + 12;
  });
  s += tabbar(ox, oy, w, h, 0);
  return s;
}

// ===== TELA 2: Lavagens =====
function scrWashes(ox, oy, w, h) {
  const P = 22;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w);
  s += txt(ox + P, oy + 78, 'Lavagens', { size: 24, weight: 800 });
  // botão nova lavagem
  s += rrect(ox + P, oy + 100, w - P * 2, 50, 14, { fill: C.cyan });
  s += txt(ox + w / 2, oy + 131, '+  Nova lavagem', { size: 17, weight: 800, color: '#fff', anchor: 'middle' });
  const rows = [
    ['Carlos Mendes', 'Onix • ABC1D23', 'Lavagem completa', 'R$ 70', 'Pago', C.green, C.greenBg],
    ['Ana Souza', 'HB20 • XYZ9K88', 'Lavagem + cera', 'R$ 90', 'Pendente', C.amberInk, C.amberBg],
    ['Marcos Lima', 'Strada • QWE4R56', 'Simples', 'R$ 45', 'Pago', C.green, C.greenBg],
    ['Júlia Alves', 'Corolla • POI8U77', 'Detalhada', 'R$ 160', 'Pago', C.green, C.greenBg],
    ['Pedro Rocha', 'Civic • LKJ3H22', 'Lavagem + cera', 'R$ 90', 'Pendente', C.amberInk, C.amberBg],
  ];
  let y = oy + 168;
  rows.forEach((r) => {
    s += rrect(ox + P, y, w - P * 2, 86, 16, { fill: C.card, stroke: C.line, sw: 1 });
    s += chip(ox + P + 14, y + 16, 36, '#cffafe', G.drop(C.cyan));
    s += txt(ox + P + 62, y + 30, r[0], { size: 16, weight: 800 });
    s += txt(ox + P + 62, y + 50, r[1], { size: 13, color: C.muted });
    s += txt(ox + P + 62, y + 70, r[2], { size: 13, color: C.cyan, weight: 700 });
    s += txt(ox + w - P - 16, y + 34, r[3], { size: 18, weight: 800, anchor: 'end' });
    s += badge(ox + w - P - 16 - (r[4].length * 7.4 + 22), y + 50, r[4], r[5], r[6]);
    y += 86 + 12;
  });
  s += tabbar(ox, oy, w, h, 1);
  return s;
}

// ===== TELA 3: Clientes / CRM =====
function scrClients(ox, oy, w, h) {
  const P = 22;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w);
  s += txt(ox + P, oy + 78, 'Clientes', { size: 24, weight: 800 });
  s += rrect(ox + P, oy + 98, w - P * 2, 48, 14, { fill: C.card, stroke: C.line, sw: 1 });
  s += chip(ox + P + 10, oy + 108, 28, 'transparent', G.search(C.muted));
  s += txt(ox + P + 46, oy + 128, 'Buscar cliente, placa ou telefone', { size: 14, color: C.muted });
  // destaque recuperação
  s += rrect(ox + P, oy + 158, w - P * 2, 64, 16, { fill: '#ecfeff', stroke: '#a5f3fc', sw: 1 });
  s += chip(ox + P + 14, oy + 172, 36, C.cyan, G.phone('#fff'));
  s += txt(ox + P + 62, oy + 184, '6 clientes sumidos há +30 dias', { size: 15, weight: 800, color: C.brand });
  s += txt(ox + P + 62, oy + 204, 'Toque para chamar e recuperar', { size: 13, color: C.cyan, weight: 700 });
  const rows = [
    ['Carlos Mendes', '(54) 99999-1234', '2 veículos', 'há 5 dias'],
    ['Ana Souza', '(54) 98888-4321', '1 veículo', 'há 12 dias'],
    ['Marcos Lima', '(54) 99777-7788', '3 veículos', 'há 1 dia'],
    ['Júlia Alves', '(54) 99666-1010', '1 veículo', 'há 20 dias'],
    ['Pedro Rocha', '(54) 99555-2020', '2 veículos', 'há 40 dias'],
  ];
  let y = oy + 236;
  rows.forEach((r) => {
    s += rrect(ox + P, y, w - P * 2, 78, 16, { fill: C.card, stroke: C.line, sw: 1 });
    s += `<circle cx="${ox + P + 36}" cy="${y + 39}" r="22" fill="#e0f2fe"/>`;
    s += txt(ox + P + 36, y + 45, r[0].split(' ').map(p=>p[0]).slice(0,2).join(''), { size: 16, weight: 800, color: C.cyan, anchor: 'middle' });
    s += txt(ox + P + 70, y + 32, r[0], { size: 16, weight: 800 });
    s += txt(ox + P + 70, y + 54, r[1] + '  •  ' + r[2], { size: 13, color: C.muted });
    s += txt(ox + w - P - 16, y + 32, r[3], { size: 12, color: C.muted, anchor: 'end' });
    y += 78 + 12;
  });
  s += tabbar(ox, oy, w, h, 2);
  return s;
}

// ===== TELA 4: Agenda =====
function scrSchedule(ox, oy, w, h) {
  const P = 22;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w);
  s += txt(ox + P, oy + 78, 'Agenda', { size: 24, weight: 800 });
  // chips de dias
  const days = [['SEG', '23'], ['TER', '24'], ['QUA', '25'], ['QUI', '26'], ['SEX', '27']];
  const dw = (w - P * 2 - 4 * 10) / 5;
  days.forEach((d, i) => {
    const gx = ox + P + i * (dw + 10);
    const active = i === 4;
    s += rrect(gx, oy + 100, dw, 64, 14, { fill: active ? C.cyan : C.card, stroke: active ? 'none' : C.line, sw: 1 });
    s += txt(gx + dw / 2, oy + 124, d[0], { size: 12, weight: 700, anchor: 'middle', color: active ? '#cffafe' : C.muted });
    s += txt(gx + dw / 2, oy + 150, d[1], { size: 20, weight: 800, anchor: 'middle', color: active ? '#fff' : C.ink });
  });
  s += txt(ox + P, oy + 196, 'Sexta, 27 de junho', { size: 14, weight: 700, color: C.muted });
  const rows = [
    ['08:30', 'Carlos Mendes', 'Onix • Lavagem completa', C.cyan],
    ['10:00', 'Ana Souza', 'HB20 • Lavagem + cera', C.green],
    ['13:30', 'Marcos Lima', 'Strada • Simples', C.amber],
    ['15:00', 'Júlia Alves', 'Corolla • Detalhada', C.cyan],
    ['16:30', 'Pedro Rocha', 'Civic • Lavagem + cera', C.green],
  ];
  let y = oy + 214;
  rows.forEach((r) => {
    s += rrect(ox + P, y, w - P * 2, 78, 16, { fill: C.card, stroke: C.line, sw: 1 });
    s += rrect(ox + P, y, 6, 78, 3, { fill: r[3] });
    s += chip(ox + P + 18, y + 22, 34, '#ecfeff', G.clock(C.cyan));
    s += txt(ox + P + 64, y + 34, r[0] + '  ' + r[1], { size: 16, weight: 800 });
    s += txt(ox + P + 64, y + 56, r[2], { size: 13, color: C.muted });
    y += 78 + 12;
  });
  s += tabbar(ox, oy, w, h, 3);
  return s;
}

// ===== TELA 5: Relatórios =====
function scrReports(ox, oy, w, h) {
  const P = 22;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w);
  s += txt(ox + P, oy + 78, 'Relatórios', { size: 24, weight: 800 });
  // card gráfico
  const chX = ox + P, chY = oy + 100, chW = w - P * 2, chH = 250;
  s += rrect(chX, chY, chW, chH, 18, { fill: C.card, stroke: C.line, sw: 1 });
  s += txt(chX + 18, chY + 30, 'Faturamento (últimos 6 meses)', { size: 14, weight: 700, color: C.muted });
  const data = [4200, 5100, 4800, 6300, 7400, 8420];
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const max = 9000, baseY = chY + chH - 40, barMax = 150, bw = 34;
  const slot = (chW - 36) / data.length;
  data.forEach((v, i) => {
    const bh = (v / max) * barMax;
    const bx = chX + 26 + i * slot + (slot - bw) / 2;
    const last = i === data.length - 1;
    s += rrect(bx, baseY - bh, bw, bh, 8, { fill: last ? C.cyan : '#bae6fd' });
    s += txt(bx + bw / 2, baseY + 20, labels[i], { size: 12, color: C.muted, anchor: 'middle' });
    if (last) s += txt(bx + bw / 2, baseY - bh - 8, '8,4k', { size: 12, weight: 800, color: C.cyan, anchor: 'middle' });
  });
  // KPIs resumo
  const gap = 14, cw = (w - P * 2 - gap) / 2;
  let ky = chY + chH + 16;
  s += kpi(ox + P, ky, cw, 88, (gx, gy) => chip(gx, gy, 30, C.greenBg, G.trend(C.green)), '+24%', 'vs. mês anterior');
  s += kpi(ox + P + cw + gap, ky, cw, 88, (gx, gy) => chip(gx, gy, 30, '#cffafe', G.drop(C.cyan)), 'R$ 66', 'Ticket médio');
  ky += 88 + 16;
  s += txt(ox + P, ky, 'Serviços mais vendidos', { size: 14, weight: 700, color: C.muted });
  ky += 14;
  const serv = [['Lavagem completa', 'R$ 3.150', 0.92], ['Lavagem + cera', 'R$ 2.430', 0.70], ['Detalhada', 'R$ 1.840', 0.52]];
  serv.forEach((sv) => {
    s += rrect(ox + P, ky, w - P * 2, 56, 14, { fill: C.card, stroke: C.line, sw: 1 });
    s += txt(ox + P + 16, ky + 24, sv[0], { size: 14, weight: 700 });
    s += txt(ox + w - P - 16, ky + 24, sv[1], { size: 14, weight: 800, color: C.green, anchor: 'end' });
    s += rrect(ox + P + 16, ky + 36, w - P * 2 - 32, 8, 4, { fill: '#e2e8f0' });
    s += rrect(ox + P + 16, ky + 36, (w - P * 2 - 32) * sv[2], 8, 4, { fill: C.cyan });
    ky += 56 + 10;
  });
  s += tabbar(ox, oy, w, h, 4);
  return s;
}

// ===== TELA 6: Tele-busca =====
function scrPickup(ox, oy, w, h) {
  const P = 22;
  let s = rrect(ox, oy, w, h, 0, { fill: C.bg });
  s += statusbar(ox, oy, w);
  s += txt(ox + P, oy + 78, 'Tele-busca', { size: 24, weight: 800 });
  s += txt(ox + P, oy + 100, 'Leva e traz organizado', { size: 14, color: C.muted });
  // "mapa"
  const mY = oy + 116, mH = 200;
  s += rrect(ox + P, mY, w - P * 2, mH, 18, { fill: '#e0f2fe' });
  s += `<path d="M${ox+P+20},${mY+150} C${ox+P+120},${mY+60} ${ox+w-P-160},${mY+200} ${ox+w-P-30},${mY+50}" fill="none" stroke="${C.cyan}" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>`;
  s += chip(ox + P + 8, mY + 128, 30, C.brand, G.pin('#fff'));
  s += chip(ox + w - P - 46, mY + 28, 30, C.cyan, G.truck('#fff'));
  s += rrect(ox + P + 14, mY + 14, 150, 28, 14, { fill: '#fff' });
  s += txt(ox + P + 26, mY + 32, '3 coletas hoje', { size: 13, weight: 700, color: C.brand });
  const rows = [
    ['Carlos Mendes', 'Rua das Flores, 120', 'A caminho', C.cyan, '#cffafe'],
    ['Ana Souza', 'Av. Brasil, 880', 'Coletado', C.amberInk, C.amberBg],
    ['Marcos Lima', 'Rua XV, 45', 'Entregue', C.green, C.greenBg],
  ];
  let y = mY + mH + 16;
  rows.forEach((r) => {
    s += rrect(ox + P, y, w - P * 2, 84, 16, { fill: C.card, stroke: C.line, sw: 1 });
    s += chip(ox + P + 14, y + 16, 36, '#ecfeff', G.truck(C.cyan));
    s += txt(ox + P + 62, y + 32, r[0], { size: 16, weight: 800 });
    s += txt(ox + P + 62, y + 54, r[1], { size: 13, color: C.muted });
    s += badge(ox + w - P - 16 - (r[2].length * 7.4 + 22), y + 30, r[2], r[3], r[4]);
    y += 84 + 12;
  });
  s += rrect(ox + P, y + 4, w - P * 2, 50, 14, { fill: C.cyan });
  s += txt(ox + w / 2, y + 35, '+  Nova coleta', { size: 17, weight: 800, color: '#fff', anchor: 'middle' });
  s += tabbar(ox, oy, w, h, 4);
  return s;
}

// ---------- moldura de celular ----------
function phone(ox, oy, scrFn) {
  const iw = 520, ih = 1100, bz = 24;
  const ow = iw + bz * 2, oh = ih + bz * 2;
  const id = 'clip' + Math.random().toString(36).slice(2);
  return `
  <g>
    <rect x="${ox - 6}" y="${oy + 14}" width="${ow + 12}" height="${oh}" rx="84" fill="#000" opacity="0.22"/>
    ${rrect(ox, oy, ow, oh, 80, { fill: '#0b1220' })}
    <defs><clipPath id="${id}"><rect x="${ox + bz}" y="${oy + bz}" width="${iw}" height="${ih}" rx="60"/></clipPath></defs>
    <g clip-path="url(#${id})">${scrFn(ox + bz, oy + bz, iw, ih)}</g>
    <rect x="${ox + ow / 2 - 60}" y="${oy + bz + 6}" width="120" height="30" rx="15" fill="#0b1220"/>
  </g>`;
}

// ---------- composição de screenshot 1080x1920 ----------
function screenshot({ file, top, bot, head, sub, scrFn }) {
  const W = 1080, H = 1920;
  const px = (W - 568) / 2, py = 560;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="${W - 120}" cy="200" r="260" fill="#ffffff" opacity="0.06"/>
    <circle cx="120" cy="${H - 200}" r="320" fill="#ffffff" opacity="0.05"/>
    ${droplet(96, 150, 46)}
    ${txt(170, 150, 'Meu Lava Rápido', { size: 34, weight: 800, color: '#fff' })}
    ${head.map((l, i) => txt(72, 280 + i * 78, l, { size: 64, weight: 800, color: '#fff' })).join('')}
    ${txt(72, 280 + head.length * 78 + 18, sub, { size: 32, color: '#ffffff', opacity: 0.92 })}
    ${phone(px, py, scrFn)}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT, file));
}

// ---------- ícone 512 ----------
async function buildIcon() {
  const S = 512;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="${C.brand}"/>
    ${droplet(S / 2, S / 2 + 26, 170)}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'icon-512.png'));
}

// ---------- feature graphic 1024x500 ----------
async function buildFeature() {
  const W = 1024, Hh = 500;
  const bullets = ['Lavagens e caixa', 'Clientes e agenda', 'Relatórios de lucro'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">
    <defs><linearGradient id="fg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.brand}"/><stop offset="1" stop-color="${C.brand700}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${Hh}" fill="url(#fg)"/>
    <circle cx="${W - 80}" cy="60" r="220" fill="#ffffff" opacity="0.05"/>
    <circle cx="60" cy="${Hh - 40}" r="180" fill="#ffffff" opacity="0.05"/>
    ${droplet(96, 96, 56)}
    ${txt(168, 86, 'Meu Lava', { size: 46, weight: 800, color: '#fff' })}
    ${txt(168, 132, 'Rápido', { size: 46, weight: 800, color: C.light })}
    ${txt(60, 250, 'A gestão completa do', { size: 50, weight: 800, color: '#fff' })}
    ${txt(60, 312, 'seu lava-rápido', { size: 50, weight: 800, color: '#fff' })}
    ${bullets.map((b, i) => `
      <g transform="translate(60,${360 + i * 46})">
        <circle cx="14" cy="-6" r="14" fill="${C.cyan2}"/>
        ${stroke('M8,-6 L12,-2 L20,-11', '#fff', 3)}
        ${txt(40, 0, b, { size: 26, color: '#e2f4fb', weight: 600 })}
      </g>`).join('')}
    <g transform="translate(700,118) scale(0.34)">
      ${phone(0, 0, scrDashboard)}
    </g>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'feature-graphic.png'));
}

(async () => {
  await buildIcon();
  await buildFeature();
  const shots = [
    { file: 'screenshot-01-dashboard.png', top: '#0E6B8F', bot: '#0B4F6C', head: ['Seu lava-rápido', 'na palma da mão'], sub: 'Faturamento, lavagens e caixa em tempo real', scrFn: scrDashboard },
    { file: 'screenshot-02-lavagens.png', top: '#0891b2', bot: '#0B4F6C', head: ['Registre lavagens', 'em segundos'], sub: 'Serviço, valor e status de pagamento num toque', scrFn: scrWashes },
    { file: 'screenshot-03-clientes.png', top: '#0e7490', bot: '#0B4F6C', head: ['Conheça e recupere', 'seus clientes'], sub: 'CRM com histórico e clientes sumidos', scrFn: scrClients },
    { file: 'screenshot-04-agenda.png', top: '#0E6B8F', bot: '#075985', head: ['Nunca perca um', 'agendamento'], sub: 'Agenda do dia com lembretes automáticos', scrFn: scrSchedule },
    { file: 'screenshot-05-relatorios.png', top: '#0891b2', bot: '#0c4a6e', head: ['Saiba quanto você', 'fatura de verdade'], sub: 'Relatórios de receita, lucro e ticket médio', scrFn: scrReports },
    { file: 'screenshot-06-telebusca.png', top: '#0e7490', bot: '#0B4F6C', head: ['Leva e traz', 'sob controle'], sub: 'Organize coletas e entregas da tele-busca', scrFn: scrPickup },
  ];
  for (const s of shots) await screenshot(s);
  console.log('OK: artes geradas em', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
