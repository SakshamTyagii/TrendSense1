import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth';

const NEWS_API_KEY = process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  if (!NEWS_API_KEY) {
    return res.status(500).json({ error: 'News API key not configured on server' });
  }

  const { category, query } = req.query;

  let url: string;
  if (query) {
    url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(String(query))}&sortBy=publishedAt&pageSize=50&language=en`;
  } else if (category) {
    const categoryMap: Record<string, string> = {
      tech: 'technology', politics: 'general', finance: 'business',
      sports: 'sports', entertainment: 'entertainment', world: 'general',
    };
    const apiCategory = categoryMap[String(category)] || 'general';
    url = `https://newsapi.org/v2/top-headlines?category=${apiCategory}&pageSize=50&language=en&country=us`;
  } else {
    url = `https://newsapi.org/v2/top-headlines?pageSize=50&language=en&country=us`;
  }

  try {
    const response = await fetch(url, {
      headers: { 'X-Api-Key': NEWS_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `NewsAPI error: ${errText}` });
    }

    const data = await response.json();
    // Cache for 5 minutes on CDN edge
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch news' });
  }
}
