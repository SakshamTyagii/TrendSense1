import type { NewsItem, Category } from '../types';
import { apiFetch } from './apiFetch';

const isDev = import.meta.env.DEV;
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY || '';
const NEWS_API_BASE = 'https://newsapi.org/v2';

// ─── Retry with exponential backoff ────────────────────────────────────

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      // Don't retry on client errors (4xx), only on server errors (5xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      if (attempt === retries - 1) return response;
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
    // Exponential backoff: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw new Error('Max retries reached');
}

async function apiFetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await apiFetch(url);
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      if (attempt === retries - 1) return response;
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
  }
  throw new Error('Max retries reached');
}

function categorizeArticle(title: string, description: string): Category {
  const text = `${title} ${description}`.toLowerCase();
  if (/tech|ai |artificial intelligence|software|startup|crypto|blockchain|app |digital|silicon|chip|robot/.test(text)) return 'tech';
  if (/politic|election|government|congress|senate|parliament|president|democrat|republican|vote|law|legislation/.test(text)) return 'politics';
  if (/financ|econom|stock|market|bank|invest|trading|gdp|inflation|dow|nasdaq|fed |interest rate/.test(text)) return 'finance';
  if (/sport|football|soccer|basketball|tennis|olympic|nba|nfl|fifa|cricket|golf|f1|formula/.test(text)) return 'sports';
  if (/entertain|movie|film|music|celebrity|award|oscar|grammy|netflix|disney|game|stream/.test(text)) return 'entertainment';
  return 'world';
}

const categoryToQuery: Record<Category, string> = {
  tech: 'technology OR AI OR software',
  politics: 'politics OR government OR election',
  finance: 'finance OR stock market OR economy',
  sports: 'sports OR football OR basketball',
  entertainment: 'entertainment OR movies OR music',
  world: 'world news OR international',
};

async function fetchFromApi(category?: Category, query?: string): Promise<any> {
  if (isDev && NEWS_API_KEY) {
    // Dev mode: call NewsAPI directly (API key is only in local .env, never in production build)
    const searchQuery = query || (category ? categoryToQuery[category] : 'trending news');
    const url = `${NEWS_API_BASE}/everything?q=${encodeURIComponent(searchQuery)}&sortBy=publishedAt&pageSize=30&language=en&apiKey=${NEWS_API_KEY}`;
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Failed to fetch news' }));
      throw new Error(err.message || `News API error (${response.status})`);
    }
    return response.json();
  }

  // Production: call server-side proxy — API key is NEVER in the browser
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  else if (category) params.set('category', category);

  const response = await apiFetchWithRetry(`/api/news?${params.toString()}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to fetch news' }));
    throw new Error(err.error || `News API error (${response.status})`);
  }
  return response.json();
}

export async function fetchNews(category?: Category, query?: string): Promise<NewsItem[]> {
  const data = await fetchFromApi(category, query);

  if (!data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
    throw new Error('No articles found. Try a different category or search query.');
  }

  const articles = data.articles
    .filter((a: any) => {
      // Validate required fields exist and aren't [Removed]
      if (!a || typeof a !== 'object') return false;
      if (!a.title || !a.description) return false;
      if (a.title === '[Removed]' || a.description === '[Removed]') return false;
      return true;
    })
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
