import { create } from 'zustand';
import type { User, NewsItem, Category, CreatorScript } from '../types';
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
  selectedCategory: Category | null;
  selectedNews: NewsItem | null;
  isLoadingNews: boolean;
  searchQuery: string;
  
  loadNews: (category?: Category) => Promise<void>;
  setCategory: (category: Category | null) => void;
  setSelectedNews: (news: NewsItem | null) => void;
  search: (query: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  
  // Audio
  isPlaying: boolean;
  currentAudioId: string | null;
  setPlaying: (playing: boolean, newsId?: string) => void;
  
  // Creator
  scripts: CreatorScript[];
  addScript: (script: CreatorScript) => void;
  
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
  selectedCategory: null,
  selectedNews: null,
  isLoadingNews: false,
  searchQuery: '',
  
  loadNews: async (category) => {
    set({ isLoadingNews: true });
    try {
      const news = await fetchNews(category);
      set({ 
        news, 
        filteredNews: news,
        isLoadingNews: false 
      });
    } catch {
      set({ isLoadingNews: false });
    }
  },
  
  setCategory: (category) => {
    set({ selectedCategory: category });
    get().loadNews(category || undefined);
  },
  
  setSelectedNews: (news) => set({ selectedNews: news }),
  
  search: async (query) => {
    if (!query.trim()) {
      set({ filteredNews: get().news, searchQuery: '' });
      return;
    }
    set({ isLoadingNews: true, searchQuery: query });
    try {
      const results = await searchNews(query);
      set({ filteredNews: results, isLoadingNews: false });
    } catch {
      set({ isLoadingNews: false });
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
