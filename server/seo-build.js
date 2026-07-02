import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getPortfolioPayload } from './cloudinary-portfolio.js';
import { getPortfolioDefinition } from './portfolio-config.js';

const SITE_URL = 'https://clarisse-bonneu.com';
const SEO_IMAGE_PATH = '/images-public/hero/c1309654e57c09a934f9e78756a2ea1a.webp';
const SEO_IMAGE_URL = `${SITE_URL}${SEO_IMAGE_PATH}`;
const SEO_IMAGE_WIDTH = 1200;
const SEO_IMAGE_HEIGHT = 1600;

const PUBLIC_PAGE_CONFIG = {
  'index.html': {
    locale: 'fr',
    canonicalPath: '/',
    pageKind: 'home',
    alternates: {
      fr: '/',
      en: '/en/',
      xDefault: '/',
    },
  },
  'a-propos.html': {
    locale: 'fr',
    canonicalPath: '/a-propos.html',
    pageKind: 'default',
    alternates: {
      fr: '/a-propos.html',
      en: '/en/about.html',
      xDefault: '/a-propos.html',
    },
  },
  'portfolio.html': {
    locale: 'fr',
    canonicalPath: '/portfolio.html',
    pageKind: 'portfolio',
    portfolioKey: 'main',
    alternates: {
      fr: '/portfolio.html',
      en: '/en/portfolio.html',
      xDefault: '/portfolio.html',
    },
  },
  'polas.html': {
    locale: 'fr',
    canonicalPath: '/polas.html',
    pageKind: 'portfolio',
    portfolioKey: 'polas',
    alternates: {
      fr: '/polas.html',
      en: '/en/polas.html',
      xDefault: '/polas.html',
    },
  },
  'contact.html': {
    locale: 'fr',
    canonicalPath: '/contact.html',
    pageKind: 'default',
    alternates: {
      fr: '/contact.html',
      en: '/en/contact.html',
      xDefault: '/contact.html',
    },
  },
  'mentions-legales.html': {
    locale: 'fr',
    canonicalPath: '/mentions-legales.html',
    pageKind: 'default',
    alternates: {
      fr: '/mentions-legales.html',
      en: '/en/legal-notice.html',
      xDefault: '/mentions-legales.html',
    },
  },
  'politique-confidentialite.html': {
    locale: 'fr',
    canonicalPath: '/politique-confidentialite.html',
    pageKind: 'default',
    alternates: {
      fr: '/politique-confidentialite.html',
      en: '/en/privacy-policy.html',
      xDefault: '/politique-confidentialite.html',
    },
  },
  'en/index.html': {
    locale: 'en',
    canonicalPath: '/en/',
    pageKind: 'home',
    alternates: {
      fr: '/',
      en: '/en/',
      xDefault: '/',
    },
  },
  'en/about.html': {
    locale: 'en',
    canonicalPath: '/en/about.html',
    pageKind: 'default',
    alternates: {
      fr: '/a-propos.html',
      en: '/en/about.html',
      xDefault: '/a-propos.html',
    },
  },
  'en/portfolio.html': {
    locale: 'en',
    canonicalPath: '/en/portfolio.html',
    pageKind: 'portfolio',
    portfolioKey: 'main',
    alternates: {
      fr: '/portfolio.html',
      en: '/en/portfolio.html',
      xDefault: '/portfolio.html',
    },
  },
  'en/polas.html': {
    locale: 'en',
    canonicalPath: '/en/polas.html',
    pageKind: 'portfolio',
    portfolioKey: 'polas',
    alternates: {
      fr: '/polas.html',
      en: '/en/polas.html',
      xDefault: '/polas.html',
    },
  },
  'en/contact.html': {
    locale: 'en',
    canonicalPath: '/en/contact.html',
    pageKind: 'default',
    alternates: {
      fr: '/contact.html',
      en: '/en/contact.html',
      xDefault: '/contact.html',
    },
  },
  'en/legal-notice.html': {
    locale: 'en',
    canonicalPath: '/en/legal-notice.html',
    pageKind: 'default',
    alternates: {
      fr: '/mentions-legales.html',
      en: '/en/legal-notice.html',
      xDefault: '/mentions-legales.html',
    },
  },
  'en/privacy-policy.html': {
    locale: 'en',
    canonicalPath: '/en/privacy-policy.html',
    pageKind: 'default',
    alternates: {
      fr: '/politique-confidentialite.html',
      en: '/en/privacy-policy.html',
      xDefault: '/politique-confidentialite.html',
    },
  },
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const escapeAttribute = (value) => escapeHtml(value).replace(/'/g, '&#39;');

const toAbsoluteUrl = (pathname) => `${SITE_URL}${pathname}`;

const getRelativePageKey = (projectRoot, context = {}) => {
  if (context.filename) {
    return path.relative(projectRoot, context.filename).replace(/\\/g, '/');
  }

  const normalizedPath = String(context.path || '/')
    .replace(/^\//, '')
    .trim();

  if (!normalizedPath) {
    return 'index.html';
  }

  if (normalizedPath.endsWith('/')) {
    return `${normalizedPath}index.html`;
  }

  return normalizedPath;
};

const replaceTag = (html, pattern, replacement) => {
  const matcher = new RegExp(pattern.source, pattern.flags);
  return matcher.test(html) ? html.replace(pattern, replacement) : null;
};

const insertHeadTag = (html, tagMarkup) => html.replace(/<\/head>/i, `  ${tagMarkup}\n  </head>`);

const upsertCanonical = (html, href) =>
  replaceTag(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeAttribute(href)}" />`
  ) || insertHeadTag(html, `<link rel="canonical" href="${escapeAttribute(href)}" />`);

const upsertAlternate = (html, hreflang, href) =>
  replaceTag(
    html,
    new RegExp(`<link\\s+rel="alternate"\\s+hreflang="${hreflang}"\\s+href="[^"]*"\\s*\\/?>`, 'i'),
    `<link rel="alternate" hreflang="${hreflang}" href="${escapeAttribute(href)}" />`
  ) || insertHeadTag(html, `<link rel="alternate" hreflang="${hreflang}" href="${escapeAttribute(href)}" />`);

const upsertMetaByName = (html, name, content) =>
  replaceTag(
    html,
    new RegExp(`<meta\\s+name="${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"\\s+content="[^"]*"\\s*\\/?>`, 'i'),
    `<meta name="${name}" content="${escapeAttribute(content)}" />`
  ) || insertHeadTag(html, `<meta name="${name}" content="${escapeAttribute(content)}" />`);

const upsertMetaByProperty = (html, property, content) =>
  replaceTag(
    html,
    new RegExp(`<meta\\s+property="${property.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}"\\s+content="[^"]*"\\s*\\/?>`, 'i'),
    `<meta property="${property}" content="${escapeAttribute(content)}" />`
  ) || insertHeadTag(html, `<meta property="${property}" content="${escapeAttribute(content)}" />`);

const injectHeadJsonLd = (html, jsonLd) => {
  const sanitized = html.replace(/\s*<script type="application\/ld\+json" data-seo-json-ld>[\s\S]*?<\/script>/gi, '');
  return sanitized.replace(
    /<\/head>/i,
    `  <script type="application/ld+json" data-seo-json-ld>${JSON.stringify(jsonLd)}</script>\n  </head>`
  );
};

const removeTailwindCdn = (html) => html.replace(/\s*<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/gi, '\n');

const createPortfolioStatusMarkup = (payload) => {
  if (payload.notice) {
    const state = payload.source === 'demo' ? 'warning' : 'info';
    return `<p class="portfolio-status" data-portfolio-status data-state="${state}">${escapeHtml(payload.notice)}</p>`;
  }

  return '<p class="portfolio-status" data-portfolio-status hidden></p>';
};

const createPortfolioTypeButtonsMarkup = (payload) =>
  (Array.isArray(payload.typeFilters) ? payload.typeFilters : [])
    .map(
      (filter, index) =>
        `<button type="button" class="portfolio-type-button${index === 0 ? ' is-active' : ''}" data-media-filter="${escapeAttribute(
          filter.id
        )}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(filter.label)}</button>`
    )
    .join('');

const createPortfolioCategoryButtonsMarkup = (payload) =>
  (Array.isArray(payload.filters) ? payload.filters : [])
    .map(
      (filter, index) =>
        `<button type="button" class="portfolio-filter-button${index === 0 ? ' is-active' : ''}" data-filter="${escapeAttribute(
          filter.id
        )}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(filter.label)}</button>`
    )
    .join('');

const createPortfolioItemsMarkup = (payload, locale) =>
  (Array.isArray(payload.items) ? payload.items : [])
    .map((item) => {
      const mediaType = item.mediaType || 'photo';
      const isYoutube = item.lightboxKind === 'youtube';
      const className = `portfolio-card portfolio-item${mediaType === 'video' ? ' is-video' : ''}${isYoutube ? ' is-youtube' : ''}`;
      const attrs = [
        `class="${className}"`,
        `href="${escapeAttribute(item.lightboxSrc || item.fullSrc || item.src || '#')}"`,
        'data-lightbox=""',
        `data-categorie="${escapeAttribute(item.category || 'autres')}"`,
        `data-media-type="${escapeAttribute(mediaType)}"`,
        `aria-label="${escapeAttribute(locale === 'en' ? `Open media: ${item.alt || ''}` : `Ouvrir le media : ${item.alt || ''}`)}"`,
      ];

      if (item.lightboxKind) {
        attrs.push(`data-lightbox-kind="${escapeAttribute(item.lightboxKind)}"`);
      }

      if (item.embedSrc) {
        attrs.push(`data-embed-src="${escapeAttribute(item.embedSrc)}"`);
      }

      if (item.displayTitle || item.alt) {
        attrs.push(`data-embed-title="${escapeAttribute(item.displayTitle || item.alt)}"`);
      }

      const imageAttributes = [
        `src="${escapeAttribute(mediaType === 'video' ? item.posterSrc || item.src : item.src)}"`,
        item.srcset ? `srcset="${escapeAttribute(mediaType === 'video' ? item.posterSrcset || item.srcset : item.srcset)}"` : '',
        'sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"',
        `width="${escapeAttribute(item.width || 900)}"`,
        `height="${escapeAttribute(item.height || 1125)}"`,
        'loading="lazy"',
        'decoding="async"',
        `alt="${escapeAttribute(item.alt || '')}"`,
      ]
        .filter(Boolean)
        .join(' ');

      return `<a ${attrs.join(' ')}><img ${imageAttributes} />${
        isYoutube ? '<span class="portfolio-card__provider">YouTube</span>' : ''
      }</a>`;
    })
    .join('');

const buildPortfolioJsonLd = (pageConfig, payload) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name:
    pageConfig.portfolioKey === 'polas'
      ? pageConfig.locale === 'en'
        ? 'Clarisse Bonneu polas'
        : 'Polas Clarisse Bonneu'
      : pageConfig.locale === 'en'
        ? 'Clarisse Bonneu portfolio'
        : 'Portfolio Clarisse Bonneu',
  inLanguage: pageConfig.locale === 'en' ? 'en' : 'fr',
  url: toAbsoluteUrl(pageConfig.canonicalPath),
  isPartOf: {
    '@id': `${SITE_URL}#website`,
  },
  about: {
    '@id': `${SITE_URL}#person`,
  },
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: (Array.isArray(payload.items) ? payload.items : []).slice(0, 24).map((item, index) => ({
      '@type': item.mediaType === 'video' ? 'VideoObject' : 'ImageObject',
      position: index + 1,
      name: item.displayTitle || item.alt || `Portfolio item ${index + 1}`,
      description: item.alt || '',
      contentUrl: item.fullSrc || item.lightboxSrc || item.src || '',
      thumbnailUrl: item.posterSrc || item.src || '',
      width: item.width || undefined,
      height: item.height || undefined,
    })),
  },
});

const buildHomeJsonLd = (pageConfig) => {
  const language = pageConfig.locale === 'en' ? 'en' : 'fr';
  const description =
    pageConfig.locale === 'en'
      ? 'Professional portfolio for fashion, beauty and editorial model Clarisse Bonneu.'
      : 'Portfolio professionnel de Clarisse Bonneu, mannequin mode, beaute et editorial.';

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Clarisse Bonneu',
      inLanguage: language,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': `${SITE_URL}#person`,
      name: 'Clarisse Bonneu',
      url: toAbsoluteUrl(pageConfig.canonicalPath),
      image: SEO_IMAGE_URL,
      jobTitle: pageConfig.locale === 'en' ? 'Fashion, beauty and editorial model' : 'Mannequin mode, beaute et editorial',
      description,
      sameAs: ['https://clarissebonneu.book.fr/', 'https://www.instagram.com/bonneu_clarisse'],
    },
  ];
};

const applySeoTags = (html, pageConfig) => {
  const canonicalUrl = toAbsoluteUrl(pageConfig.canonicalPath);
  let nextHtml = removeTailwindCdn(html);
  nextHtml = upsertCanonical(nextHtml, canonicalUrl);
  nextHtml = upsertAlternate(nextHtml, 'fr', toAbsoluteUrl(pageConfig.alternates.fr));
  nextHtml = upsertAlternate(nextHtml, 'en', toAbsoluteUrl(pageConfig.alternates.en));
  nextHtml = upsertAlternate(nextHtml, 'x-default', toAbsoluteUrl(pageConfig.alternates.xDefault));
  nextHtml = upsertMetaByProperty(nextHtml, 'og:url', canonicalUrl);
  nextHtml = upsertMetaByProperty(nextHtml, 'og:image', SEO_IMAGE_URL);
  nextHtml = upsertMetaByProperty(nextHtml, 'og:image:secure_url', SEO_IMAGE_URL);
  nextHtml = upsertMetaByProperty(nextHtml, 'og:image:width', String(SEO_IMAGE_WIDTH));
  nextHtml = upsertMetaByProperty(nextHtml, 'og:image:height', String(SEO_IMAGE_HEIGHT));
  nextHtml = upsertMetaByName(nextHtml, 'twitter:image', SEO_IMAGE_URL);
  nextHtml = upsertMetaByName(nextHtml, 'twitter:image:alt', pageConfig.locale === 'en' ? 'Clarisse Bonneu portrait' : 'Portrait de Clarisse Bonneu');
  nextHtml = upsertMetaByName(nextHtml, 'theme-color', '#050505');
  return nextHtml;
};

const preRenderPortfolioPage = async (html, pageConfig) => {
  const payload = await getPortfolioPayload(pageConfig.portfolioKey || 'main', pageConfig.locale);
  let nextHtml = html;

  nextHtml = nextHtml.replace(
    /(<nav[^>]*data-portfolio-type-filters[^>]*>)([\s\S]*?)(<\/nav>)/i,
    `$1${createPortfolioTypeButtonsMarkup(payload)}$3`
  );
  nextHtml = nextHtml.replace(
    /(<nav[^>]*data-portfolio-category-filters[^>]*>)([\s\S]*?)(<\/nav>)/i,
    `$1${createPortfolioCategoryButtonsMarkup(payload)}$3`
  );
  nextHtml = nextHtml.replace(
    /<p[^>]*data-portfolio-status[^>]*>[\s\S]*?<\/p>/i,
    createPortfolioStatusMarkup(payload)
  );
  nextHtml = nextHtml.replace(
    /(<div[^>]*data-portfolio-grid[^>]*>)([\s\S]*?)(<\/div>)/i,
    `$1${createPortfolioItemsMarkup(payload, pageConfig.locale)}$3`
  );

  return injectHeadJsonLd(nextHtml, buildPortfolioJsonLd(pageConfig, payload));
};

const getLastModifiedDate = async (projectRoot, pageKey) => {
  const stats = await fs.stat(path.join(projectRoot, pageKey));
  return stats.mtime.toISOString().slice(0, 10);
};

const buildSitemapXml = async (projectRoot) => {
  const entries = await Promise.all(
    Object.entries(PUBLIC_PAGE_CONFIG).map(async ([pageKey, pageConfig]) => ({
      pageConfig,
      lastmod: await getLastModifiedDate(projectRoot, pageKey),
    }))
  );

  const body = entries
    .map(
      ({ pageConfig, lastmod }) => `  <url>
    <loc>${toAbsoluteUrl(pageConfig.canonicalPath)}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr" href="${toAbsoluteUrl(pageConfig.alternates.fr)}" />
    <xhtml:link rel="alternate" hreflang="en" href="${toAbsoluteUrl(pageConfig.alternates.en)}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${toAbsoluteUrl(pageConfig.alternates.xDefault)}" />
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
};

const ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

export const seoHtmlPlugin = (projectRoot) => ({
  name: 'seo-html',
  async transformIndexHtml(html, context) {
    const pageKey = getRelativePageKey(projectRoot, context);
    const pageConfig = PUBLIC_PAGE_CONFIG[pageKey];
    const baseHtml = removeTailwindCdn(html);

    if (!pageConfig) {
      return baseHtml;
    }

    const nextHtml = applySeoTags(baseHtml, pageConfig);

    if (pageConfig.pageKind === 'portfolio') {
      return preRenderPortfolioPage(nextHtml, pageConfig);
    }

    if (pageConfig.pageKind === 'home') {
      return injectHeadJsonLd(nextHtml, buildHomeJsonLd(pageConfig));
    }

    return nextHtml;
  },
});

export const sitemapPlugin = (projectRoot) => {
  let resolvedOutDir = path.join(projectRoot, 'dist');

  return {
    name: 'seo-sitemap',
    apply: 'build',
    configResolved(config) {
      resolvedOutDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await fs.mkdir(resolvedOutDir, { recursive: true });
      await fs.writeFile(path.join(resolvedOutDir, 'robots.txt'), ROBOTS_TXT, 'utf8');
      await fs.writeFile(path.join(resolvedOutDir, 'sitemap.xml'), await buildSitemapXml(projectRoot), 'utf8');
    },
  };
};
