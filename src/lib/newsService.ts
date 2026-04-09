import { config } from './config';
import type { NewsItem, Category } from '../types';

const CATEGORY_MAP: Record<Category, string> = {
  tech: 'technology',
  politics: 'general',
  finance: 'business',
  sports: 'sports',
  entertainment: 'entertainment',
  world: 'general',
};

function categorizeArticle(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase();
  if (/tech|ai |artificial intelligence|software|startup|crypto|blockchain|app |digital|silicon|chip|robot/.test(text)) return 'tech';
  if (/politic|election|government|congress|senate|parliament|president|democrat|republican|vote|law|legislation/.test(text)) return 'politics';
  if (/financ|econom|stock|market|bank|invest|trading|gdp|inflation|dow|nasdaq|fed |interest rate/.test(text)) return 'finance';
  if (/sport|football|soccer|basketball|tennis|olympic|nba|nfl|fifa|cricket|golf|f1|formula/.test(text)) return 'sports';
  if (/entertain|movie|film|music|celebrity|award|oscar|grammy|netflix|disney|game|stream/.test(text)) return 'entertainment';
  return 'world';
}

export async function fetchNews(category?: Category, query?: string): Promise<NewsItem[]> {
  if (!config.hasNewsApi) {
    throw new Error('News API key is not configured. Add VITE_NEWS_API_KEY to your .env file.');
  }

  let url: string;

  if (query) {
    // Use "everything" endpoint for search queries — broader results
    url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=50&language=en`;
  } else if (category) {
    // Use "top-headlines" with category for category browsing
    const apiCategory = CATEGORY_MAP[category];
    url = `https://newsapi.org/v2/top-headlines?category=${apiCategory}&pageSize=50&language=en&country=us`;
  } else {
    // Default: top headlines across all categories
    url = `https://newsapi.org/v2/top-headlines?pageSize=50&language=en&country=us`;
  }

  const response = await fetch(url, {
    headers: { 'X-Api-Key': config.newsApiKey },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`News API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  if (!data.articles || data.articles.length === 0) {
    throw new Error('No articles found. Try a different category or search query.');
  }

  const articles = data.articles
    .filter((a: any) => a.title && a.description && a.title !== '[Removed]' && a.description !== '[Removed]')
    .map((article: any, index: number) => {
      const sourceName = article.source?.name || 'Unknown';
      const cat = categorizeArticle(article.title, article.description);

      return {
        id: `news-${Date.now()}-${index}`,
        title: article.title,
        description: article.description,
        explanation: '',
        whyTrending: '',
        whyMatters: '',
        category: category || cat,
        source: sourceName as any,
        sourceUrl: article.url,
        imageUrl: article.urlToImage || `/images/category-${cat}.jpg`,
        publishedAt: article.publishedAt,
        trendScore: Math.floor(Math.random() * 40) + 60,
        tags: [],
      } as NewsItem;
    });

  if (articles.length === 0) {
    throw new Error('No articles found after filtering. Try a different category or search query.');
  }

  return articles;
}

export async function searchNews(query: string): Promise<NewsItem[]> {
  return fetchNews(undefined, query);
}
