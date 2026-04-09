import { config } from './config';
import type { NewsItem, CreatorScript, CreatorInsight } from '../types';

async function callOpenAI(prompt: string, maxTokens = 1000): Promise<string> {
  if (!config.hasOpenAi) {
    return '';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error('OpenAI API error');
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI error:', error);
    return '';
  }
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

  const prompt = `You are a news explainer for a modern audience. Given this news headline and description, generate an engaging, conversational explanation.

Headline: ${news.title}
Description: ${news.description}
Source: ${news.source}

Respond in JSON format:
{
  "explanation": "2 paragraphs, conversational, easy to understand, no bullet points",
  "whyTrending": "1 paragraph on why this is trending right now",
  "whyMatters": "1 paragraph on why this matters to everyday people"
}`;

  const result = await callOpenAI(prompt);
  try {
    const parsed = JSON.parse(result);
    return parsed;
  } catch {
    return {
      explanation: news.description,
      whyTrending: 'This story is gaining significant attention across major news outlets.',
      whyMatters: 'This development could have far-reaching implications for millions of people.',
    };
  }
}

export async function generateCreatorScript(
  news: NewsItem,
  format: CreatorScript['format'] = 'youtube-short'
): Promise<CreatorScript> {
  const formatGuide = {
    'youtube-short': '60 seconds, punchy, hook-driven',
    'tiktok': '30-45 seconds, trendy, fast-paced',
    'instagram-reel': '30-60 seconds, visual, engaging',
    'long-form': '5-10 minutes, detailed, educational',
  };

  if (!config.hasOpenAi) {
    return generateDemoScript(news, format);
  }

  const prompt = `You are a viral content scriptwriter. Create a ${format} script for this news story.

Format: ${formatGuide[format]}

Headline: ${news.title}
Explanation: ${news.explanation}

Respond in JSON:
{
  "hook": "Opening hook (first 3 seconds)",
  "body": "Main content",
  "ending": "Call to action / closing",
  "fullScript": "Complete script ready to read",
  "duration": "Estimated duration"
}`;

  const result = await callOpenAI(prompt, 1500);
  try {
    const parsed = JSON.parse(result);
    return {
      id: `script-${Date.now()}`,
      newsId: news.id,
      ...parsed,
      format,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return generateDemoScript(news, format);
  }
}

function generateDemoScript(news: NewsItem, format: CreatorScript['format']): CreatorScript {
  const hook = `Stop scrolling. ${news.title.split(':')[0]} just changed everything.`;
  const body = news.explanation || news.description;
  const ending = `Follow for more breaking news explained simply. Drop a comment — what do you think about this?`;
  
  return {
    id: `script-${Date.now()}`,
    newsId: news.id,
    hook,
    body,
    ending,
    fullScript: `${hook}\n\n${body}\n\n${ending}`,
    format,
    duration: format === 'long-form' ? '5-7 min' : '45-60 sec',
    createdAt: new Date().toISOString(),
  };
}

export async function generateCreatorInsights(news: NewsItem): Promise<CreatorInsight> {
  if (!config.hasOpenAi) {
    return {
      viralReason: news.viralAngle || `This story taps into a topic that affects millions of people. The emotional resonance combined with the timeliness makes it perfect for social media engagement.`,
      bestAngle: news.bestContentAngle || `Lead with the human impact angle. Make it personal — how does this affect YOUR audience specifically? Use a provocative question as your hook.`,
      targetAudience: 'News-aware millennials and Gen Z, content creators, professionals in the relevant industry',
      suggestedHashtags: ['#BreakingNews', '#Trending', '#Explained', `#${news.category}`, '#NewsUpdate'],
      engagementTips: [
        'Post within 2 hours of the story breaking for maximum reach',
        'Use a controversial take or question as your hook',
        'Include a call-to-action asking for opinions',
        'Cross-post across platforms with format-specific edits',
        'Reply to every comment in the first hour',
      ],
    };
  }

  const prompt = `You are a social media strategist. Analyze this news story for creator content potential.

Headline: ${news.title}
Category: ${news.category}
Trend Score: ${news.trendScore}

Respond in JSON:
{
  "viralReason": "Why this will go viral",
  "bestAngle": "Best angle for content creation",
  "targetAudience": "Who to target",
  "suggestedHashtags": ["5 relevant hashtags"],
  "engagementTips": ["5 specific tips"]
}`;

  const result = await callOpenAI(prompt);
  try {
    return JSON.parse(result);
  } catch {
    return {
      viralReason: news.viralAngle || 'High emotional resonance with broad audience appeal.',
      bestAngle: news.bestContentAngle || 'Lead with the human impact angle.',
      targetAudience: 'News-aware millennials and Gen Z',
      suggestedHashtags: ['#BreakingNews', '#Trending', `#${news.category}`],
      engagementTips: ['Post quickly', 'Use a strong hook', 'Engage with comments'],
    };
  }
}
