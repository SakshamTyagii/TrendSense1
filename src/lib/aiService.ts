import { config } from './config';
import { getCached, setCache } from './aiCache';
import type { NewsItem, CreatorScript, CreatorInsight } from '../types';

// ─── Provider cooldown tracking ────────────────────────────────────────
// When a provider returns 429, skip it for 15 minutes
const COOLDOWN_MS = 15 * 60 * 1000;
const cooldowns: Record<string, number> = {};

function isOnCooldown(provider: string): boolean {
  const until = cooldowns[provider];
  if (!until) return false;
  if (Date.now() >= until) { delete cooldowns[provider]; return false; }
  return true;
}

function setCooldown(provider: string): void {
  cooldowns[provider] = Date.now() + COOLDOWN_MS;
}

function is429(err: any): boolean {
  return err?.message?.includes('429') || false;
}

function cleanJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// ─── Provider: Groq (Llama 3.3 70B) ───────────────────────────────────
async function callGroq(prompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Provider: Cerebras (gpt-oss-120b) ────────────────────────────────
async function callCerebras(prompt: string): Promise<string> {
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.cerebrasApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama3.1-8b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cerebras API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Provider: Gemini (2.0 Flash) ──────────────────────────────────────
async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Provider: OpenRouter (free models) ────────────────────────────────
async function callOpenRouter(prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'TrendSense',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Unified caller: Groq → Cerebras → Gemini → OpenRouter ────────────
async function callAI(prompt: string): Promise<string> {
  if (!config.hasAI) {
    throw new Error('No AI API key configured. Add at least one of: VITE_GROQ_API_KEY, VITE_CEREBRAS_API_KEY, VITE_GEMINI_API_KEY, or VITE_OPENROUTER_API_KEY to your .env file.');
  }

  const providers: { name: string; hasKey: boolean; fn: (p: string) => Promise<string> }[] = [
    { name: 'groq', hasKey: config.hasGroq, fn: callGroq },
    { name: 'cerebras', hasKey: config.hasCerebras, fn: callCerebras },
    { name: 'gemini', hasKey: config.hasGemini, fn: callGemini },
    { name: 'openrouter', hasKey: config.hasOpenRouter, fn: callOpenRouter },
  ];

  const errors: string[] = [];

  for (const { name, hasKey, fn } of providers) {
    if (!hasKey || isOnCooldown(name)) continue;
    try {
      const result = await fn(prompt);
      if (result) return cleanJson(result);
    } catch (err: any) {
      console.warn(`${name} failed, trying next provider:`, err.message);
      if (is429(err)) setCooldown(name);
      errors.push(err.message);
    }
  }

  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

export async function generateExplanation(news: NewsItem): Promise<{
  explanation: string;
  whyTrending: string;
  whyMatters: string;
}> {
  if (news.explanation) {
    return {
      explanation: news.explanation,
      whyTrending: news.whyTrending,
      whyMatters: news.whyMatters,
    };
  }

  // Check localStorage cache by article URL
  const cacheKey = news.sourceUrl || news.title;
  const cached = getCached<{ explanation: string; whyTrending: string; whyMatters: string }>('explanation', cacheKey);
  if (cached) return cached;

  const prompt = `You are an expert news analyst for a modern, Gen-Z audience. Given this news article, produce a rich, engaging breakdown.

Headline: ${news.title}
Description: ${news.description}
Source: ${news.source}
Category: ${news.category}

Respond in JSON format with these exact keys:
{
  "explanation": "Write a thorough 2-3 paragraph explanation of what happened. Be conversational and clear. Cover the key facts, the people/organizations involved, and the timeline. Each paragraph should be 3-5 sentences. No bullet points.",
  "whyTrending": "Write 2 paragraphs explaining why this is trending right now. Reference social media buzz, public interest, timing, and relevance. Each paragraph 2-3 sentences.",
  "whyMatters": "Write 2 paragraphs on why this matters to everyday people. Explain the real-world impact on jobs, money, health, rights, or daily life. Each paragraph 2-3 sentences."
}

Make it informative but engaging — like a smart friend explaining the news over coffee.`;

  const result = await callAI(prompt);
  const parsed = JSON.parse(result);
  const data = {
    explanation: parsed.explanation,
    whyTrending: parsed.whyTrending,
    whyMatters: parsed.whyMatters,
  };
  setCache('explanation', cacheKey, data);
  return data;
}

export async function generateCreatorScript(
  news: NewsItem,
  format: CreatorScript['format'] = 'youtube-short'
): Promise<CreatorScript> {
  if (!config.hasAI) {
    throw new Error('No AI API key configured. Add VITE_GROQ_API_KEY or VITE_GEMINI_API_KEY to your .env file.');
  }

  // Check cache by article URL + format
  const cacheKey = (news.sourceUrl || news.title) + ':' + format;
  const cached = getCached<CreatorScript>('script', cacheKey);
  if (cached) return { ...cached, id: `script-${Date.now()}`, createdAt: new Date().toISOString() };

  const formatGuide = {
    'youtube-short': '60 seconds, punchy, hook-driven, vertical video',
    'tiktok': '30-45 seconds, trendy, fast-paced, casual tone',
    'instagram-reel': '30-60 seconds, visual, polished, engaging captions',
    'long-form': '5-10 minutes, detailed, educational, structured with chapters',
  };

  const prompt = `You are a top-tier viral content scriptwriter. Create a complete ${format} script for this news story.

Format guidelines: ${formatGuide[format]}

Headline: ${news.title}
Context: ${news.explanation || news.description}
Category: ${news.category}

Respond in JSON:
{
  "hook": "Opening hook (first 3 seconds) — must stop the scroll. Be provocative or surprising.",
  "body": "Main content — deliver the story with energy. Include specific facts, names, numbers. Make it feel urgent.",
  "ending": "Strong call to action / closing — drive engagement (comment, follow, share).",
  "fullScript": "Complete script ready to read aloud, with natural pauses and emphasis cues.",
  "duration": "Estimated duration"
}`;

  const result = await callAI(prompt);
  const parsed = JSON.parse(result);
  const script: CreatorScript = {
    id: `script-${Date.now()}`,
    newsId: news.id,
    ...parsed,
    format,
    createdAt: new Date().toISOString(),
  };
  setCache('script', cacheKey, script);
  return script;
}

export async function generateCreatorInsights(news: NewsItem): Promise<CreatorInsight> {
  if (!config.hasAI) {
    throw new Error('No AI API key configured. Add VITE_GROQ_API_KEY or VITE_GEMINI_API_KEY to your .env file.');
  }

  const cacheKey = news.sourceUrl || news.title;
  const cached = getCached<CreatorInsight>('insights', cacheKey);
  if (cached) return cached;

  const prompt = `You are a social media strategist and content consultant. Analyze this news story for creator content potential.

Headline: ${news.title}
Description: ${news.description}
Category: ${news.category}
Trend Score: ${news.trendScore}

Respond in JSON:
{
  "viralReason": "2-3 sentences on exactly why this story has viral potential",
  "bestAngle": "2-3 sentences on the best unique angle a creator should take",
  "targetAudience": "Specific audience description — demographics, interests, platforms",
  "suggestedHashtags": ["exactly 7 relevant trending hashtags"],
  "engagementTips": ["5 specific, actionable tips for maximizing engagement on this story"]
}`;

  const result = await callAI(prompt);
  const data = JSON.parse(result);
  setCache('insights', cacheKey, data);
  return data;
}

export async function generateNarrationScript(news: NewsItem): Promise<string> {
  const cacheKey = news.sourceUrl || news.title;
  const cached = getCached<string>('narration', cacheKey);
  if (cached) return cached;

  const prompt = `You are a charismatic podcast host delivering a breaking news update. Write a 30-second narration script for this story that sounds natural when read aloud by a text-to-speech engine.

Headline: ${news.title}
Description: ${news.description}
${news.explanation ? `Context: ${news.explanation}` : ''}

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

  const result = await callAI(prompt);
  const parsed = JSON.parse(result);
  const narration = parsed.narration;
  setCache('narration', cacheKey, narration);
  return narration;
}
