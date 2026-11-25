import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import '../assets/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

const ruHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const t = globalThis.KOSHORTS_I18N.en;

const dom = new JSDOM(ruHtml);
const doc = dom.window.document;

doc.documentElement.setAttribute('lang', 'en');
doc.title = t.meta_title;

const setAttr = (selector, attr, val) => {
  const el = doc.querySelector(selector);
  if (el) el.setAttribute(attr, val);
};

setAttr('meta[name="description"]', 'content', t.meta_desc);
setAttr('link[rel="canonical"]', 'href', 'https://koshorts.vercel.app/en/');
setAttr('meta[property="og:title"]', 'content', t.og_title);
setAttr('meta[property="og:description"]', 'content', t.og_desc);
setAttr('meta[property="og:url"]', 'content', 'https://koshorts.vercel.app/en/');
setAttr('meta[property="og:image"]', 'content', t.og_image);
setAttr('meta[property="og:locale"]', 'content', 'en_US');
setAttr('meta[property="og:locale:alternate"]', 'content', 'ru_RU');
setAttr('meta[name="twitter:title"]', 'content', t.og_title);
setAttr('meta[name="twitter:description"]', 'content', t.og_desc);
setAttr('meta[name="twitter:image"]', 'content', t.og_image);

doc.querySelectorAll('[data-i18n]').forEach((el) => {
  const k = el.getAttribute('data-i18n');
  if (t[k] !== undefined) el.textContent = t[k];
});

doc.querySelectorAll('[data-i18n-aria]').forEach((el) => {
  const k = el.getAttribute('data-i18n-aria');
  if (t[k] !== undefined) el.setAttribute('aria-label', t[k]);
});

doc.querySelectorAll('.lang button[data-lang]').forEach((b) => {
  b.setAttribute('aria-pressed', b.getAttribute('data-lang') === 'en' ? 'true' : 'false');
});

doc.querySelectorAll('[data-legal-link]').forEach((a) => {
  const slug = a.getAttribute('data-legal-link');
  a.setAttribute('href', `/${slug}/?lang=en`);
});

const enHtml = dom.serialize();
const outDir = path.join(ROOT, 'en');
const outFile = path.join(outDir, 'index.html');

if (checkOnly) {
  const existing = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  if (existing !== enHtml) {
    console.error('en/index.html is out of sync with index.html and assets/i18n.js. Run: npm run sync');
    process.exit(1);
  }
  console.log('en/index.html is in sync.');
} else {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, enHtml, 'utf8');
  console.log('Synced en/index.html');
}
