import { create } from 'zustand';
import type { User, NewsItem, Category, CreatorScript, CreatorReel } from '../types';
import { fetchNews, searchNews } from '../lib/newsService';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (provider: 'google' | 'twitter') => Promise<void>;
  logout: () => void;
  
  // News
  news: NewsItem[];
  filteredNews: NewsItem[];
  pendingNews: NewsItem[] | null;
  selectedCategory: Category | null;
  selectedNews: NewsItem | null;
  isLoadingNews: boolean;
  newsError: string | null;
  searchQuery: string;
  
  loadNews: (category?: Category) => Promise<void>;
  loadNewsBackground: () => Promise<void>;
  applyPendingNews: () => void;
  setCategory: (category: Category | null) => void;
  setSelectedNews: (news: NewsItem | null) => void;
  updateNewsItem: (news: NewsItem) => void;
  search: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  
  // Audio
  isPlaying: boolean;
  currentAudioId: string | null;
  setPlaying: (playing: boolean, newsId?: string) => void;
  
  // Creator
  scripts: CreatorScript[];
  addScript: (script: CreatorScript) => void;
  
  // Reels
  reels: CreatorReel[];
  loadReelsForNews: (newsId: string) => CreatorReel[];
  addReel: (reel: CreatorReel) => void;
  getAllReels: () => CreatorReel[];
  
  // UI
  currentView: 'feed' | 'detail' | 'creator' | 'search' | 'profile';
  setView: (view: AppState['currentView']) => void;
  showCreatorMode: boolean;
  setCreatorMode: (show: boolean) => void;
  
  // User behavior
  addToHistory: (newsId: string) => void;
  toggleSaved: (newsId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  isAuthLoading: false,
  
  login: async (provider) => {
    set({ isAuthLoading: true });
    
    // Simulate OAuth flow
    await new Promise(r => setTimeout(r, 1500));
    
    const user: User = {
      id: `user-${Date.now()}`,
      name: provider === 'google' ? 'Alex Creator' : 'Alex Creator',
      email: 'alex@trendsense.ai',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      provider,
      preferences: {
        categories: ['tech', 'finance', 'entertainment'],
        autoPlayAudio: false,
        darkMode: true,
      },
      history: [],
      savedStories: [],
      createdAt: new Date().toISOString(),
    };
    
    localStorage.setItem('trendsense_user', JSON.stringify(user));
    set({ user, isAuthenticated: true, isAuthLoading: false });
  },
  
  logout: () => {
    localStorage.removeItem('trendsense_user');
    set({ user: null, isAuthenticated: false });
  },
  
  // News
  news: [],
  filteredNews: [],
  pendingNews: null,
  selectedCategory: null,
  selectedNews: null,
  isLoadingNews: false,
  newsError: null,
  searchQuery: '',
  
  loadNews: async (category) => {
    set({ isLoadingNews: true, newsError: null, pendingNews: null });
    try {
      const news = await fetchNews(category);
      set({ 
        news, 
        filteredNews: news,
        isLoadingNews: false 
      });

      // Seed demo reels on first load so carousel is never empty
      if (!localStorage.getItem('trendsense_reels_seeded') && news.length >= 3) {
        const demoCreators = [
          { name: 'Sarah Chen', avatar: 'https://i.pravatar.cc/150?img=5' },
          { name: 'Marcus Rivera', avatar: 'https://i.pravatar.cc/150?img=12' },
          { name: 'Priya Sharma', avatar: 'https://i.pravatar.cc/150?img=32' },
        ];
        const demoReels: CreatorReel[] = news.slice(0, 3).map((n, i) => ({
          id: `demo-reel-${i}`,
          newsId: n.id,
          creatorId: `demo-creator-${i}`,
          creatorName: demoCreators[i].name,
          creatorAvatar: demoCreators[i].avatar,
          videoUrl: '',
          thumbnailUrl: n.imageUrl,
          caption: `Quick take on: ${n.title.slice(0, 80)}`,
          likes: Math.floor(Math.random() * 500) + 50,
          views: Math.floor(Math.random() * 5000) + 500,
          duration: Math.floor(Math.random() * 30) + 15,
          createdAt: new Date().toISOString(),
        }));
        const existing = get().reels;
        const merged = [...existing, ...demoReels];
        set({ reels: merged });
        localStorage.setItem('trendsense_reels', JSON.stringify(merged));
        localStorage.setItem('trendsense_reels_seeded', 'true');
      }
    } catch (err: any) {
      console.error('Failed to load news:', err);
      set({ isLoadingNews: false, newsError: err?.message || 'Failed to load news. Please try again.' });
    }
  },

  loadNewsBackground: async () => {
    try {
      const category = get().selectedCategory;
      const freshNews = await fetchNews(category || undefined);
      const currentIds = new Set(get().news.map(n => n.title));
      const hasNew = freshNews.some(n => !currentIds.has(n.title));
      if (hasNew) {
        set({ pendingNews: freshNews });
      }
    } catch { /* silent background refresh failure */ }
  },

  applyPendingNews: () => {
    const { pendingNews, news: oldNews } = get();
    if (pendingNews) {
      // Preserve AI enrichments from old items by matching on URL
      const enrichMap = new Map<string, Partial<NewsItem>>();
      for (const n of oldNews) {
        if (n.sourceUrl && (n.explanation || n.narrationScript)) {
          enrichMap.set(n.sourceUrl, {
            explanation: n.explanation,
            whyTrending: n.whyTrending,
            whyMatters: n.whyMatters,
            narrationScript: n.narrationScript,
          });
        }
      }
      const merged = pendingNews.map(n => {
        const existing = n.sourceUrl ? enrichMap.get(n.sourceUrl) : undefined;
        return existing ? { ...n, ...existing } : n;
      });
      set({ news: merged, filteredNews: merged, pendingNews: null });
    }
  },
  
  setCategory: (category) => {
    set({ selectedCategory: category });
    get().loadNews(category || undefined);
  },
  
  setSelectedNews: (news) => set({ selectedNews: news }),
  
  updateNewsItem: (updated) => {
    const { news, filteredNews } = get();
    set({
      news: news.map(n => n.id === updated.id ? updated : n),
      filteredNews: filteredNews.map(n => n.id === updated.id ? updated : n),
    });
  },
  
  search: async (query) => {
    if (!query.trim()) {
      set({ filteredNews: get().news, searchQuery: '' });
      return;
    }
    set({ isLoadingNews: true, searchQuery: query, newsError: null });
    try {
      const results = await searchNews(query);
      set({ filteredNews: results, isLoadingNews: false });
    } catch (err: any) {
      console.error('Search failed:', err);
      set({ isLoadingNews: false, newsError: err?.message || 'Search failed. Please try again.' });
    }
  },
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Audio
  isPlaying: false,
  currentAudioId: null,
  setPlaying: (playing, newsId) => set({ 
    isPlaying: playing, 
    currentAudioId: newsId || null 
  }),
  
  // Creator
  scripts: [],
  addScript: (script) => set({ scripts: [...get().scripts, script] }),
  
  // Reels (stored in localStorage for MVP)
  reels: JSON.parse(localStorage.getItem('trendsense_reels') || '[]'),
  
  loadReelsForNews: (newsId: string) => {
    return get().reels.filter(r => r.newsId === newsId);
  },
  
  addReel: (reel: CreatorReel) => {
    const reels = [...get().reels, reel];
    set({ reels });
    localStorage.setItem('trendsense_reels', JSON.stringify(reels));
  },
  
  getAllReels: () => get().reels,
  
  // UI
  currentView: 'feed',
  setView: (view) => set({ currentView: view }),
  showCreatorMode: false,
  setCreatorMode: (show) => set({ showCreatorMode: show }),
  
  // User behavior
  addToHistory: (newsId) => {
    const user = get().user;
    if (user) {
      user.history = [newsId, ...user.history.filter(id => id !== newsId)].slice(0, 100);
      set({ user: { ...user } });
      localStorage.setItem('trendsense_user', JSON.stringify(user));
    }
  },
  
  toggleSaved: (newsId) => {
    const user = get().user;
    if (user) {
      const saved = user.savedStories.includes(newsId)
        ? user.savedStories.filter(id => id !== newsId)
        : [newsId, ...user.savedStories];
      user.savedStories = saved;
      set({ user: { ...user } });
      localStorage.setItem('trendsense_user', JSON.stringify(user));
    }
  },
}));

// Restore user session
const savedUser = localStorage.getItem('trendsense_user');
if (savedUser) {
  try {
    const user = JSON.parse(savedUser);
    useStore.setState({ user, isAuthenticated: true });
  } catch {}
}
