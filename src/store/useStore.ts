import { create } from 'zustand';
import type { User, NewsItem, Category, CreatorScript, CreatorReel } from '../types';
import { fetchNews, searchNews } from '../lib/newsService';
import { supabase } from '../lib/supabase';

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (provider: 'google' | 'twitter') => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
  
  // News
  news: NewsItem[];
  filteredNews: NewsItem[];
  pendingNews: NewsItem[] | null;
  newsCache: Record<string, { articles: NewsItem[]; fetchedAt: number }>;
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
  togglePreference: (key: 'autoPlayAudio' | 'notifications') => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  isAuthLoading: true,
  
  login: async (provider) => {
    set({ isAuthLoading: true });
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider === 'twitter' ? 'twitter' : 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) {
        console.error('OAuth error:', error);
        set({ isAuthLoading: false });
      }
      // Don't set isAuthLoading to false here — the page will redirect
      // Auth state is picked up by initAuth() after the redirect
    } catch (err) {
      console.error('Login failed:', err);
      set({ isAuthLoading: false });
    }
  },
  
  logout: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('trendsense_user');
    set({ user: null, isAuthenticated: false });
  },

  initAuth: async () => {
    // Helper to build user object from Supabase session user
    const buildUser = (su: any): User => {
      const user: User = {
        id: su.id,
        name: su.user_metadata?.full_name || su.user_metadata?.name || 'User',
        email: su.email || '',
        avatar: su.user_metadata?.avatar_url || su.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${su.id}`,
        provider: (su.app_metadata?.provider as 'google' | 'twitter') || 'google',
        preferences: {
          categories: ['tech', 'finance', 'entertainment'],
          autoPlayAudio: false,
          darkMode: true,
        },
        history: [],
        savedStories: [],
        createdAt: su.created_at || new Date().toISOString(),
      };
      // Merge with any persisted preferences
      const saved = localStorage.getItem('trendsense_user');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.id === user.id) {
            user.preferences = parsed.preferences || user.preferences;
            user.history = parsed.history || [];
            user.savedStories = parsed.savedStories || [];
          }
        } catch { /* ignore */ }
      }
      return user;
    };

    // onAuthStateChange is the primary session detector.
    // It fires reliably after OAuth redirect (PKCE code exchange),
    // token refresh, and sign-out — avoiding race conditions with getSession().
    // Listen for all auth state changes (login, logout, token refresh, initial check)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = buildUser(session.user);
        localStorage.setItem('trendsense_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isAuthLoading: false });
      } else {
        // No session — covers INITIAL_SESSION (no user), SIGNED_OUT, TOKEN_REFRESHED (failure)
        localStorage.removeItem('trendsense_user');
        set({ user: null, isAuthenticated: false, isAuthLoading: false });
      }
    });
  },
  
  // News
  news: [],
  filteredNews: [],
  pendingNews: null,
  newsCache: {},
  selectedCategory: null,
  selectedNews: null,
  isLoadingNews: false,
  newsError: null,
  searchQuery: '',
  
  loadNews: async (category) => {
    // Check cache first (5-minute TTL)
    const cacheKey = category || '__all__';
    const cached = get().newsCache[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
      set({ news: cached.articles, filteredNews: cached.articles, isLoadingNews: false, newsError: null });
      return;
    }

    set({ isLoadingNews: true, newsError: null, pendingNews: null });
    try {
      const news = await fetchNews(category);
      // Update cache
      const newsCache = { ...get().newsCache, [cacheKey]: { articles: news, fetchedAt: Date.now() } };
      set({ 
        news, 
        filteredNews: news,
        isLoadingNews: false,
        newsCache,
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
  addScript: (script) => {
    const scripts = [...get().scripts, script].slice(-100);
    set({ scripts });
  },
  
  // Reels (stored in localStorage for MVP)
  reels: JSON.parse(localStorage.getItem('trendsense_reels') || '[]'),
  
  loadReelsForNews: (newsId: string) => {
    return get().reels.filter(r => r.newsId === newsId);
  },
  
  addReel: (reel: CreatorReel) => {
    const reels = [...get().reels, reel].slice(-50);
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
        : [newsId, ...user.savedStories].slice(0, 500);
      user.savedStories = saved;
      set({ user: { ...user } });
      localStorage.setItem('trendsense_user', JSON.stringify(user));
    }
  },

  togglePreference: (key) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, preferences: { ...user.preferences, [key]: !user.preferences[key as keyof typeof user.preferences] } };
      set({ user: updated });
      localStorage.setItem('trendsense_user', JSON.stringify(updated));
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
