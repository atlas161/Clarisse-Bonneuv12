const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .trim();

export const PORTFOLIO_MAIN_KEY = 'main';
export const PORTFOLIO_POLAS_KEY = 'polas';

export const isPathInsideRoot = (pathValue, rootValue) => {
  const normalizedPath = normalizePath(pathValue);
  const normalizedRoot = normalizePath(rootValue);

  if (!normalizedPath || !normalizedRoot) {
    return false;
  }

  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
};

export const getPortfolioAssetRoot = () =>
  normalizePath(process.env.PORTFOLIO_CLOUDINARY_ROOT || 'samples/clarisse_bonneu');

export const getPortfolioDefinitions = () => {
  const assetRoot = getPortfolioAssetRoot();
  const polasRoot = normalizePath(process.env.PORTFOLIO_POLAS_ROOT || `${assetRoot}/__polas`);

  return [
    {
      key: PORTFOLIO_MAIN_KEY,
      assetRoot,
      logicalRoot: assetRoot,
      labels: {
        fr: 'Portfolio 1',
        en: 'Portfolio 1',
      },
      publicNames: {
        fr: 'Portfolio',
        en: 'Portfolio',
      },
      adminDescriptions: {
        fr: 'Portfolio principal',
        en: 'Main portfolio',
      },
      pageTitles: {
        fr: 'Portfolio',
        en: 'Portfolio',
      },
      publicPaths: {
        fr: '/portfolio.html',
        en: '/en/portfolio.html',
      },
      seo: {
        fr: {
          title: 'Portfolio | Clarisse Bonneu - Mannequin Mode et Beauté',
          description:
            'Consultez le portfolio de Clarisse Bonneu, mannequin mode et beauté, avec des séries éditoriales, campagnes, portraits et contenus dédiés aux agences et marques.',
          heading: 'Portfolio mode, beauté et éditorial',
          intro:
            "Une sélection de visuels conçue pour permettre aux agences et aux marques d'identifier rapidement les univers, les séries et les registres d'image disponibles.",
          eyebrow: 'Sélection',
          ogAlt: 'Aperçu du portfolio de Clarisse Bonneu',
        },
        en: {
          title: 'Portfolio | Clarisse Bonneu - Fashion and Beauty Model',
          description:
            'Explore the Clarisse Bonneu portfolio with editorial series, campaigns, portraits and curated visual references for agencies, brands and creative teams.',
          heading: 'Fashion, beauty and editorial portfolio',
          intro:
            'A curated selection of visuals designed to help agencies and brands quickly review image directions, categories and available visual references.',
          eyebrow: 'Selection',
          ogAlt: 'Clarisse Bonneu portfolio preview',
        },
      },
    },
    {
      key: PORTFOLIO_POLAS_KEY,
      assetRoot,
      logicalRoot: polasRoot,
      labels: {
        fr: 'Portfolio 2',
        en: 'Portfolio 2',
      },
      publicNames: {
        fr: 'Polas',
        en: 'Polas',
      },
      adminDescriptions: {
        fr: 'Polas mannequin',
        en: 'Model polas',
      },
      pageTitles: {
        fr: 'Polas',
        en: 'Polas',
      },
      publicPaths: {
        fr: '/polas.html',
        en: '/en/polas.html',
      },
      seo: {
        fr: {
          title: 'Polas | Clarisse Bonneu - Mannequin Mode',
          description:
            'Consultez les polas de Clarisse Bonneu, des visuels naturels pensés pour permettre aux agences, directeurs de casting et clients d’évaluer la présence, les lignes et la photogénie sans artifice.',
          heading: 'Polas mannequin',
          intro:
            'Des polas sobres et lisibles pour offrir une vision directe du profil, de la présence et des proportions, dans un format utile aux agences, castings et productions.',
          eyebrow: 'Polas',
          ogAlt: 'Aperçu des polas de Clarisse Bonneu',
        },
        en: {
          title: 'Polas | Clarisse Bonneu - Fashion Model',
          description:
            'Explore Clarisse Bonneu polas, natural reference images designed to help agencies, casting directors and clients assess presence, proportions and photogenic qualities with clarity.',
          heading: 'Model polas',
          intro:
            'Clean and direct polas designed to present profile, presence and proportions in a format that supports agencies, castings and production teams.',
          eyebrow: 'Polas',
          ogAlt: 'Clarisse Bonneu polas preview',
        },
      },
    },
  ];
};

export const getDefaultPortfolioKey = () => PORTFOLIO_MAIN_KEY;

export const getPortfolioDefinition = (input) => {
  const definitions = getPortfolioDefinitions();
  const normalizedInput = normalizePath(input).toLowerCase();

  if (normalizedInput) {
    const directMatch = definitions.find(
      (definition) =>
        definition.key.toLowerCase() === normalizedInput ||
        definition.logicalRoot.toLowerCase() === normalizedInput
    );

    if (directMatch) {
      return directMatch;
    }
  }

  return definitions.find((definition) => definition.key === getDefaultPortfolioKey()) || definitions[0];
};

export const getPortfolioDefinitionByPath = (pathValue) => {
  const normalizedPath = normalizePath(pathValue);
  const definitions = [...getPortfolioDefinitions()].sort(
    (left, right) => right.logicalRoot.length - left.logicalRoot.length
  );

  return definitions.find((definition) => isPathInsideRoot(normalizedPath, definition.logicalRoot)) || null;
};

export const isPathOwnedByPortfolio = (pathValue, portfolioInput) => {
  const normalizedPath = normalizePath(pathValue);
  const portfolio = getPortfolioDefinition(portfolioInput);

  if (!isPathInsideRoot(normalizedPath, portfolio.logicalRoot)) {
    return false;
  }

  const moreSpecificMatch = getPortfolioDefinitionByPath(normalizedPath);
  return !moreSpecificMatch || moreSpecificMatch.key === portfolio.key;
};

export const listPortfolioSummaries = (locale = 'fr') =>
  getPortfolioDefinitions().map((definition) => ({
    key: definition.key,
    root: definition.logicalRoot,
    assetRoot: definition.assetRoot,
    label: definition.labels[locale === 'en' ? 'en' : 'fr'],
    publicName: definition.publicNames[locale === 'en' ? 'en' : 'fr'],
    adminDescription: definition.adminDescriptions[locale === 'en' ? 'en' : 'fr'],
    publicPath: definition.publicPaths[locale === 'en' ? 'en' : 'fr'],
  }));

export const getPortfolioDisplayName = (portfolioInput, locale = 'fr') => {
  const portfolio = getPortfolioDefinition(portfolioInput);
  return portfolio.publicNames[locale === 'en' ? 'en' : 'fr'];
};

export const stripPortfolioRoot = (pathValue, portfolioInput) => {
  const portfolio = getPortfolioDefinition(portfolioInput);
  const normalizedPath = normalizePath(pathValue);

  if (!isPathInsideRoot(normalizedPath, portfolio.logicalRoot)) {
    return normalizedPath;
  }

  return normalizedPath === portfolio.logicalRoot
    ? ''
    : normalizedPath.slice(portfolio.logicalRoot.length + 1);
};
