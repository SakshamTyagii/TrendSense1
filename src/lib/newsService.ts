import type { NewsItem, Category } from '../types';
import { apiFetch } from './apiFetch';

// ─── Retry with exponential backoff ────────────────────────────────────

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

async function fetchFromApi(category?: Category, query?: string): Promise<any> {
  // Always use server-side proxy — API key is NEVER in the browser bundle
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

      // Stable ID derived from the article URL so it survives page reloads.
      // Falls back to title-based hash if URL is missing.
      const raw = article.url || article.title || `${index}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
      }
      const stableId = `news-${Math.abs(hash).toString(36)}`;

      return {
        id: stableId,
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
