import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Decode a WOFF 1.0 font buffer into a raw TrueType/OpenType SFNT buffer
 * so @resvg/resvg-js can render @fontsource Inter & JetBrains Mono directly.
 */
function woffToSfnt(woffBuf) {
  if (woffBuf.readUInt32BE(0) !== 0x774f4646) {
    return woffBuf;
  }
  const flavor = woffBuf.readUInt32BE(4);
  const numTables = woffBuf.readUInt16BE(12);

  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= numTables) {
    searchRange *= 2;
    entrySelector += 1;
  }
  searchRange *= 16;
  const rangeShift = numTables * 16 - searchRange;

  const headerSize = 12 + numTables * 16;
  const tables = [];
  let offsetOut = headerSize;

  for (let i = 0; i < numTables; i++) {
    const dirOffset = 44 + i * 20;
    const tag = woffBuf.subarray(dirOffset, dirOffset + 4);
    const offset = woffBuf.readUInt32BE(dirOffset + 4);
    const compLength = woffBuf.readUInt32BE(dirOffset + 8);
    const origLength = woffBuf.readUInt32BE(dirOffset + 12);
    const origChecksum = woffBuf.readUInt32BE(dirOffset + 16);

    const compData = woffBuf.subarray(offset, offset + compLength);
    const rawData = compLength < origLength ? zlib.inflateSync(compData) : compData;
    const paddedLen = (rawData.length + 3) & ~3;
    const padded = Buffer.alloc(paddedLen);
    rawData.copy(padded);

    tables.push({ tag, checksum: origChecksum, outOffset: offsetOut, length: origLength, data: padded });
    offsetOut += paddedLen;
  }

  const out = Buffer.alloc(offsetOut);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(rangeShift, 10);

  tables.forEach((t, idx) => {
    const rec = 12 + idx * 16;
    t.tag.copy(out, rec);
    out.writeUInt32BE(t.checksum, rec + 4);
    out.writeUInt32BE(t.outOffset, rec + 8);
    out.writeUInt32BE(t.length, rec + 12);
    t.data.copy(out, t.outOffset);
  });

  return out;
}

function loadFontBuffers() {
  const woffPaths = [
    'node_modules/@fontsource/inter/files/inter-cyrillic-700-normal.woff',
    'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff',
    'node_modules/@fontsource/inter/files/inter-cyrillic-400-normal.woff',
    'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff',
    'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-cyrillic-500-normal.woff',
    'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff'
  ];

  const buffers = [];
  for (const rel of woffPaths) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) {
      buffers.push(woffToSfnt(fs.readFileSync(full)));
    }
  }
  return buffers;
}

function buildOgSvg({ badge, line1, line2, line3, sub, statLabel, ctaText }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="28%" cy="8%" r="72%">
      <stop offset="0%" stop-color="#5E6AD2" stop-opacity="0.34"/>
      <stop offset="60%" stop-color="#5E6AD2" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#08090A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1A1D2B"/>
      <stop offset="100%" stop-color="#0F1011"/>
    </linearGradient>
    <linearGradient id="clipBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22263A"/>
      <stop offset="100%" stop-color="#11131A"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#08090A"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Subtle outer frame -->
  <rect x="28" y="28" width="1144" height="574" rx="24" fill="none" stroke="#FFFFFF" stroke-opacity="0.08"/>

  <!-- Brand header -->
  <g transform="translate(72, 74)">
    <rect x="0" y="0" width="46" height="46" rx="12" fill="#0F1011" stroke="#FFFFFF" stroke-opacity="0.18"/>
    <text x="23" y="31" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="25" font-weight="700" fill="#8B93F8">K</text>
    <text x="62" y="31" font-family="Inter, DejaVu Sans, sans-serif" font-size="26" font-weight="600" fill="#EDEDEF">KoShorts</text>

    <rect x="210" y="6" width="356" height="34" rx="17" fill="#5E6AD2" fill-opacity="0.14" stroke="#8B93F8" stroke-opacity="0.35"/>
    <text x="388" y="28" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="14" font-weight="500" fill="#8B93F8">${badge}</text>
  </g>

  <!-- Main headline -->
  <g transform="translate(72, 198)">
    <text x="0" y="0" font-family="Inter, DejaVu Sans, sans-serif" font-size="52" font-weight="700" fill="#EDEDEF">${line1}</text>
    <text x="0" y="64" font-family="Inter, DejaVu Sans, sans-serif" font-size="52" font-weight="700" fill="#EDEDEF">${line2}</text>
    <text x="0" y="128" font-family="Inter, DejaVu Sans, sans-serif" font-size="52" font-weight="700" fill="#8A8F98">${line3}</text>
    <text x="0" y="188" font-family="Inter, DejaVu Sans, sans-serif" font-size="22" font-weight="400" fill="#8A8F98">${sub}</text>
  </g>

  <!-- Bottom CTA + stats -->
  <g transform="translate(72, 476)">
    <rect x="0" y="0" width="292" height="58" rx="14" fill="#5E6AD2"/>
    <text x="146" y="36" text-anchor="middle" font-family="Inter, DejaVu Sans, sans-serif" font-size="19" font-weight="600" fill="#FFFFFF">${ctaText}</text>

    <rect x="314" y="0" width="318" height="58" rx="14" fill="#0F1011" stroke="#34D399" stroke-opacity="0.38"/>
    <text x="336" y="36" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="22" font-weight="500" fill="#34D399">+248K</text>
    <text x="420" y="35" font-family="Inter, DejaVu Sans, sans-serif" font-size="16" font-weight="400" fill="#8A8F98">${statLabel}</text>
  </g>

  <!-- Right-side 3 vertical 9:16 Shorts preview cards -->
  <g transform="translate(724, 108)">
    <!-- Back left card -->
    <g transform="translate(0, 38)">
      <rect width="118" height="218" rx="14" fill="url(#clipBg)" stroke="#FFFFFF" stroke-opacity="0.14"/>
      <circle cx="59" cy="96" r="20" fill="#08090A" fill-opacity="0.65" stroke="#FFFFFF" stroke-opacity="0.28"/>
      <polygon points="54,87 54,105 69,96" fill="#FFFFFF"/>
      <rect x="16" y="156" width="86" height="12" rx="4" fill="#FACC15"/>
      <rect x="24" y="174" width="70" height="10" rx="4" fill="#FFFFFF" fill-opacity="0.5"/>
      <text x="59" y="204" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="11.5" font-weight="500" fill="#8B93F8">0:30 · 5.6K</text>
    </g>

    <!-- Back right card -->
    <g transform="translate(286, 38)">
      <rect width="118" height="218" rx="14" fill="url(#clipBg)" stroke="#FFFFFF" stroke-opacity="0.14"/>
      <circle cx="59" cy="96" r="20" fill="#08090A" fill-opacity="0.65" stroke="#FFFFFF" stroke-opacity="0.28"/>
      <polygon points="54,87 54,105 69,96" fill="#FFFFFF"/>
      <rect x="16" y="156" width="86" height="12" rx="4" fill="#38BDF8"/>
      <rect x="24" y="174" width="70" height="10" rx="4" fill="#FFFFFF" fill-opacity="0.5"/>
      <text x="59" y="204" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="11.5" font-weight="500" fill="#8B93F8">0:48 · 11.6K</text>
    </g>

    <!-- Center hero 9:16 Short card -->
    <g transform="translate(122, 0)">
      <rect width="160" height="284" rx="18" fill="url(#cardGrad)" stroke="#8B93F8" stroke-opacity="0.6" stroke-width="2"/>
      <rect x="16" y="16" width="54" height="22" rx="6" fill="#5E6AD2" fill-opacity="0.35"/>
      <text x="43" y="31" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="12" font-weight="500" fill="#EDEDEF">9:16</text>
      <circle cx="80" cy="122" r="28" fill="#5E6AD2"/>
      <polygon points="73,110 73,134 93,122" fill="#FFFFFF"/>
      <!-- Hormozi-style highlighted word-by-word subtitle bars -->
      <rect x="20" y="188" width="56" height="16" rx="5" fill="#5E6AD2"/>
      <rect x="82" y="188" width="58" height="16" rx="5" fill="#FFFFFF" fill-opacity="0.85"/>
      <rect x="32" y="210" width="96" height="14" rx="5" fill="#FFFFFF" fill-opacity="0.45"/>
      <text x="80" y="258" text-anchor="middle" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="14" font-weight="500" fill="#8B93F8">0:31 · 230K</text>
    </g>

    <!-- Telegram mini status pill below cards -->
    <g transform="translate(36, 316)">
      <rect width="332" height="88" rx="14" fill="#182533" stroke="#FFFFFF" stroke-opacity="0.1"/>
      <text x="20" y="34" font-family="Inter, DejaVu Sans, sans-serif" font-size="16" font-weight="700" fill="#EDEDEF">@remtex_shorts_ai_bot</text>
      <text x="20" y="62" font-family="JetBrains Mono, DejaVu Sans Mono, monospace" font-size="13" font-weight="500" fill="#8B93F8">10 free · 9:16 · RU / EN</text>
    </g>
  </g>
</svg>`;
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="16" fill="#0F1011" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2"/>
  <path d="M21 17h6.5v13.2L39.6 17H47L34.3 30.6 47.8 47H40l-10.2-12.7-2.3 2.5V47H21V17z" fill="#8B93F8"/>
</svg>
`;

const appleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#0F1011"/>
  <rect x="10" y="10" width="160" height="160" rx="38" fill="#151617" stroke="#8B93F8" stroke-opacity="0.35" stroke-width="3"/>
  <path d="M58 46h18.5v37.5L111 46h21L95.8 84.8 134 134h-22L83 97.8l-6.5 7V134H58V46z" fill="#8B93F8"/>
</svg>`;

const fontBuffers = loadFontBuffers();
const tmpFontDir = path.join(ROOT, 'node_modules', '.cache-koshorts-fonts');
fs.mkdirSync(tmpFontDir, { recursive: true });
const fontFiles = fontBuffers.map((buf, i) => {
  const fp = path.join(tmpFontDir, `font-${i}.ttf`);
  fs.writeFileSync(fp, buf);
  return fp;
});

function renderSvgToPng(svg, outPath) {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles,
      loadSystemFonts: true,
      defaultFontFamily: 'Inter'
    }
  });
  const pngBuffer = resvg.render().asPng();
  fs.writeFileSync(outPath, pngBuffer);
}

fs.writeFileSync(path.join(ROOT, 'favicon.svg'), faviconSvg, 'utf8');

renderSvgToPng(appleIconSvg, path.join(ROOT, 'apple-touch-icon.png'));

renderSvgToPng(
  buildOgSvg({
    badge: '12 ИЗ 50 МЕСТ −22% · 10 ВИДЕО БЕСПЛАТНО',
    line1: 'Из 1 длинного видео —',
    line2: '3 вирусных Shorts.',
    line3: 'За 6 минут в Telegram.',
    sub: 'Пословные субтитры · 9:16 · Автопубликация в YouTube',
    statLabel: 'просмотров с 1 ролика',
    ctaText: 'Нарезать бесплатно'
  }),
  path.join(ROOT, 'og.png')
);

renderSvgToPng(
  buildOgSvg({
    badge: '12 OF 50 SPOTS −22% · 10 FREE VIDEOS',
    line1: '1 Long Video Into',
    line2: '3 Viral Shorts.',
    line3: '6 Minutes in Telegram.',
    sub: 'Word-by-word captions · 9:16 · Direct YouTube publish',
    statLabel: 'views from 1 video',
    ctaText: 'Cut Free in Telegram'
  }),
  path.join(ROOT, 'og-en.png')
);

console.log('Generated favicon.svg, apple-touch-icon.png, og.png, og-en.png');
