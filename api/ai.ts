import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth';

// Server-side AI API keys: NEVER sent to browser
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || process.env.VITE_CEREBRAS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';

// Provider cooldown tracking (per server instance)
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

function is429(status: number): boolean {
  return status === 429;
}

function cleanJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// ─── Provider implementations ──────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (is429(response.status)) setCooldown('groq');
    throw new Error(`Groq API error (${response.status})`);
  }
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callCerebras(prompt: string): Promise<string> {
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama3.1-8b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (is429(response.status)) setCooldown('cerebras');
    throw new Error(`Cerebras API error (${response.status})`);
  }
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (is429(response.status)) setCooldown('gemini');
    throw new Error(`Gemini API error (${response.status})`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenRouter(prompt: string, origin: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': origin || 'https://trendsense.app',
      'X-Title': 'TrendSense',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (is429(response.status)) setCooldown('openrouter');
    throw new Error(`OpenRouter API error (${response.status})`);
  }
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

// ─── Unified: Groq → Cerebras → Gemini → OpenRouter ───────────────────

async function callAI(prompt: string, origin: string): Promise<string> {
  const providers = [
    { name: 'groq', hasKey: !!GROQ_API_KEY, fn: () => callGroq(prompt) },
    { name: 'cerebras', hasKey: !!CEREBRAS_API_KEY, fn: () => callCerebras(prompt) },
    { name: 'gemini', hasKey: !!GEMINI_API_KEY, fn: () => callGemini(prompt) },
    { name: 'openrouter', hasKey: !!OPENROUTER_API_KEY, fn: () => callOpenRouter(prompt, origin) },
  ];

  const errors: string[] = [];
  for (const { name, hasKey, fn } of providers) {
    if (!hasKey || isOnCooldown(name)) continue;
    try {
      const result = await fn();
      if (result) return cleanJson(result);
    } catch (err: any) {
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`All AI providers failed: ${errors.join('; ')}`);
}

// ─── API handler ───────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const userId = await authenticateRequest(req, res);
  if (!userId) return;

  const hasAnyKey = GROQ_API_KEY || CEREBRAS_API_KEY || GEMINI_API_KEY || OPENROUTER_API_KEY;
  if (!hasAnyKey) {
    return res.status(500).json({ error: 'No AI API keys configured on server' });
  }

  const { type, prompt } = req.body || {};
  if (!type || !prompt) {
    return res.status(400).json({ error: 'Missing type or prompt in request body' });
  }

  const validTypes = ['explanation', 'script', 'narration', 'insights', 'trendAnalysis'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const origin = req.headers.origin || req.headers.referer || '';
    const result = await callAI(prompt, String(origin));
    return res.status(200).json({ result });
  } catch (err: any) {
    return res.status(502).json({ error: err.message || 'AI generation failed' });
  }
}
