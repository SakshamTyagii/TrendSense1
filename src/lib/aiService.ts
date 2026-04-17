import { getCached, setCache } from './aiCache';
import { apiFetch } from './apiFetch';
import type { NewsItem, CreatorScript, TrendAnalysis } from '../types';

// ─── AI call with dev fallback ─────────────────────────────────────────
// Production: calls /api/ai proxy (keys on server)
// Dev: calls AI providers directly using VITE_ keys from .env

const isDev = import.meta.env.DEV;

const AI_PROVIDERS = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: import.meta.env.VITE_GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: import.meta.env.VITE_CEREBRAS_API_KEY || '',
    model: 'llama-3.3-70b',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    key: import.meta.env.VITE_GEMINI_API_KEY || '',
    model: '',
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: import.meta.env.VITE_OPENROUTER_API_KEY || '',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  },
];

async function callAIDirect(prompt: string, maxTokens = 800): Promise<string> {
  for (const provider of AI_PROVIDERS) {
    if (!provider.key) continue;
    try {
      if (provider.name === 'gemini') {
        const response = await fetch(`${provider.url}?key=${provider.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
          }),
        });
        if (!response.ok) continue;
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: maxTokens,
        }),
      });
      if (!response.ok) continue;
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch {
      continue;
    }
  }
  throw new Error('All AI providers failed');
}

async function callAI(type: string, prompt: string, maxTokens = 800): Promise<string> {
  if (isDev) {
    return callAIDirect(prompt, maxTokens);
  }

  const response = await apiFetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, prompt }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'AI generation failed' }));
    throw new Error(err.error || `AI error (${response.status})`);
  }

  const data = await response.json();
  return data.result || '';
}

/**
 * Bulletproof AI JSON parser — handles every known AI output quirk:
 * - Markdown code fences (```json ... ```)
 * - Literal newlines/tabs/control chars inside string values
 * - Unescaped double quotes inside string values
 * - Trailing commas
 * - Text before/after the JSON object
 * Falls back to regex key extraction if JSON.parse still fails.
 */
function parseAIJson<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');

  // Extract JSON object (first { to last })
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    text = text.substring(objStart, objEnd + 1);
  }

  // Attempt 1: direct parse (works for clean JSON)
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // Attempt 2: regex-based key-value extraction (handles all malformed JSON)
  try {
    const result: Record<string, any> = {};

    // Match "key": "value" or "key": ["array"] or "key": number
    // For string values, capture everything between the colon-quote and the pattern "next-key-or-end"
    const keyPattern = /"([^"]+)"\s*:\s*/g;
    const keys: { key: string; index: number }[] = [];
    let m;
    while ((m = keyPattern.exec(text)) !== null) {
      keys.push({ key: m[1], index: m.index + m[0].length });
    }

    for (let i = 0; i < keys.length; i++) {
      const { key, index } = keys[i];
      const nextKeyIndex = i + 1 < keys.length ? keys[i + 1].index : text.length;
      // Get the raw value substring between this key's value start and the next key
      const rawValue = text.substring(index, nextKeyIndex).trim();

      if (rawValue.startsWith('[')) {
        // Array value — extract items between [ and ]
        const arrEnd = rawValue.indexOf(']');
        if (arrEnd !== -1) {
          const inner = rawValue.substring(1, arrEnd);
          result[key] = inner
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        } else {
          result[key] = [];
        }
      } else if (rawValue.startsWith('"')) {
        // String value — find content between first " and the last " before the next key
        // Remove the opening quote
        let val = rawValue.substring(1);
        // Remove trailing comma, closing brace, and find the last quote
        val = val.replace(/[,}\s]+$/, '');
        if (val.endsWith('"')) {
          val = val.slice(0, -1);
        }
        // Unescape common sequences
        val = val.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        result[key] = val;
      } else {
        // Number, boolean, etc.
        const numVal = parseFloat(rawValue);
        if (!isNaN(numVal) && rawValue.match(/^[\d.]+/)) {
          result[key] = numVal;
        } else {
          result[key] = rawValue.replace(/[,}\s]+$/, '').replace(/^["']|["']$/g, '');
        }
      }
    }

    if (Object.keys(result).length > 0) {
      return result as T;
    }
  } catch { /* continue */ }

  // Attempt 3: last resort — strip all control chars and try parse
  try {
    const stripped = text.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(stripped);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }
}

/** Strip leaked markdown headers, labels, and excess whitespace from AI string values */
function cleanValue(val: unknown): string {
  if (typeof val !== 'string') return String(val ?? '');
  return val
    .replace(/^#+\s*.+\n?/gm, '')          // Remove markdown headers (## Why It Matters)
    .replace(/^\*\*[^*]+\*\*\s*/gm, '')    // Remove bold labels (**Why:**)
    .replace(/\n{3,}/g, '\n\n')             // Collapse triple+ newlines
    .trim();
}

export async function generateTrendAnalysis(news: NewsItem): Promise<TrendAnalysis> {
  if (news.trendAnalysis) {
    return news.trendAnalysis;
  }

  // Check localStorage cache by article URL
  const cacheKey = news.sourceUrl || news.title;
  const cached = getCached<TrendAnalysis>('trendAnalysis', cacheKey);
  if (cached) return cached;

  const prompt = `You are an expert news analyst, trend strategist, and viral content creator. Your job is NOT to summarize news. Your job is to decode what is ACTUALLY happening, explain WHY this is trending with real reasoning, extract creator opportunities, and generate viral-ready content.

INPUT:
Headline: ${news.title}
Description: ${news.description}
Source: ${news.source}

Respond ONLY with a valid JSON object, no markdown, no extra text. Output MUST be parseable JSON.

STRICT RULES for content:
- DO NOT summarize like a news article
- DO NOT repeat the headline
- DO NOT be generic — every insight must be specific to THIS topic
- DO NOT use filler phrases or obvious explanations
- If an explanation could apply to ANY topic, make it more specific
- Hooks must feel scroll-stopping, no generic "What if..." phrases
- Video script must be natural, conversational, fast-paced (30-45 seconds when spoken)

JSON format:
{"whatsGoingOn": "2-3 sentences max. Explain the situation like a human. Avoid robotic/news tone. Focus on clarity and context. No markdown.", "whyBlowingUp": "2-4 sentences. Identify the REAL trigger, not generic reasons. Explain timing — why NOW. Explain human psychology — curiosity, confusion, controversy, etc. Must be specific to this topic.", "creatorOpportunity": "2-3 sentences. Why this topic is perfect for short-form content. What makes it engaging — visual, relatable, controversial, etc. What angle will perform best.", "viralHooks": ["hook 1 — scroll-stopping, curiosity or bold claim", "hook 2 — urgency or controversy angle", "hook 3 — surprising or contrarian take"], "videoScript": {"hook": "strong opening line that stops the scroll", "context": "quick setup, relatable, 1-2 sentences", "explanation": "main insight, simple and engaging, 2-3 sentences", "payoff": "why this matters, the takeaway, 1-2 sentences", "cta": "engaging closing line that drives interaction"}}`;

  const result = await callAI('trendAnalysis', prompt, 1200);
  const parsed = parseAIJson<any>(result);
  
  const hooks = Array.isArray(parsed.viralHooks) 
    ? parsed.viralHooks.slice(0, 3).map((h: any) => cleanValue(h))
    : ['', '', ''];
  // Ensure exactly 3 hooks
  while (hooks.length < 3) hooks.push('');

  const vs = parsed.videoScript || {};
  const data: TrendAnalysis = {
    whatsGoingOn: cleanValue(parsed.whatsGoingOn),
    whyBlowingUp: cleanValue(parsed.whyBlowingUp),
    creatorOpportunity: cleanValue(parsed.creatorOpportunity),
    viralHooks: hooks,
    videoScript: {
      hook: cleanValue(vs.hook),
      context: cleanValue(vs.context),
      explanation: cleanValue(vs.explanation),
      payoff: cleanValue(vs.payoff),
      cta: cleanValue(vs.cta),
    },
  };
  setCache('trendAnalysis', cacheKey, data);
  return data;
}

export async function generateCreatorScript(
  news: NewsItem,
  format: CreatorScript['format'] = 'youtube-short'
): Promise<CreatorScript> {
  // Check cache by article URL + format
  const cacheKey = (news.sourceUrl || news.title) + ':' + format;
  const cached = getCached<CreatorScript>('script', cacheKey);
  if (cached) return { ...cached, id: `script-${Date.now()}`, createdAt: new Date().toISOString() };

  const formatGuide: Record<string, { style: string; duration: string; tone: string }> = {
    'youtube-short': { style: 'YouTube Shorts', duration: '45-55 seconds', tone: 'conversational, slightly dramatic, storytelling pacing' },
    'tiktok': { style: 'TikTok', duration: '30-45 seconds', tone: 'trendy, fast-paced, casual, high energy' },
    'instagram-reel': { style: 'Instagram Reel', duration: '30-60 seconds', tone: 'polished, visual, aspirational, engaging' },
    'long-form': { style: 'YouTube Long Form', duration: '5-8 minutes', tone: 'detailed, educational, structured with chapters' },
  };

  const fg = formatGuide[format] || formatGuide['youtube-short'];

  const prompt = `Create a highly engaging ${fg.style} script (${fg.duration}) on this topic. Respond ONLY with valid JSON, no markdown.

Topic: ${news.title}
Context: ${news.trendAnalysis?.whatsGoingOn || news.explanation || news.description}

Script structure:
1. Strong hook (curiosity, "what if", or psychology-based opener) — 1-2 sentences
2. Short relatable setup — 1-2 sentences connecting to audience
3. 2-4 fast-paced surprising points — short punchy sentences
4. Twist or payoff near the end — 1-2 sentences
5. Subtle call to action — 1 sentence

Style: ${fg.tone}. Short sentences. High retention pacing. Storytelling, not lecturing.

JSON format:
{"hook": "scroll-stopping opener, 1-2 sentences", "setup": "relatable setup connecting topic to viewer, 1-2 sentences", "points": ["point 1 - surprising fact or angle", "point 2", "point 3"], "twist": "unexpected twist or payoff, 1-2 sentences", "cta": "subtle call to action, 1 sentence", "fullScript": "complete script combining all parts above, ready to read aloud, ${fg.duration} when spoken", "duration": "${fg.duration}", "viralTitle": "catchy title under 80 chars with emoji", "description": "engaging 1-2 sentence description for post caption", "tags": ["8-10 relevant hashtags without #"], "thumbnailText": "max 5 words for thumbnail overlay", "thumbnailIdea": "1 sentence describing thumbnail visual concept", "imagePrompt": "detailed 9:16 AI image prompt, cartoon or cinematic style, vivid colors, no text"}`;

  const result = await callAI('script', prompt, 1200);
  const parsed = parseAIJson<any>(result);
  const script: CreatorScript = {
    id: `script-${Date.now()}`,
    newsId: news.id,
    hook: cleanValue(parsed.hook),
    setup: cleanValue(parsed.setup),
    points: Array.isArray(parsed.points) ? parsed.points.map((p: any) => cleanValue(p)) : [],
    twist: cleanValue(parsed.twist),
    cta: cleanValue(parsed.cta),
    fullScript: cleanValue(parsed.fullScript),
    format,
    duration: String(parsed.duration || fg.duration),
    viralTitle: cleanValue(parsed.viralTitle),
    description: cleanValue(parsed.description),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).replace(/^#/, '')) : [],
    thumbnailText: cleanValue(parsed.thumbnailText),
    thumbnailIdea: cleanValue(parsed.thumbnailIdea),
    imagePrompt: cleanValue(parsed.imagePrompt),
    createdAt: new Date().toISOString(),
  };
  setCache('script', cacheKey, script);
  return script;
}

export async function generateNarrationScript(news: NewsItem): Promise<string> {
  const cacheKey = news.sourceUrl || news.title;
  const cached = getCached<string>('narration', cacheKey);
  if (cached) return cached;

  const prompt = `You are a charismatic podcast host delivering a breaking news update. Write a 30-second narration script for this story that sounds natural when read aloud by a text-to-speech engine.

Headline: ${news.title}
Description: ${news.description}
${(news.trendAnalysis?.whatsGoingOn || news.explanation) ? `Context: ${news.trendAnalysis?.whatsGoingOn || news.explanation}` : ''}

Rules:
- Write ONLY the narration text, no labels, no stage directions
- ~80-100 words (30 seconds of speech)
- Start with a punchy hook that grabs attention
- Use short sentences for natural pauses
- Be conversational — like talking to a friend
- Include the key facts but keep it engaging
- End with a thought-provoking line
- No emojis, no hashtags, no bullet points

Respond in JSON: { "narration": "your narration text here" }`;

  const result = await callAI('narration', prompt);
  const parsed = parseAIJson<any>(result);
  const narration = parsed.narration;
  setCache('narration', cacheKey, narration);
  return narration;
}
