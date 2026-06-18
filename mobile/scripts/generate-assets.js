// Gera os PNGs de ícone/splash do app SEM dependências externas (apenas zlib nativo).
// Desenha a logomarca (gota d'água + carro sedan) pixel a pixel.
// Rode:  node scripts/generate-assets.js
// Para ícones finais de alta qualidade, exporte assets/logo.svg em um editor.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#0B4F6C');
const DROP_TOP = hex('#22d3ee');
const DROP_BOT = hex('#0891b2');
const WHITE = [255, 255, 255];
const DARK = hex('#0B4F6C');
const WIND = hex('#a5f3fc');
const LIGHT = hex('#fde68a');

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const CRC_TABLE = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

function drawLogo(size, transparentBg) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size / 100;
  const set = (x, y, [r, g, b], a = 255) => {
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const inCircle = (x, y, cx, cy, r) => (x - cx * S) ** 2 + (y - cy * S) ** 2 <= (r * S) ** 2;
  const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx * S) / (rx * S)) ** 2 + ((y - cy * S) / (ry * S)) ** 2 <= 1;
  const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
    x0 *= S; y0 *= S; x1 *= S; y1 *= S; r *= S;
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    if (x >= x0 + r && x <= x1 - r) return true;
    if (y >= y0 + r && y <= y1 - r) return true;
    const cx = x < x0 + r ? x0 + r : x1 - r;
    const cy = y < y0 + r ? y0 + r : y1 - r;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  const dropCx = 50 * S, dropCy = 62 * S, dropR = 30 * S, dropH = 56 * S;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      set(x, y, BG, transparentBg ? 0 : 255);

      // gota
      const dx = x - dropCx, dy = y - dropCy;
      let inDrop = false;
      if (dy >= 0) inDrop = dx * dx + dy * dy <= dropR * dropR;
      else { const t = (dropH + dy) / dropH; if (t >= 0) inDrop = Math.abs(dx) <= dropR * t; }

      if (inDrop) {
        const tcol = Math.max(0, Math.min(1, (y - (dropCy - dropH)) / (dropH + dropR)));
        let col = mix(DROP_TOP, DROP_BOT, tcol);
        // brilho da água
        if (inEllipse(x, y, 39, 40, 6, 11)) col = mix(col, WHITE, 0.22);
        if (inCircle(x, y, 34, 30, 2.4)) col = mix(col, WHITE, 0.5);
        set(x, y, col, 255);

        // carro
        if (inEllipse(x, y, 50, 60, 11, 10.5) && y <= 60 * S) set(x, y, WHITE, 255);          // cabine
        if (inEllipse(x, y, 50, 59, 7, 6) && y <= 59 * S) set(x, y, WIND, 255);               // para-brisa
        if (inRoundRect(x, y, 24, 60, 76, 72, 4)) set(x, y, WHITE, 255);                       // corpo
        if (inCircle(x, y, 72, 65, 1.7)) set(x, y, LIGHT, 255);                                // farol
        for (const wcx of [37, 63]) {                                                          // rodas
          if (inCircle(x, y, wcx, 72, 5)) set(x, y, DARK, 255);
          if (inCircle(x, y, wcx, 72, 2)) set(x, y, WHITE, 255);
        }
      }
      // bolhas (fora do corpo do carro)
      if (inDrop && inCircle(x, y, 26, 44, 3.4)) set(x, y, WHITE, 255);
      if (inDrop && inCircle(x, y, 74, 48, 2.6)) set(x, y, WHITE, 255);
    }
  }
  return buf;
}

function save(name, size, transparent) {
  fs.writeFileSync(path.join(OUT, name), encodePNG(size, size, drawLogo(size, transparent)));
  console.log('  ✓', name, `${size}x${size}`);
}

console.log('Gerando assets em', OUT);
save('icon.png', 1024, false);
save('adaptive-icon.png', 1024, true);
save('splash-icon.png', 1024, false);
save('favicon.png', 64, false);
console.log('Pronto. (Para máxima nitidez, exporte assets/logo.svg em alta resolução e substitua.)');
