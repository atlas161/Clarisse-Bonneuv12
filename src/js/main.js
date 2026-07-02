import { createIcons, FolderOpen, FolderPlus, FolderSearch, Menu, X } from 'lucide';
import {
  getAlternatePath,
  getCurrentLocale,
  getLocalizedPath,
  normalizeLocale,
  runtimeTranslations,
} from './i18n.js';

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const currentLocale = getCurrentLocale();
const ui = runtimeTranslations[currentLocale];
const siteHeader = document.querySelector('.site-header');
const root = document.documentElement;
const body = document.body;
const mobileMenu = document.querySelector('[data-mobile-menu]');
const mobileMenuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenuClose = document.querySelector('[data-menu-close]');
const mobileMenuIcon = mobileMenuToggle?.querySelector('[data-menu-icon]');
const mobileMenuLabel = mobileMenuToggle?.querySelector('.sr-only');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const localeStorageKey = 'clarisse-bonneu-locale';
const DEFAULT_PORTFOLIO_CACHE_VERSION = '20260702-polas-fix-1';
const portfolioCacheVersionKey = 'clarisse-bonneu-portfolio-version:v2';
const cookieConsentStorageKey = 'clarisse-bonneu-cookie-consent:v1';
const cookieBannerDelayMs = 5000;
const PORTFOLIO_BROWSER_CACHE_TTL_MS = 15 * 60 * 1000;

const renderLucideIcons = () => {
  createIcons({
    icons: {
      FolderOpen,
      FolderPlus,
      FolderSearch,
      Menu,
      X,
    },
    attrs: {
      width: '20',
      height: '20',
      'stroke-width': '1.75',
    },
  });
};

const readPortfolioCacheVersion = () => {
  try {
    return (
      String(window.localStorage.getItem(portfolioCacheVersionKey) || DEFAULT_PORTFOLIO_CACHE_VERSION).trim() ||
      DEFAULT_PORTFOLIO_CACHE_VERSION
    );
  } catch {
    return DEFAULT_PORTFOLIO_CACHE_VERSION;
  }
};

const getPortfolioBrowserCacheKey = (portfolioName, locale, version = '0') =>
  `clarisse-bonneu-portfolio:v4:${normalizeLocale(locale)}:${String(portfolioName || 'default').trim() || 'default'}:${String(version || '0').trim() || '0'}`;

const readPortfolioBrowserCache = (cacheKey) => {
  try {
    const raw = window.localStorage.getItem(cacheKey);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writePortfolioBrowserCache = (cacheKey, payload) => {
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        payload,
        expiresAt: Date.now() + PORTFOLIO_BROWSER_CACHE_TTL_MS,
      })
    );
  } catch {
    return;
  }
};

const persistLocale = (locale) => {
  try {
    window.localStorage.setItem(localeStorageKey, normalizeLocale(locale));
  } catch (error) {
    return;
  }
};

const readCookieConsent = () => {
  try {
    const raw = window.localStorage.getItem(cookieConsentStorageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return {
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
    };
  } catch {
    return null;
  }
};

const writeCookieConsent = (consent) => {
  try {
    window.localStorage.setItem(
      cookieConsentStorageKey,
      JSON.stringify({
        analytics: Boolean(consent?.analytics),
        marketing: Boolean(consent?.marketing),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    return;
  }
};

const syncGtagConsent = (consent) => {
  if (!window.dataLayer) {
    window.dataLayer = [];
  }
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }

  const analyticsGranted = Boolean(consent?.analytics);
  const marketingGranted = Boolean(consent?.marketing);

  window.gtag('consent', 'update', {
    analytics_storage: analyticsGranted ? 'granted' : 'denied',
    ad_storage: marketingGranted ? 'granted' : 'denied',
    ad_user_data: marketingGranted ? 'granted' : 'denied',
    ad_personalization: marketingGranted ? 'granted' : 'denied',
  });
};

const initCookieConsent = () => {
  const existing = readCookieConsent();
  if (existing) {
    syncGtagConsent(existing);
    return;
  }

  window.setTimeout(() => {
    if (readCookieConsent()) {
      return;
    }

    const banner = document.createElement('section');
    banner.className = prefersReducedMotion ? 'cookie-banner' : 'cookie-banner is-entering';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', ui.cookieTitle);

    const privacyHref = getLocalizedPath('privacyPolicy', currentLocale);

    banner.innerHTML = `
      <div class="cookie-banner__inner container">
        <div class="cookie-banner__content">
          <p class="cookie-banner__title">${ui.cookieTitle}</p>
          <p class="cookie-banner__text">${ui.cookieDescription}</p>
          <a class="cookie-banner__link" href="${privacyHref}">${ui.cookiePrivacyLink}</a>
        </div>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-banner__button" data-cookie-action="reject">${ui.cookieRejectAll}</button>
          <button type="button" class="cookie-banner__button cookie-banner__button--soft" data-cookie-action="customize">${ui.cookieCustomize}</button>
          <button type="button" class="cookie-banner__button cookie-banner__button--primary" data-cookie-action="accept">${ui.cookieAcceptAll}</button>
        </div>
        <div class="cookie-banner__prefs" hidden>
          <div class="cookie-banner__pref">
            <div class="cookie-banner__pref-copy">
              <div class="cookie-banner__pref-label">${ui.cookieAnalyticsLabel}</div>
              <div class="cookie-banner__pref-hint">${ui.cookieAnalyticsHint}</div>
            </div>
            <label class="cookie-switch">
              <span class="sr-only">${ui.cookieAnalyticsLabel}</span>
              <input type="checkbox" class="cookie-switch__input" data-cookie-analytics />
              <span class="cookie-switch__track" aria-hidden="true"></span>
            </label>
          </div>
          <div class="cookie-banner__pref">
            <div class="cookie-banner__pref-copy">
              <div class="cookie-banner__pref-label">${ui.cookieMarketingLabel}</div>
              <div class="cookie-banner__pref-hint">${ui.cookieMarketingHint}</div>
            </div>
            <label class="cookie-switch">
              <span class="sr-only">${ui.cookieMarketingLabel}</span>
              <input type="checkbox" class="cookie-switch__input" data-cookie-marketing />
              <span class="cookie-switch__track" aria-hidden="true"></span>
            </label>
          </div>
          <div class="cookie-banner__prefs-actions">
            <button type="button" class="cookie-banner__button cookie-banner__button--primary" data-cookie-action="save">${ui.cookieSave}</button>
          </div>
        </div>
      </div>
    `;

    document.body.append(banner);
    if (!prefersReducedMotion) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          banner.classList.remove('is-entering');
        });
      });
    }

    const prefsPanel = banner.querySelector('.cookie-banner__prefs');
    const analyticsToggle = banner.querySelector('[data-cookie-analytics]');
    const marketingToggle = banner.querySelector('[data-cookie-marketing]');

    const hideBanner = () => {
      banner.classList.add('is-hidden');
      window.setTimeout(() => banner.remove(), 260);
    };

    const setConsent = (consent) => {
      writeCookieConsent(consent);
      syncGtagConsent(consent);
      hideBanner();
    };

    banner.addEventListener('click', (event) => {
      const target =
        event.target instanceof Element ? event.target.closest('[data-cookie-action]') : null;
      const action = target?.getAttribute('data-cookie-action');

      if (!action) {
        return;
      }

      if (action === 'accept') {
        setConsent({ analytics: true, marketing: true });
        return;
      }

      if (action === 'reject') {
        setConsent({ analytics: false, marketing: false });
        return;
      }

      if (action === 'customize') {
        if (prefsPanel instanceof HTMLElement) {
          prefsPanel.hidden = false;
          banner.classList.add('is-expanded');
          if (analyticsToggle instanceof HTMLInputElement) {
            analyticsToggle.focus();
          }
        }
        return;
      }

      if (action === 'save') {
        setConsent({
          analytics: analyticsToggle instanceof HTMLInputElement ? analyticsToggle.checked : false,
          marketing: marketingToggle instanceof HTMLInputElement ? marketingToggle.checked : false,
        });
      }
    });
  }, cookieBannerDelayMs);
};

persistLocale(currentLocale);

// ---- Navigation active (ARIA) ----
document.querySelectorAll('[data-nav-link]').forEach((link) => {
  const href = link.getAttribute('href');
  const normalizedHref = href?.replace(/^\//, '');
  const isCurrent = normalizedHref === currentPage;

  if (isCurrent) {
    link.setAttribute('aria-current', 'page');
  }
});

// ---- Header offset (layout) ----
const updateHeaderOffset = () => {
  if (!siteHeader) {
    return;
  }

  root.style.setProperty('--header-offset', `${siteHeader.offsetHeight}px`);
};

// ---- Menu mobile (burger) ----
const setMenuFocusable = (isOpen) => {
  if (!mobileMenu) {
    return;
  }

  const focusables = mobileMenu.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]'
  );

  focusables.forEach((element) => {
    const attributeValue = element.getAttribute('tabindex');

    if (!isOpen) {
      if (!element.hasAttribute('data-prev-tabindex')) {
        element.setAttribute('data-prev-tabindex', attributeValue ?? '');
      }
      element.setAttribute('tabindex', '-1');
      return;
    }

    if (!element.hasAttribute('data-prev-tabindex')) {
      element.removeAttribute('tabindex');
      return;
    }

    const previous = element.getAttribute('data-prev-tabindex');
    element.removeAttribute('data-prev-tabindex');

    if (previous === '') {
      element.removeAttribute('tabindex');
      return;
    }

    element.setAttribute('tabindex', previous);
  });
};

const setMobileMenuOpen = (isOpen) => {
  if (!mobileMenu || !mobileMenuToggle) {
    return;
  }

  mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
  mobileMenu.setAttribute('aria-hidden', String(!isOpen));
  mobileMenu.dataset.open = isOpen ? 'true' : 'false';
  body.classList.toggle('menu-open', isOpen);

  if (mobileMenuIcon instanceof HTMLElement) {
    mobileMenuIcon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
    renderLucideIcons();
  }

  if (mobileMenuLabel) {
    mobileMenuLabel.textContent = isOpen ? ui.menuClose : ui.menuOpen;
  }

  setMenuFocusable(isOpen);

  if (isOpen) {
    window.setTimeout(() => {
      const firstLink = mobileMenu.querySelector('a[href]');
      firstLink?.focus();
    }, 0);
  }
};

// ---- Switch de langue ----
const initLocaleSwitcher = () => {
  const localeLinks = Array.from(document.querySelectorAll('[data-locale-link]'));

  if (localeLinks.length === 0) {
    return;
  }

  localeLinks.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const targetLocale = normalizeLocale(link.dataset.locale);
    link.href = getAlternatePath(window.location.pathname, targetLocale);

    if (targetLocale === currentLocale) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }

    link.addEventListener('click', () => {
      persistLocale(targetLocale);
      setMobileMenuOpen(false);
    });
  });
};

const initFooterMeta = () => {
  const currentYear = new Date().getFullYear();

  document.querySelectorAll('[data-site-year]').forEach((element) => {
    element.textContent = String(currentYear);
  });
};

// ---- Header state (glass on scroll) ----
const syncHeaderState = () => {
  if (!siteHeader) {
    return;
  }

  siteHeader.classList.toggle('is-scrolled', window.scrollY > 16);
};

updateHeaderOffset();
syncHeaderState();
window.addEventListener('scroll', syncHeaderState, { passive: true });
window.addEventListener('resize', () => {
  updateHeaderOffset();
  if (window.matchMedia('(min-width: 768px)').matches) {
    setMobileMenuOpen(false);
  }
});

if (mobileMenuToggle && mobileMenu) {
  if (!mobileMenu.hasAttribute('aria-hidden')) {
    mobileMenu.setAttribute('aria-hidden', 'true');
  }
  mobileMenu.dataset.open = 'false';
  setMenuFocusable(false);

  mobileMenuToggle.addEventListener('click', () => {
    const isOpen = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
    setMobileMenuOpen(!isOpen);
  });

  mobileMenuClose?.addEventListener('click', () => {
    setMobileMenuOpen(false);
  });

  mobileMenu.addEventListener('click', (event) => {
    if (event.target === mobileMenu) {
      setMobileMenuOpen(false);
    }
  });

  mobileMenu.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMobileMenuOpen(false);
  }
});

// ---- Animations au scroll (IntersectionObserver) ----
const initScrollReveal = () => {
  const contentRoot = document.querySelector('#content');

  if (!contentRoot) {
    return;
  }

  const candidates = Array.from(
    contentRoot.querySelectorAll('h1, h2, h3, p, img, .portfolio-card, .hero-media')
  ).filter((element) => !element.closest('[data-no-reveal]'));

  if (candidates.length === 0) {
    return;
  }

  const initialClasses = [
    'opacity-0',
    'translate-y-4',
    'transition-all',
    'duration-700',
    'ease-out',
  ];
  const finalClasses = ['opacity-100', 'translate-y-0'];

  const revealImmediately = () => {
    candidates.forEach((element) => {
      element.classList.remove(...initialClasses);
      element.classList.add(...finalClasses);
    });
  };

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealImmediately();
    return;
  }

  candidates.forEach((element) => {
    element.classList.add(...initialClasses);
    element.classList.remove(...finalClasses);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const element = entry.target;
        element.classList.remove(...initialClasses);
        element.classList.add(...finalClasses);
        observer.unobserve(element);
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  candidates.forEach((element) => observer.observe(element));
};

// ---- Transition de page (fade léger) ----
const initPageTransitions = () => {
  const transitionTargets = [
    document.querySelector('#content'),
    document.querySelector('.site-footer'),
  ].filter(Boolean);

  transitionTargets.forEach((element) => element.classList.add('page-transition-target'));

  if (!prefersReducedMotion) {
    body.classList.add('page-enter');
    requestAnimationFrame(() => {
      body.classList.remove('page-enter');
    });
  }

  window.addEventListener('pageshow', () => {
    body.classList.remove('page-leave');
    body.classList.remove('page-enter');
  });

  document.addEventListener(
    'click',
    (event) => {
      if (prefersReducedMotion) {
        return;
      }

      if (event.defaultPrevented) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      const link = target instanceof Element ? target.closest('a[href]') : null;

      if (!link) {
        return;
      }

      if (link.hasAttribute('download')) {
        return;
      }

      if (link.target && link.target !== '_self') {
        return;
      }

      const href = link.getAttribute('href');

      if (!href || href.startsWith('#')) {
        return;
      }

      if (/^(mailto:|tel:|javascript:)/i.test(href)) {
        return;
      }

      const url = new URL(href, window.location.href);

      if (url.origin !== window.location.origin) {
        return;
      }

      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash
      ) {
        return;
      }

      event.preventDefault();
      setMobileMenuOpen(false);
      body.classList.add('page-leave');
      window.setTimeout(() => {
        window.location.assign(url.href);
      }, 180);
    },
    { capture: true }
  );
};

// ---- Lightbox (portfolio) ----
const initLightbox = () => {
  const triggerSelector = '[data-lightbox]';
  const shouldEnableLightbox = document.querySelector('[data-lightbox], [data-portfolio-grid]');
  const prefetchedAssets = new Set();

  if (!shouldEnableLightbox) {
    return;
  }

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-hidden', 'true');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'lightbox__close';
  closeButton.setAttribute('aria-label', ui.lightboxClose);
  closeButton.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

  const image = document.createElement('img');
  image.className = 'lightbox__image';
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'eager';
  image.fetchPriority = 'high';

  const video = document.createElement('video');
  video.className = 'lightbox__video';
  video.controls = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.hidden = true;

  const embed = document.createElement('iframe');
  embed.className = 'lightbox__embed';
  embed.hidden = true;
  embed.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  embed.referrerPolicy = 'strict-origin-when-cross-origin';
  embed.allowFullscreen = true;
  embed.title = ui.lightboxFallbackAlt;

  lightbox.append(closeButton, image, video, embed);
  document.body.append(lightbox);
  renderLucideIcons();

  const prefetchLinkAsset = (link) => {
    const href = link.getAttribute('href');
    const mediaType = link.dataset.mediaType;

    if (!href || prefetchedAssets.has(href)) {
      return;
    }

    prefetchedAssets.add(href);

    if (mediaType === 'video') {
      if (link.dataset.lightboxKind === 'youtube') {
        return;
      }

      const videoPreload = document.createElement('link');
      videoPreload.rel = 'preload';
      videoPreload.as = 'video';
      videoPreload.href = href;
      document.head.append(videoPreload);
      return;
    }

    const imagePreload = new Image();
    imagePreload.decoding = 'async';
    imagePreload.src = href;
  };

  const setOpen = (isOpen) => {
    lightbox.classList.toggle('is-open', isOpen);
    lightbox.setAttribute('aria-hidden', String(!isOpen));
    body.classList.toggle('menu-open', isOpen);
    if (!isOpen) {
      image.removeAttribute('src');
      video.pause();
      video.removeAttribute('src');
      video.load();
      embed.removeAttribute('src');
      embed.title = ui.lightboxFallbackAlt;
    }
  };

  const openFromLink = (link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    const mediaType = link.dataset.mediaType;
    const lightboxKind = link.dataset.lightboxKind;

    if (lightboxKind === 'youtube') {
      image.removeAttribute('src');
      image.alt = '';
      image.hidden = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.hidden = true;
      embed.src = link.dataset.embedSrc || href;
      embed.title = link.dataset.embedTitle || link.querySelector('img')?.getAttribute('alt') || ui.lightboxFallbackAlt;
      embed.hidden = false;
    } else if (mediaType === 'video') {
      image.removeAttribute('src');
      image.alt = '';
      video.src = href;
      video.hidden = false;
      image.hidden = true;
      embed.removeAttribute('src');
      embed.hidden = true;
      video.play().catch(() => undefined);
    } else {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.hidden = true;
      embed.removeAttribute('src');
      embed.hidden = true;
      image.hidden = false;
      image.alt = link.querySelector('img')?.getAttribute('alt') ?? ui.lightboxFallbackAlt;
      image.src = href;
    }
    setOpen(true);
    closeButton.focus();
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest(triggerSelector) : null;
    if (!link) {
      return;
    }
    event.preventDefault();
    openFromLink(link);
  });

  document.addEventListener(
    'pointerenter',
    (event) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest(triggerSelector) : null;
      if (link) {
        prefetchLinkAsset(link);
      }
    },
    { capture: true }
  );

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    const link = target instanceof Element ? target.closest(triggerSelector) : null;
    if (link) {
      prefetchLinkAsset(link);
    }
  });

  closeButton.addEventListener('click', () => setOpen(false));

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      setOpen(false);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });
};

// ---- Filtres du portfolio ----
const createPortfolioItem = (item) => {
  const link = document.createElement('a');
  const mediaType = item.mediaType || 'photo';
  const isYoutube = item.lightboxKind === 'youtube';
  link.className = `portfolio-card portfolio-item${mediaType === 'video' ? ' is-video' : ''}${isYoutube ? ' is-youtube' : ''}`;
  link.href = item.lightboxSrc || item.fullSrc;
  link.dataset.lightbox = '';
  link.dataset.categorie = item.category;
  link.dataset.mediaType = mediaType;
  if (item.lightboxKind) {
    link.dataset.lightboxKind = item.lightboxKind;
  }
  if (item.embedSrc) {
    link.dataset.embedSrc = item.embedSrc;
  }
  if (item.displayTitle || item.alt) {
    link.dataset.embedTitle = item.displayTitle || item.alt;
  }
  link.setAttribute('aria-label', ui.lightboxOpen(item.alt));

  const image = document.createElement('img');
  image.src = mediaType === 'video' ? item.posterSrc || item.src : item.src;
  image.srcset = mediaType === 'video' ? item.posterSrcset || item.srcset : item.srcset;
  image.sizes = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw';
  image.width = item.width || 900;
  image.height = item.height || 1125;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.alt = item.alt;

  link.append(image);

  if (isYoutube) {
    const badge = document.createElement('span');
    badge.className = 'portfolio-card__provider';
    badge.textContent = 'YouTube';
    link.append(badge);
  }

  return link;
};

const createPortfolioFilterButton = (filter, isActive) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `portfolio-filter-button${isActive ? ' is-active' : ''}`;
  button.dataset.filter = filter.id;
  button.setAttribute('aria-pressed', String(isActive));
  button.textContent = filter.label;
  return button;
};

const createPortfolioTypeButton = (filter, isActive) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `portfolio-type-button${isActive ? ' is-active' : ''}`;
  button.dataset.mediaFilter = filter.id;
  button.setAttribute('aria-pressed', String(isActive));
  button.textContent = filter.label;
  return button;
};

const initPortfolioFilters = async () => {
  const portfolioApp = document.querySelector('[data-portfolio-app]');
  const typeNav = document.querySelector('[data-portfolio-type-filters]');
  const categoryNav = document.querySelector('[data-portfolio-category-filters]');
  const portfolioGrid = document.querySelector('[data-portfolio-grid]');
  const portfolioStatus = document.querySelector('[data-portfolio-status]');

  if (!portfolioApp || !typeNav || !categoryNav || !portfolioGrid || !portfolioStatus) {
    return;
  }

  const rootName = portfolioApp.dataset.portfolioRoot?.trim();
  const portfolioKey = portfolioApp.dataset.portfolioKey?.trim();
  const expectedPortfolioKey = portfolioKey || '';
  const expectedRootName = rootName || '';

  const doesPayloadMatchPortfolio = (payload) => {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    if (expectedPortfolioKey) {
      const payloadPortfolioKey = String(payload.portfolio || '').trim();
      if (payloadPortfolioKey && payloadPortfolioKey !== expectedPortfolioKey) {
        return false;
      }
    }

    if (expectedRootName) {
      const payloadRootName = String(payload.root || '').trim();
      if (payloadRootName && payloadRootName !== expectedRootName) {
        return false;
      }
    }

    return true;
  };

  const setStatus = (message, state = 'info', keepVisible = true) => {
    portfolioStatus.textContent = message;
    portfolioStatus.dataset.state = state;
    portfolioStatus.hidden = !keepVisible;
  };

  const searchParams = new URLSearchParams({
    locale: currentLocale,
  });
  const portfolioCacheVersion = readPortfolioCacheVersion();
  if (portfolioKey) {
    searchParams.set('portfolio', portfolioKey);
  } else if (rootName) {
    searchParams.set('root', rootName);
  }
  searchParams.set('v', portfolioCacheVersion);

  const cacheKey = getPortfolioBrowserCacheKey(portfolioKey || rootName, currentLocale, portfolioCacheVersion);
  const cachedPortfolio = readPortfolioBrowserCache(cacheKey);
  let payload = null;

  if (cachedPortfolio?.payload && cachedPortfolio.expiresAt > Date.now() && doesPayloadMatchPortfolio(cachedPortfolio.payload)) {
    payload = cachedPortfolio.payload;
  } else {
    try {
      const response = await fetch(`/api/portfolio?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(ui.portfolioLoadError);
      }

      payload = await response.json();
      if (!doesPayloadMatchPortfolio(payload)) {
        throw new Error(ui.portfolioLoadError);
      }
      writePortfolioBrowserCache(cacheKey, payload);
    } catch (error) {
      if (cachedPortfolio?.payload && doesPayloadMatchPortfolio(cachedPortfolio.payload)) {
        payload = cachedPortfolio.payload;
      } else {
        throw error;
      }
    }
  }
  const itemsData = Array.isArray(payload.items) ? payload.items : [];
  const categoryFiltersData = Array.isArray(payload.filters) ? payload.filters : [];
  const typeFiltersData = Array.isArray(payload.typeFilters) ? payload.typeFilters : [];

  portfolioGrid.replaceChildren(...itemsData.map((item) => createPortfolioItem(item)));

  if (itemsData.length === 0) {
    typeNav.replaceChildren();
    categoryNav.replaceChildren();
    setStatus(ui.portfolioEmpty, 'empty');
    return;
  }

  const usableCategoryFilters = categoryFiltersData.filter(
    (filter) => filter.id === 'tout' || itemsData.some((item) => item.category === filter.id)
  );
  const categoryFilters = usableCategoryFilters.length > 0 ? usableCategoryFilters : [{ id: 'tout', label: ui.portfolioAll }];
  categoryNav.replaceChildren(
    ...categoryFilters.map((filter) => createPortfolioFilterButton(filter, filter.id === 'tout'))
  );

  const mediaTypeFromItem = (item) => item.mediaType || 'photo';
  const defaultTypeFilters =
    currentLocale === 'en'
      ? [
          { id: 'all', label: 'All' },
          { id: 'photo', label: 'Photos' },
          { id: 'video', label: 'Videos' },
        ]
      : [
          { id: 'all', label: 'Tout' },
          { id: 'photo', label: 'Photos' },
          { id: 'video', label: 'Vidéos' },
        ];
  const rawTypeFilters = typeFiltersData.length > 0 ? typeFiltersData : defaultTypeFilters;
  const usableTypeFilters = rawTypeFilters.filter(
    (filter) => filter.id === 'all' || itemsData.some((item) => mediaTypeFromItem(item) === filter.id)
  );
  const typeFilters = usableTypeFilters.length > 0 ? usableTypeFilters : defaultTypeFilters.slice(0, 2);
  typeNav.replaceChildren(
    ...typeFilters.map((filter) => createPortfolioTypeButton(filter, filter.id === 'all'))
  );

  if (payload.notice) {
    setStatus(payload.notice, payload.source === 'demo' ? 'warning' : 'info');
  } else {
    setStatus('', 'info', false);
  }
  portfolioApp.dataset.portfolioReady = 'true';

  const items = Array.from(portfolioGrid.querySelectorAll('.portfolio-item[data-categorie]'));
  if (items.length === 0) {
    return;
  }

  const categoryButtons = Array.from(categoryNav.querySelectorAll('[data-filter]'));
  const typeButtons = Array.from(typeNav.querySelectorAll('[data-media-filter]'));
  let isFiltering = false;
  let activeCategory = 'tout';
  let activeType = 'all';

  const animateElement = (element, keyframes, options) => {
    const animation = element.animate(keyframes, options);
    return animation.finished.catch(() => undefined);
  };

  const setActiveCategoryButton = (category) => {
    categoryButtons.forEach((button) => {
      const isActive = button.dataset.filter === category;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const setActiveTypeButton = (type) => {
    typeButtons.forEach((button) => {
      const isActive = button.dataset.mediaFilter === type;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const showItem = async (item) => {
    item.hidden = false;
    item.setAttribute('aria-hidden', 'false');

    if (prefersReducedMotion) {
      item.style.opacity = '';
      item.style.transform = '';
      return;
    }

    item.style.opacity = '0';
    item.style.transform = 'scale(0.96)';
    await animateElement(
      item,
      [
        { opacity: 0, transform: 'scale(0.96) translateY(10px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
    );
    item.style.opacity = '';
    item.style.transform = '';
  };

  const hideItem = async (item) => {
    if (prefersReducedMotion) {
      item.hidden = true;
      item.setAttribute('aria-hidden', 'true');
      return;
    }

    await animateElement(
      item,
      [
        { opacity: 1, transform: 'scale(1) translateY(0)' },
        { opacity: 0, transform: 'scale(0.94) translateY(12px)' },
      ],
      { duration: 180, easing: 'ease-out', fill: 'forwards' }
    );
    item.hidden = true;
    item.setAttribute('aria-hidden', 'true');
    item.style.opacity = '';
    item.style.transform = '';
  };

  const settleVisibleItems = () => {
    if (prefersReducedMotion) {
      return;
    }

    items
      .filter((item) => !item.hidden)
      .forEach((item, index) => {
        item.animate(
          [
            { opacity: 0.82, transform: 'scale(0.985)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          {
            duration: 220,
            delay: Math.min(index * 24, 96),
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }
        );
      });
  };

  const applyFilter = async (category, type) => {
    if (isFiltering) {
      return;
    }

    isFiltering = true;
    activeCategory = category;
    activeType = type;
    setActiveCategoryButton(activeCategory);
    setActiveTypeButton(activeType);

    const itemsToShow = [];
    const itemsToHide = [];

    items.forEach((item) => {
      const itemCategory = item.dataset.categorie;
      const itemMediaType = item.dataset.mediaType || 'photo';
      const matchesCategory = activeCategory === 'tout' || itemCategory === activeCategory;
      const matchesType = activeType === 'all' || itemMediaType === activeType;
      const matches = matchesCategory && matchesType;
      const isHidden = item.hidden;

      if (matches && isHidden) {
        itemsToShow.push(item);
      } else if (!matches && !isHidden) {
        itemsToHide.push(item);
      }
    });

    await Promise.all(itemsToHide.map((item) => hideItem(item)));
    await Promise.all(itemsToShow.map((item) => showItem(item)));
    settleVisibleItems();
    isFiltering = false;
  };

  items.forEach((item) => {
    item.hidden = false;
    item.setAttribute('aria-hidden', 'false');
  });

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFilter(button.dataset.filter ?? 'tout', activeType);
    });
  });

  typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyFilter(activeCategory, button.dataset.mediaFilter ?? 'all');
    });
  });
};

// ---- Formulaire de contact (Netlify) ----
const initContactForm = () => {
  const form = document.querySelector('[data-contact-form]');
  const status = document.querySelector('[data-contact-status]');

  if (!form || !status) {
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const emailField = form.querySelector('input[name="email"]');
  const replyToField = form.querySelector('[data-contact-replyto]');
  const idleMessage = status.dataset.idleMessage || ui.contactIdle;
  const successMessage =
    status.dataset.successMessage || ui.contactSuccess;
  const errorMessage = status.dataset.errorMessage || ui.contactError;
  const defaultButtonLabel = submitButton?.dataset.submitLabel || submitButton?.textContent || ui.contactSubmit;
  const loadingButtonLabel = submitButton?.dataset.loadingLabel || ui.contactSendingButton;
  const pendingMessage = status.dataset.pendingMessage || ui.contactSending;
  const invalidMessage = form.dataset.invalidMessage || ui.contactInvalid;

  const setStatus = (message, state = 'idle') => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const syncReplyTo = () => {
    if (replyToField instanceof HTMLInputElement && emailField instanceof HTMLInputElement) {
      replyToField.value = emailField.value.trim();
    }
  };

  syncReplyTo();
  setStatus(idleMessage, 'idle');
  emailField?.addEventListener('input', syncReplyTo);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    if (!form.reportValidity()) {
      setStatus(invalidMessage, 'error');
      return;
    }

    syncReplyTo();
    submitButton?.setAttribute('disabled', 'true');
    if (submitButton) {
      submitButton.textContent = loadingButtonLabel;
    }
    setStatus(pendingMessage, 'idle');

    try {
      const formData = new FormData(form);
      const response = await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
      });

      if (!response.ok) {
        throw new Error('netlify_form_submission_failed');
      }

      form.reset();
      syncReplyTo();
      setStatus(successMessage, 'success');
    } catch (error) {
      setStatus(errorMessage, 'error');
    } finally {
      submitButton?.removeAttribute('disabled');
      if (submitButton) {
        submitButton.textContent = defaultButtonLabel;
      }
    }
  });
};

initScrollReveal();
initPageTransitions();
initLocaleSwitcher();
initCookieConsent();
renderLucideIcons();
initFooterMeta();
initLightbox();
initContactForm();
initPortfolioFilters().catch((error) => {
  const portfolioGrid = document.querySelector('[data-portfolio-grid]');
  const portfolioStatus = document.querySelector('[data-portfolio-status]');
  const portfolioApp = document.querySelector('[data-portfolio-app]');
  const hasRenderedItems =
    (portfolioGrid instanceof HTMLElement && portfolioGrid.children.length > 0) ||
    portfolioApp?.dataset.portfolioReady === 'true';

  if (portfolioStatus) {
    if (hasRenderedItems) {
      portfolioStatus.hidden = true;
      portfolioStatus.dataset.state = 'info';
      portfolioStatus.textContent = '';
      return;
    }

    portfolioStatus.hidden = false;
    portfolioStatus.dataset.state = 'error';
    portfolioStatus.textContent = error instanceof Error ? error.message : ui.portfolioRequestError;
  }
});
