const ROUTES = {
  home: {
    fr: '/index.html',
    en: '/en/index.html',
    aliases: ['/', '/index.html', '/en/', '/en/index.html'],
  },
  about: {
    fr: '/a-propos.html',
    en: '/en/about.html',
    aliases: ['/a-propos.html', '/en/about.html'],
  },
  portfolio: {
    fr: '/portfolio.html',
    en: '/en/portfolio.html',
    aliases: ['/portfolio.html', '/en/portfolio.html'],
  },
  polas: {
    fr: '/polas.html',
    en: '/en/polas.html',
    aliases: ['/polas.html', '/en/polas.html'],
  },
  contact: {
    fr: '/contact.html',
    en: '/en/contact.html',
    aliases: ['/contact.html', '/en/contact.html'],
  },
  legalNotice: {
    fr: '/mentions-legales.html',
    en: '/en/legal-notice.html',
    aliases: ['/mentions-legales.html', '/en/legal-notice.html'],
  },
  privacyPolicy: {
    fr: '/politique-confidentialite.html',
    en: '/en/privacy-policy.html',
    aliases: ['/politique-confidentialite.html', '/en/privacy-policy.html'],
  },
};

const PATH_TO_ROUTE = Object.entries(ROUTES).reduce((accumulator, [routeKey, route]) => {
  route.aliases.forEach((pathname) => {
    accumulator[pathname] = routeKey;
  });
  return accumulator;
}, {});

export const runtimeTranslations = {
  fr: {
    menuOpen: 'Ouvrir le menu',
    menuClose: 'Fermer le menu',
    lightboxClose: "Fermer l'image",
    lightboxOpen: (alt) => `Ouvrir ${alt.toLowerCase()} en plein écran`,
    lightboxFallbackAlt: 'Photographie éditoriale de Clarisse Bonneu',
    portfolioAll: 'Tout',
    portfolioEmpty: "Aucun contenu n'est disponible dans cette sélection pour le moment.",
    portfolioRequestError: 'Une erreur est survenue lors du chargement du portfolio.',
    portfolioLoadError: 'Le portfolio ne peut pas être chargé pour le moment.',
    contactIdle: 'Votre demande est prête à être envoyée.',
    contactSuccess:
      'Merci, votre demande a bien été transmise. Une réponse vous sera adressée dans les meilleurs délais.',
    contactError: "Une erreur est survenue lors de l'envoi. Merci de réessayer dans un instant.",
    contactInvalid: "Merci de compléter les champs obligatoires avant l'envoi.",
    contactSending: 'Envoi de votre demande...',
    contactSendingButton: 'Envoi en cours...',
    contactSubmit: 'Envoyer la demande',
    cookieTitle: 'Cookies',
    cookieDescription:
      'Nous utilisons des cookies pour mesurer l’audience et améliorer l’expérience. Vous pouvez accepter, refuser ou personnaliser vos choix.',
    cookieAcceptAll: 'Tout accepter',
    cookieRejectAll: 'Tout refuser',
    cookieCustomize: 'Personnaliser',
    cookieSave: 'Enregistrer',
    cookiePrivacyLink: 'Politique de confidentialité',
    cookieAnalyticsLabel: 'Mesure d’audience',
    cookieAnalyticsHint: 'Permet de comprendre l’usage du site (Google Analytics, etc.).',
    cookieMarketingLabel: 'Publicité & personnalisation',
    cookieMarketingHint: 'Permet des contenus et publicités personnalisés (Google Ads, etc.).',
  },
  en: {
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    lightboxClose: 'Close image',
    lightboxOpen: (alt) => `Open ${alt.toLowerCase()} full screen`,
    lightboxFallbackAlt: 'Clarisse Bonneu editorial photography',
    portfolioAll: 'All',
    portfolioEmpty: 'No content is currently available in this selection.',
    portfolioRequestError: 'An error occurred while loading the portfolio.',
    portfolioLoadError: 'The portfolio cannot be loaded at the moment.',
    contactIdle: 'Your inquiry is ready to be sent.',
    contactSuccess:
      'Thank you, your inquiry has been successfully delivered. A reply will be sent as soon as possible.',
    contactError: 'An error occurred while sending your inquiry. Please try again shortly.',
    contactInvalid: 'Please complete the required fields before submitting.',
    contactSending: 'Sending your inquiry...',
    contactSendingButton: 'Sending...',
    contactSubmit: 'Send inquiry',
    cookieTitle: 'Cookies',
    cookieDescription:
      'We use cookies to measure traffic and improve your experience. You can accept, reject, or customize your choices.',
    cookieAcceptAll: 'Accept all',
    cookieRejectAll: 'Reject all',
    cookieCustomize: 'Customize',
    cookieSave: 'Save',
    cookiePrivacyLink: 'Privacy policy',
    cookieAnalyticsLabel: 'Analytics',
    cookieAnalyticsHint: 'Helps us understand site usage (Google Analytics, etc.).',
    cookieMarketingLabel: 'Ads & personalization',
    cookieMarketingHint: 'Enables personalized content and ads (Google Ads, etc.).',
  },
};

const normalizePathname = (pathname) => {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
};

export const normalizeLocale = (locale) => (locale === 'en' ? 'en' : 'fr');

export const getCurrentLocale = () =>
  normalizeLocale(document.documentElement.lang?.slice(0, 2) || document.body.dataset.locale);

export const getRouteKeyFromPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);
  return PATH_TO_ROUTE[normalizedPath] || 'home';
};

export const getLocalizedPath = (routeKey, locale) => {
  const normalizedLocale = normalizeLocale(locale);
  return ROUTES[routeKey]?.[normalizedLocale] || ROUTES.home[normalizedLocale];
};

export const getAlternatePath = (pathname, locale) =>
  getLocalizedPath(getRouteKeyFromPath(pathname), locale);
