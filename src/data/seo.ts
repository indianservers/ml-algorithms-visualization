import { getAlgorithmByRoute, getAllAlgorithms, getImplementationStatus } from './implementationStatus';
import { navigationData } from './navigation';

export const siteConfig = {
  name: 'Mega ML Algorithms Suite',
  domain: 'https://www.AimerSociety.com',
  description:
    'Interactive browser-based machine learning visualizations, algorithm workbenches, datasets, metrics, and learning labs.',
  keywords: [
    'machine learning algorithms',
    'ML visualization',
    'AI learning tools',
    'browser machine learning',
    'algorithm workbench',
    'data science education',
  ],
};

export type SeoRoute = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  priority: number;
  changeFrequency: 'weekly' | 'monthly';
};

const normalizePath = (path: string) => (path === '/' ? '/' : path.replace(/\/+$/, ''));

export function routeToUrl(path: string) {
  return `${siteConfig.domain}${path === '/' ? '/' : normalizePath(path)}`;
}

export function getSeoMetadata(pathname: string): SeoRoute {
  const path = normalizePath(pathname);
  const algorithm = getAlgorithmByRoute(path);

  if (algorithm) {
    const status = getImplementationStatus(algorithm.route);
    return {
      path: algorithm.route,
      title: `${algorithm.label} Visualization | ${siteConfig.name}`,
      description: `${algorithm.label} in ${algorithm.category}: an interactive ${algorithm.badge.toLowerCase()} machine learning module with ${status.toLowerCase()} browser learning tools, visual explanations, and experiment details.`,
      keywords: [
        algorithm.label,
        algorithm.category,
        algorithm.badge,
        status,
        'machine learning',
        'interactive visualization',
        'algorithm tutorial',
      ],
      priority: status === 'Implemented' ? 0.8 : 0.6,
      changeFrequency: 'monthly',
    };
  }

  if (path === '/documentation') {
    return {
      path,
      title: `Documentation | ${siteConfig.name}`,
      description: 'Complete documentation index for every machine learning category, algorithm module, lab, status, and route in the Mega ML Algorithms Suite.',
      keywords: ['documentation', 'machine learning documentation', 'algorithm links', 'ML route index'],
      priority: 0.9,
      changeFrequency: 'weekly',
    };
  }

  if (path === '/sitemap') {
    return {
      path,
      title: `Sitemap | ${siteConfig.name}`,
      description: 'Search engine sitemap index for all public machine learning visualization pages and documentation routes.',
      keywords: ['sitemap', 'search engine index', 'ML algorithms sitemap'],
      priority: 0.7,
      changeFrequency: 'weekly',
    };
  }

  if (path === '/implementation-matrix') {
    return {
      path,
      title: `Implementation Matrix | ${siteConfig.name}`,
      description: 'Implementation status matrix covering every algorithm, concept page, browser-trainable lab, and educational module.',
      keywords: ['implementation matrix', 'algorithm status', 'ML modules'],
      priority: 0.7,
      changeFrequency: 'weekly',
    };
  }

  return {
    path: '/',
    title: siteConfig.name,
    description: siteConfig.description,
    keywords: siteConfig.keywords,
    priority: 1,
    changeFrequency: 'weekly',
  };
}

export function getAllSeoRoutes(): SeoRoute[] {
  return [
    getSeoMetadata('/'),
    getSeoMetadata('/documentation'),
    getSeoMetadata('/sitemap'),
    getSeoMetadata('/implementation-matrix'),
    ...getAllAlgorithms().map(item => getSeoMetadata(item.route)),
  ];
}

export function getDocumentationGroups() {
  return navigationData.map(category => ({
    ...category,
    items: category.items.map(item => ({
      ...item,
      status: getImplementationStatus(item.route),
      metadata: getSeoMetadata(item.route),
    })),
  }));
}
