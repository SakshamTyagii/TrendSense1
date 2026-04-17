export interface NewsItem {
  id: string;
  title: string;
  description: string;
  explanation?: string;
  whyTrending?: string;
  whyMatters?: string;
  trendAnalysis?: TrendAnalysis;
  narrationScript?: string;
  category: Category;
  source: string;
  sourceUrl: string;
  imageUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  audioUrl?: string;
  publishedAt: string;
  trendScore: number;
  viralAngle?: string;
  bestContentAngle?: string;
  reelCount?: number;
  tags: string[];
}

export type Category = 'tech' | 'politics' | 'finance' | 'sports' | 'entertainment' | 'world';

export type TrustedSource = 'BBC' | 'Reuters' | 'The New York Times' | 'Bloomberg' | 'The Guardian' | 'CNBC';

export const TRUSTED_SOURCES: TrustedSource[] = [
  'BBC', 'Reuters', 'The New York Times', 'Bloomberg', 'The Guardian', 'CNBC'
];

export const CATEGORIES: { id: Category; label: string; image: string }[] = [
  { id: 'tech', label: 'Technology', image: '/images/category-tech.jpg' },
  { id: 'politics', label: 'Politics', image: '/images/category-politics.jpg' },
  { id: 'finance', label: 'Finance', image: '/images/category-finance.jpg' },
  { id: 'sports', label: 'Sports', image: '/images/category-sports.jpg' },
  { id: 'entertainment', label: 'Entertainment', image: '/images/category-entertainment.jpg' },
  { id: 'world', label: 'World', image: '/images/category-politics.jpg' },
];

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'twitter';
  preferences: {
    categories: Category[];
    autoPlayAudio: boolean;
    darkMode: boolean;
  };
  history: string[];
  savedStories: string[];
  createdAt: string;
}

export interface CreatorScript {
  id: string;
  newsId: string;
  hook: string;
  setup: string;
  points: string[];
  twist: string;
  cta: string;
  fullScript: string;
  format: 'youtube-short' | 'tiktok' | 'instagram-reel' | 'long-form';
  duration: string;
  viralTitle: string;
  description: string;
  tags: string[];
  thumbnailText: string;
  thumbnailIdea: string;
  imagePrompt: string;
  createdAt: string;
}

export interface VideoScript {
  hook: string;
  context: string;
  explanation: string;
  payoff: string;
  cta: string;
}

export interface TrendAnalysis {
  whatsGoingOn: string;
  whyBlowingUp: string;
  creatorOpportunity: string;
  viralHooks: string[];
  videoScript: VideoScript;
}

export interface CreatorInsight {
  viralReason: string;
  bestAngle: string;
  targetAudience: string;
  suggestedHashtags: string[];
  engagementTips: string[];
}

export interface CreatorReel {
  id: string;
  newsId: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  likes: number;
  views: number;
  duration: number;
  createdAt: string;
}
