import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const i18nCode = fs.readFileSync(path.join(ROOT, 'assets/i18n.js'), 'utf8');
const legalI18nCode = fs.readFileSync(path.join(ROOT, 'assets/legal-i18n.js'), 'utf8');
const appCode = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');

const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄєҐґ]/;
const RU_ONLY_LETTERS_RE = /[ыъэёЫЪЭЁ]/;

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  assert.equal(buf.readUInt32BE(0), 0x89504e47, `${path.basename(filePath)} must be a valid PNG`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20)
  };
}

const openDoms = [];
test.afterEach(() => {
  while (openDoms.length > 0) {
    openDoms.pop().window.close();
  }
});

function bootPage(relFile, { url = 'https://koshorts.vercel.app/', languages = ['ru-RU', 'ru'] } = {}) {
  const html = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  openDoms.push(dom);

  const { window } = dom;
  Object.defineProperty(window.navigator, 'languages', {
    value: languages,
    configurable: true
  });
  Object.defineProperty(window.navigator, 'language', {
    value: languages[0] || 'ru-RU',
    configurable: true
  });

  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  });

  if (window.HTMLCanvasElement) {
    window.HTMLCanvasElement.prototype.getContext = () => null;
  }

  // Polyfill HTMLDialogElement methods for JSDOM
  if (window.HTMLElement) {
    const dialog = window.document.getElementById('shorts-viewer');
    if (dialog) {
      dialog.open = false;
      dialog.showModal = function () {
        if (this.open) {
          throw new window.DOMException('Dialog already open', 'InvalidStateError');
        }
        this.open = true;
        this.setAttribute('open', '');
      };
      dialog.close = function () {
        this.open = false;
        this.removeAttribute('open');
        this.dispatchEvent(new window.Event('close'));
      };
    }
  }

  const isLegal = Boolean(window.document.body.getAttribute('data-legal-page'));
  window.eval(isLegal ? legalI18nCode : i18nCode);
  window.eval(appCode);
  return dom;
}

test('Static assets, OG images (og.png, og-uk.png, og-en.png at 1200x630), vercel.json, robots.txt, and sitemap.xml are valid', () => {
  assert.deepEqual(readPngDimensions(path.join(ROOT, 'og.png')), { width: 1200, height: 630 });
  assert.deepEqual(readPngDimensions(path.join(ROOT, 'og-uk.png')), { width: 1200, height: 630 });
  assert.deepEqual(readPngDimensions(path.join(ROOT, 'og-en.png')), { width: 1200, height: 630 });
  assert.deepEqual(readPngDimensions(path.join(ROOT, 'apple-touch-icon.png')), { width: 180, height: 180 });

  assert.ok(fs.existsSync(path.join(ROOT, 'favicon.svg')));
  assert.ok(fs.existsSync(path.join(ROOT, 'robots.txt')));
  const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('https://koshorts.vercel.app/uk/'));
  assert.ok(sitemap.includes('hreflang="uk"'));

  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const cspHeader = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy');
  assert.ok(cspHeader, 'Content-Security-Policy header must be configured in vercel.json');
  assert.ok(cspHeader.value.includes("script-src 'self'"), 'CSP script-src should not allow unsafe-inline');
});

test('All HTML files are free of Tailwind Play CDN, inline scripts/styles/handlers, and forbidden price-lock claims', () => {
  const htmlFiles = ['index.html', 'uk/index.html', 'en/index.html', 'privacy/index.html', 'terms/index.html'];
  const forbiddenList = [
    'ЗАМЕНИТЬ',
    'добавить og.png',
    '@remont_texnika',
    '22:37',
    '217K',
    'фиксируется',
    'закрепляется',
    'фіксується',
    'закріплюється',
    'Price locked'
  ];

  for (const rel of htmlFiles) {
    const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!raw.includes('@tailwindcss/browser'), `${rel} must not load @tailwindcss/browser`);
    assert.ok(!raw.includes('<style'), `${rel} must not contain inline <style>`);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(raw), `${rel} must not contain inline <script>`);
    assert.ok(!/\sstyle="/i.test(raw), `${rel} must not contain inline style="" attributes`);
    assert.ok(!/\son[a-z]+="/i.test(raw), `${rel} must not contain inline event handlers`);
    assert.ok(!raw.includes('data-i18n-html'), `${rel} must not use innerHTML i18n sink`);

    for (const forbidden of forbiddenList) {
      assert.ok(!raw.includes(forbidden), `${rel} must not contain outdated/forbidden text: ${forbidden}`);
    }
  }

  for (const jsRel of ['assets/i18n.js', 'assets/legal-i18n.js', 'assets/app.js']) {
    const rawJs = fs.readFileSync(path.join(ROOT, jsRel), 'utf8');
    for (const forbidden of forbiddenList) {
      assert.ok(!rawJs.includes(forbidden), `${jsRel} must not contain forbidden text: ${forbidden}`);
    }
  }
});

test('Real YouTube Studio analytics and Early Adopter 12-of-50 copy are present in RU and UA', () => {
  const ruHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(ruHtml.includes('230K'));
  assert.ok(ruHtml.includes('00:31'));
  assert.ok(ruHtml.includes('00:30'));
  assert.ok(ruHtml.includes('5.6K'));
  assert.ok(ruHtml.includes('00:48'));
  assert.ok(ruHtml.includes('11.6K'));
  assert.ok(ruHtml.includes('8:22'));
  assert.ok(ruHtml.includes('274K'));
  assert.ok(ruHtml.includes('247 678'));
  assert.ok(ruHtml.includes('@rem-tex'));
  assert.ok(ruHtml.includes('12 из 50'));

  const ukHtml = fs.readFileSync(path.join(ROOT, 'uk/index.html'), 'utf8');
  assert.ok(ukHtml.includes('247 678'));
  assert.ok(ukHtml.includes('@rem-tex'));
  assert.ok(ukHtml.includes('12 із 50'));
});

test('RU, UK, and EN i18n dictionaries have 1:1:1 key parity, EN has zero Cyrillic, and UK has zero Russian-only letters', () => {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(i18nCode, sandbox);
  vm.runInNewContext(legalI18nCode, sandbox);

  const ruKeys = Object.keys(sandbox.KOSHORTS_I18N.ru).sort();
  const ukKeys = Object.keys(sandbox.KOSHORTS_I18N.uk).sort();
  const enKeys = Object.keys(sandbox.KOSHORTS_I18N.en).sort();
  assert.deepEqual(ruKeys, ukKeys, 'RU and UK landing dictionaries must have identical keys');
  assert.deepEqual(ruKeys, enKeys, 'RU and EN landing dictionaries must have identical keys');

  for (const page of ['privacy', 'terms']) {
    const lRu = Object.keys(sandbox.KOSHORTS_LEGAL_I18N[page].ru).sort();
    const lUk = Object.keys(sandbox.KOSHORTS_LEGAL_I18N[page].uk).sort();
    const lEn = Object.keys(sandbox.KOSHORTS_LEGAL_I18N[page].en).sort();
    assert.deepEqual(lRu, lUk, `Legal ${page} RU and UK dictionaries must have identical keys`);
    assert.deepEqual(lRu, lEn, `Legal ${page} RU and EN dictionaries must have identical keys`);
  }

  for (const [k, val] of Object.entries(sandbox.KOSHORTS_I18N.en)) {
    assert.ok(!CYRILLIC_RE.test(val), `KOSHORTS_I18N.en.${k} contains Cyrillic: ${val}`);
  }
  for (const [k, val] of Object.entries(sandbox.KOSHORTS_I18N.uk)) {
    assert.ok(!RU_ONLY_LETTERS_RE.test(val), `KOSHORTS_I18N.uk.${k} contains Russian-only letters: ${val}`);
  }
  for (const page of ['privacy', 'terms']) {
    for (const [k, val] of Object.entries(sandbox.KOSHORTS_LEGAL_I18N[page].uk)) {
      assert.ok(!RU_ONLY_LETTERS_RE.test(val), `KOSHORTS_LEGAL_I18N.${page}.uk.${k} contains Russian-only letters: ${val}`);
    }
  }

  // Verify static en/index.html
  const enDom = new JSDOM(fs.readFileSync(path.join(ROOT, 'en/index.html'), 'utf8'));
  openDoms.push(enDom);
  const enDoc = enDom.window.document;
  assert.equal(enDoc.documentElement.lang, 'en');
  assert.ok(!CYRILLIC_RE.test(enDoc.title), 'en/index.html <title> must not contain Cyrillic');
  assert.ok(!CYRILLIC_RE.test(enDoc.body.textContent), 'en/index.html body text must not contain any Cyrillic');
  enDoc.querySelectorAll('[aria-label]').forEach((el) => {
    assert.ok(!CYRILLIC_RE.test(el.getAttribute('aria-label')));
  });

  // Verify static uk/index.html
  const ukDom = new JSDOM(fs.readFileSync(path.join(ROOT, 'uk/index.html'), 'utf8'));
  openDoms.push(ukDom);
  const ukDoc = ukDom.window.document;
  assert.equal(ukDoc.documentElement.lang, 'uk');
  assert.equal(ukDoc.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://koshorts.vercel.app/uk/');
  assert.equal(ukDoc.querySelector('meta[property="og:image"]').getAttribute('content'), 'https://koshorts.vercel.app/og-uk.png');
  assert.equal(ukDoc.querySelector('meta[property="og:locale"]').getAttribute('content'), 'uk_UA');
  assert.ok(!RU_ONLY_LETTERS_RE.test(ukDoc.title), 'uk/index.html <title> must not contain Russian-only letters');
  assert.ok(!RU_ONLY_LETTERS_RE.test(ukDoc.body.textContent), 'uk/index.html body text must not contain Russian-only letters');
  ukDoc.querySelectorAll('[aria-label]').forEach((el) => {
    assert.ok(!RU_ONLY_LETTERS_RE.test(el.getAttribute('aria-label')));
  });
  ukDoc.querySelectorAll('[placeholder]').forEach((el) => {
    assert.ok(!RU_ONLY_LETTERS_RE.test(el.getAttribute('placeholder')));
  });
});

test('Switching language on / across RU -> UA -> EN updates DOM, URL, canonical, OG tags, and localStorage cleanly', () => {
  const dom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/',
    languages: ['ru-RU']
  });
  const { document, localStorage, location } = dom.window;

  assert.equal(document.documentElement.lang, 'ru');

  // Switch to Ukrainian (UA)
  document.querySelector('.lang button[data-lang="uk"]').click();
  assert.equal(document.documentElement.lang, 'uk');
  assert.equal(localStorage.getItem('koshorts-lang'), 'uk');
  assert.equal(location.pathname, '/uk/');
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://koshorts.vercel.app/uk/');
  assert.equal(document.querySelector('meta[property="og:image"]').getAttribute('content'), 'https://koshorts.vercel.app/og-uk.png');
  assert.equal(document.querySelector('meta[property="og:locale"]').getAttribute('content'), 'uk_UA');
  assert.ok(!RU_ONLY_LETTERS_RE.test(document.body.textContent), 'Body text after switching to UA must have zero Russian-only letters');

  // Switch to English (EN)
  document.querySelector('.lang button[data-lang="en"]').click();
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(localStorage.getItem('koshorts-lang'), 'en');
  assert.equal(location.pathname, '/en/');
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://koshorts.vercel.app/en/');
  assert.ok(!CYRILLIC_RE.test(document.body.textContent), 'Body text after switching to EN must have zero Cyrillic');
});

test('First-visit browser language auto-detection selects UK for Ukrainian, EN for English, RU for Russian, and normalizes ?lang=ua', () => {
  const uaDom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/',
    languages: ['uk-UA', 'en-US']
  });
  assert.equal(uaDom.window.document.documentElement.lang, 'uk');

  const enDom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/',
    languages: ['en-US', 'en']
  });
  assert.equal(enDom.window.document.documentElement.lang, 'en');

  const ruDom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/',
    languages: ['ru-RU', 'ru']
  });
  assert.equal(ruDom.window.document.documentElement.lang, 'ru');

  const uaQueryDom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/?lang=ua',
    languages: ['en-US']
  });
  assert.equal(uaQueryDom.window.document.documentElement.lang, 'uk');
});

test('Telegram chat messages are in chronological order and Hero LCP elements are immediately visible', () => {
  const dom = bootPage('index.html');
  const { document } = dom.window;

  const times = Array.from(document.querySelectorAll('.tg-msgs .m .t')).map((el) => el.textContent.trim().slice(0, 5));
  assert.deepEqual(times, ['22:38', '22:39', '22:41', '22:43']);

  for (const sel of ['.promo-pill', '.hero h1', '.hero .sub', '.try-box', '.stage-wrap']) {
    const el = document.querySelector(sel);
    assert.ok(el, `${sel} must exist`);
    assert.ok(!el.classList.contains('reveal'), `${sel} must not have .reveal opacity-0 delay`);
  }

  document.querySelectorAll('.hero img').forEach((img) => {
    assert.notEqual(img.getAttribute('loading'), 'lazy', 'Above-the-fold Hero images should not use loading="lazy"');
  });
});

test('Interactive video player, Shorts modal viewer, backdrop drag guard, and thumbnail fallback work cleanly', () => {
  const dom = bootPage('index.html');
  const { window } = dom;
  const { document } = window;

  const thumb = document.querySelector('img[data-yt-id="rrxsdUa7pWk"]');
  assert.ok(thumb.src.endsWith('/oar2.jpg'));
  thumb.dispatchEvent(new window.Event('error'));
  assert.ok(thumb.src.endsWith('/maxresdefault.jpg'));
  thumb.dispatchEvent(new window.Event('error'));
  assert.ok(thumb.src.endsWith('/hqdefault.jpg'));

  const playBtn = document.querySelector('#player button');
  playBtn.click();
  assert.ok(document.querySelector('#player iframe').src.includes('youtube-nocookie.com/embed/0TZPOmktw2U'));

  const shortLink = document.querySelector('.sh[data-short-id="bJmMqcmxC14"]');
  shortLink.click();

  const viewer = document.getElementById('shorts-viewer');
  assert.equal(viewer.open, true);
  assert.equal(document.querySelector('#player iframe'), null, 'Source iframe must be stopped when opening a Short');
  assert.ok(document.querySelector('#shorts-player iframe').src.includes('youtube-nocookie.com/embed/bJmMqcmxC14'));
  assert.ok(document.body.classList.contains('video-open'));

  const innerBox = document.querySelector('.shorts-viewer-box');
  innerBox.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  viewer.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(viewer.open, true, 'Modal must stay open when pointerdown started inside .shorts-viewer-box');

  viewer.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  viewer.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(viewer.open, false);
  assert.equal(document.querySelector('#shorts-player iframe'), null);
  assert.ok(!document.body.classList.contains('video-open'));
});

test('Interactive 4-style subtitle switcher and Hero YouTube link launcher work across RU, UA, and EN', () => {
  const dom = bootPage('index.html', {
    url: 'https://koshorts.vercel.app/',
    languages: ['ru-RU']
  });
  const { window } = dom;
  const { document } = window;

  let openedUrl = null;
  window.open = (url) => {
    openedUrl = url;
  };

  const phoneMock = document.getElementById('phone-mock');
  const pill = document.getElementById('phone-style-pill');
  const podcastTab = document.querySelector('.style-tab[data-style-id="podcast"]');
  podcastTab.click();

  assert.equal(phoneMock.getAttribute('data-active-style'), 'podcast');
  assert.equal(podcastTab.getAttribute('aria-pressed'), 'true');
  assert.ok(pill.textContent.includes('Строгий'));

  // Switch language to UA while Podcast style is active
  document.querySelector('.lang button[data-lang="uk"]').click();
  assert.ok(pill.textContent.includes('Стриманий'));

  // Switch language to EN while Podcast style is active
  document.querySelector('.lang button[data-lang="en"]').click();
  assert.ok(pill.textContent.includes('Strict'));

  const tryInput = document.getElementById('try-input');
  const tryForm = document.getElementById('try-form');
  const tryToast = document.getElementById('try-toast');
  assert.equal(tryToast.hidden, true);

  tryInput.value = 'https://youtu.be/0TZPOmktw2U';
  tryForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  assert.equal(tryToast.hidden, false);
  assert.equal(openedUrl, 'https://t.me/remtex_shorts_ai_bot?start=free');
});

test('Legal pages (/privacy/ and /terms/) contain support contacts and switch cleanly across RU, UA, and EN', () => {
  for (const rel of ['privacy/index.html', 'terms/index.html']) {
    const dom = bootPage(rel, {
      url: `https://koshorts.vercel.app/${rel.replace('index.html', '')}`,
      languages: ['ru-RU']
    });
    const { document } = dom.window;

    assert.ok(document.body.textContent.includes('@remtex_shorts_ai_bot'));
    assert.ok(document.body.textContent.includes('kostruband@gmail.com'));

    document.querySelector('.lang button[data-lang="uk"]').click();
    assert.equal(document.documentElement.lang, 'uk');
    assert.equal(document.querySelector('.legal-back').getAttribute('href'), '/uk/');
    assert.ok(!RU_ONLY_LETTERS_RE.test(document.body.textContent), `${rel} in UA mode must contain zero Russian-only letters`);

    document.querySelector('.lang button[data-lang="en"]').click();
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.querySelector('.legal-back').getAttribute('href'), '/en/');
    assert.ok(!CYRILLIC_RE.test(document.body.textContent), `${rel} in EN mode must contain zero Cyrillic`);
  }
});

test('Accessibility audit (axe-core) passes with zero violations across all 5 HTML pages', async () => {
  for (const rel of ['index.html', 'uk/index.html', 'en/index.html', 'privacy/index.html', 'terms/index.html']) {
    const dom = bootPage(rel);
    dom.window.eval(axe.source);
    const results = await dom.window.axe.run(dom.window.document, {
      rules: {
        // Color contrast requires a real layout canvas (covered in Playwright tests/landing.spec.mjs)
        'color-contrast': { enabled: false }
      }
    });
    assert.equal(
      results.violations.length,
      0,
      `${rel} had axe violations: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, help: v.help })), null, 2)}`
    );
  }
});
