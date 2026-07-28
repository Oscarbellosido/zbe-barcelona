// Genera les icones de l'app (PNG) sense dependències externes, escrivint
// el format PNG a mà (IHDR/IDAT/IEND) amb zlib per comprimir els píxels.
// Dibuixa un cercle taronja (estil "ull de càmera") sobre fons fosc, als
// mides que calen per a Android/iOS/Windows (manifest, apple-touch-icon,
// favicon).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = makeCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // sense filtre
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdrData),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BG = hex('#1b1f24');
const ORANGE = hex('#f9ab00');
const WHITE = [255, 255, 255];

function drawIcon(size, { padded } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  // amb "padded" (maskable) deixem més marge perquè Android no talli el disseny
  const rOuter = size * (padded ? 0.30 : 0.36);
  const rInner = size * (padded ? 0.13 : 0.16);
  const rHighlight = size * (padded ? 0.04 : 0.05);
  const hx = cx - rOuter * 0.35;
  const hy = cy - rOuter * 0.35;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dh = Math.sqrt((x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2);
      let color;
      if (dh < rHighlight) color = WHITE;
      else if (dist < rInner) color = BG;
      else if (dist < rOuter) color = ORANGE;
      else color = BG;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512, padded: true },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon.png', size: 32 },
];

for (const t of targets) {
  const png = buildPng(t.size, t.size, drawIcon(t.size, { padded: t.padded }));
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log(`Generat icons/${t.name} (${t.size}x${t.size})`);
}
