(function () {
  'use strict';

  var root = document.documentElement;
  var legalPage = document.body && document.body.getAttribute('data-legal-page');
  var translations = legalPage
    ? (globalThis.KOSHORTS_LEGAL_I18N && globalThis.KOSHORTS_LEGAL_I18N[legalPage])
    : globalThis.KOSHORTS_I18N;

  var YT_ID_RE = /^[\w-]{11}$/;
  var SITE_ORIGIN = 'https://koshorts.vercel.app';
  var BOT_FREE_URL = 'https://t.me/remtex_shorts_ai_bot?start=free';

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // CSP-safe YouTube thumbnail fallback chain
  function advanceThumb(img) {
    var id = img.getAttribute('data-yt-id');
    if (!id || !YT_ID_RE.test(id)) return;
    var kind = img.getAttribute('data-yt-kind') || 'short';
    var chain = kind === 'short'
      ? ['oar2.jpg', 'maxresdefault.jpg', 'hqdefault.jpg']
      : ['maxresdefault.jpg', 'hqdefault.jpg'];
    var step = Number(img.getAttribute('data-yt-step') || '0') + 1;
    if (step >= chain.length) return;
    img.setAttribute('data-yt-step', String(step));
    img.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/' + chain[step];
  }

  document.querySelectorAll('img[data-yt-id]').forEach(function (img) {
    img.addEventListener('error', function () {
      advanceThumb(img);
    });
    img.addEventListener('load', function () {
      if (img.naturalWidth > 0 && img.naturalWidth <= 120) {
        advanceThumb(img);
      }
    });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
      advanceThumb(img);
    }
  });

  function detectBrowserLang() {
    var list = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages) && navigator.languages.length) {
        list = navigator.languages;
      } else if (navigator.language) {
        list = [navigator.language];
      }
    }
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase();
      if (code.indexOf('ru') === 0 || code.indexOf('uk') === 0 || code.indexOf('be') === 0 || code.indexOf('kk') === 0) {
        return 'ru';
      }
      if (code.indexOf('en') === 0) {
        return 'en';
      }
    }
    return root.lang === 'en' ? 'en' : 'ru';
  }

  function resolveInitialLang() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'en' || q === 'ru') return q;
    } catch (e) {}

    var path = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/';
    if (path === '/en' || path.indexOf('/en/') === 0) {
      return 'en';
    }

    try {
      var saved = localStorage.getItem('koshorts-lang');
      if (saved === 'en' || saved === 'ru') return saved;
    } catch (e) {}

    return detectBrowserLang();
  }

  var metaDesc = document.querySelector('meta[name="description"]');
  var ogT = document.querySelector('meta[property="og:title"]');
  var ogD = document.querySelector('meta[property="og:description"]');
  var ogImg = document.querySelector('meta[property="og:image"]');
  var ogUrl = document.querySelector('meta[property="og:url"]');
  var ogL = document.querySelector('meta[property="og:locale"]');
  var ogLa = document.querySelector('meta[property="og:locale:alternate"]');
  var twT = document.querySelector('meta[name="twitter:title"]');
  var twD = document.querySelector('meta[name="twitter:description"]');
  var twImg = document.querySelector('meta[name="twitter:image"]');
  var canonical = document.querySelector('link[rel="canonical"]');

  function updateSeoUrls(lang, updateHistory) {
    var hash = (typeof location !== 'undefined' && location.hash) ? location.hash : '';
    if (!legalPage) {
      var targetPath = lang === 'en' ? '/en/' : '/';
      var fullUrl = SITE_ORIGIN + targetPath;
      if (canonical) canonical.setAttribute('href', fullUrl);
      if (ogUrl) ogUrl.setAttribute('content', fullUrl);
      if (updateHistory && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        try {
          history.replaceState(null, '', targetPath + hash);
        } catch (e) {}
      }
    } else {
      var basePath = '/' + legalPage + '/';
      var query = lang === 'en' ? '?lang=en' : '';
      if (updateHistory && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        try {
          history.replaceState(null, '', basePath + query + hash);
        } catch (e) {}
      }
      document.querySelectorAll('[data-home-link]').forEach(function (a) {
        var suffix = a.getAttribute('data-home-anchor') || '';
        a.setAttribute('href', (lang === 'en' ? '/en/' : '/') + suffix);
      });
    }

    document.querySelectorAll('[data-legal-link]').forEach(function (a) {
      var slug = a.getAttribute('data-legal-link');
      a.setAttribute('href', '/' + slug + '/' + (lang === 'en' ? '?lang=en' : ''));
    });
  }

  function applyLang(lang, options) {
    if (!translations) return;
    if (!translations[lang]) lang = 'ru';
    var opts = options || {};
    var t = translations[lang];

    root.lang = lang;
    if (t.meta_title) document.title = t.meta_title;
    if (metaDesc && t.meta_desc) metaDesc.setAttribute('content', t.meta_desc);
    if (ogT && t.og_title) ogT.setAttribute('content', t.og_title);
    if (ogD && t.og_desc) ogD.setAttribute('content', t.og_desc);
    if (ogImg && t.og_image) ogImg.setAttribute('content', t.og_image);
    if (twT && t.og_title) twT.setAttribute('content', t.og_title);
    if (twD && t.og_desc) twD.setAttribute('content', t.og_desc);
    if (twImg && t.og_image) twImg.setAttribute('content', t.og_image);
    if (ogL) ogL.setAttribute('content', lang === 'ru' ? 'ru_RU' : 'en_US');
    if (ogLa) ogLa.setAttribute('content', lang === 'ru' ? 'en_US' : 'ru_RU');

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (t[k] !== undefined) el.textContent = t[k];
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-aria');
      if (t[k] !== undefined) el.setAttribute('aria-label', t[k]);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder');
      if (t[k] !== undefined) el.setAttribute('placeholder', t[k]);
    });

    document.querySelectorAll('iframe[data-title-key]').forEach(function (el) {
      var k = el.getAttribute('data-title-key');
      if (t[k] !== undefined) el.title = t[k];
    });

    document.querySelectorAll('.lang button[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });

    updateSeoUrls(lang, Boolean(opts.updateHistory));

    if (opts.persist) {
      try {
        localStorage.setItem('koshorts-lang', lang);
      } catch (e) {}
    }
  }

  if (translations) {
    var hasQueryLang = false;
    try {
      var qParam = new URLSearchParams(location.search).get('lang');
      hasQueryLang = qParam === 'en' || qParam === 'ru';
    } catch (e) {}
    var initialLang = resolveInitialLang();
    applyLang(initialLang, { persist: hasQueryLang, updateHistory: false });

    document.querySelectorAll('.lang button[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        applyLang(b.getAttribute('data-lang'), { persist: true, updateHistory: true });
      });
    });
  }

  // Hero YouTube Link Launcher (copies pasted URL so user can drop it right into Telegram bot)
  var tryForm = document.getElementById('try-form');
  var tryInput = document.getElementById('try-input');
  var tryToast = document.getElementById('try-toast');
  if (tryForm && tryInput) {
    tryForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var val = String(tryInput.value || '').trim();
      if (val && tryToast) {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(val).catch(function () {});
          }
        } catch (e) {}
        tryToast.hidden = false;
      }
      if (typeof window.open === 'function') {
        window.open(BOT_FREE_URL, '_blank', 'noopener');
      }
    });
  }

  // Interactive 4 Subtitle Styles Preview + Live Word-by-Word Karaoke Highlight
  var phoneMock = document.getElementById('phone-mock');
  var phoneStylePill = document.getElementById('phone-style-pill');
  var styleTabs = document.querySelectorAll('.style-tab[data-style-id]');
  if (phoneMock && styleTabs.length > 0) {
    styleTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var styleId = tab.getAttribute('data-style-id') || 'classic';
        phoneMock.setAttribute('data-active-style', styleId);
        styleTabs.forEach(function (other) {
          other.setAttribute('aria-pressed', other === tab ? 'true' : 'false');
        });
        if (phoneStylePill) {
          var key = 'phone_active_' + styleId;
          phoneStylePill.setAttribute('data-i18n', key);
          var dict = translations && translations[root.lang];
          if (dict && dict[key]) {
            phoneStylePill.textContent = dict[key];
          }
        }
      });
    });

    var words = phoneMock.querySelectorAll('.cap-word');
    var reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (words.length > 0 && !reduceMotion) {
      var activeIdx = 0;
      setInterval(function () {
        if (document.hidden) return;
        words[activeIdx].classList.remove('is-active');
        activeIdx = (activeIdx + 1) % words.length;
        words[activeIdx].classList.add('is-active');
      }, 440);
    }
  }

  // Interactive YouTube embeds (loaded only on click)
  function createYouTubeFrame(id, titleKey) {
    if (!YT_ID_RE.test(id)) return null;
    var f = document.createElement('iframe');
    var lang = root.lang === 'en' ? 'en' : 'ru';
    f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&playsinline=1&rel=0&hl=' + encodeURIComponent(lang);
    var dict = translations && translations[lang];
    f.title = (dict && dict[titleKey]) ? dict[titleKey] : 'YouTube video player';
    f.setAttribute('data-title-key', titleKey);
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.allowFullscreen = true;
    return f;
  }

  var player = document.getElementById('player');
  if (player) {
    var playBtn = player.querySelector('button');
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (player.querySelector('iframe')) return;
        var id = player.getAttribute('data-video-id') || '';
        var f = createYouTubeFrame(id, 'vid_title');
        if (!f) return;
        player.classList.add('is-playing');
        player.appendChild(f);
        f.focus();
      });
    }
  }

  var viewer = document.getElementById('shorts-viewer');
  var shortsPlayer = document.getElementById('shorts-player');
  var viewerTitle = document.getElementById('shorts-viewer-title');
  var youtubeLink = document.getElementById('shorts-youtube');
  var returnFocus = null;
  var backdropPointerDown = false;

  if (viewer && typeof viewer.showModal === 'function' && shortsPlayer && viewerTitle && youtubeLink) {
    document.querySelectorAll('a[data-short-id]').forEach(function (link) {
      var shortId = link.getAttribute('data-short-id') || '';
      if (!YT_ID_RE.test(shortId)) return;
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-controls', 'shorts-viewer');

      link.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        var id = link.getAttribute('data-short-id') || '';
        var titleKey = link.getAttribute('data-title-key') || 'viewer_title';
        var frame = createYouTubeFrame(id, titleKey);
        if (!frame) return;

        event.preventDefault();

        if (player) {
          var sourceFrame = player.querySelector('iframe');
          if (sourceFrame) sourceFrame.remove();
          player.classList.remove('is-playing');
        }

        returnFocus = link;
        viewerTitle.setAttribute('data-i18n', titleKey);
        var dict = translations && translations[root.lang];
        if (dict && dict[titleKey]) {
          viewerTitle.textContent = dict[titleKey];
        }
        youtubeLink.href = link.href;
        shortsPlayer.textContent = '';
        shortsPlayer.appendChild(frame);
        document.body.classList.add('video-open');
        if (!viewer.open) {
          viewer.showModal();
        }
      });
    });

    var closeBtn = document.getElementById('shorts-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (viewer.open) viewer.close();
      });
    }

    viewer.addEventListener('pointerdown', function (event) {
      backdropPointerDown = event.target === viewer;
    });

    viewer.addEventListener('click', function (event) {
      if (event.target === viewer && backdropPointerDown && viewer.open) {
        viewer.close();
      }
      backdropPointerDown = false;
    });

    viewer.addEventListener('close', function () {
      shortsPlayer.textContent = '';
      document.body.classList.remove('video-open');
      if (returnFocus && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
      returnFocus = null;
    });
  }

  // Progressive scroll-reveal for below-the-fold sections only
  var items = document.querySelectorAll('.reveal');
  if (items.length > 0) {
    var reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) {
        el.classList.add('in');
      });
    } else {
      root.classList.add('js-reveal');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.02, rootMargin: '0px 0px -20px 0px' });

      items.forEach(function (el) {
        io.observe(el);
      });

      setTimeout(function () {
        items.forEach(function (el) {
          el.classList.add('in');
        });
      }, 2500);
    }
  }
})();
