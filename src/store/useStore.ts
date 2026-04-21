import { create } from 'zustand';
import type { User, NewsItem, Category, CreatorScript, CreatorReel } from '../types';
import { fetchNews, searchNews } from '../lib/newsService';
import { supabase } from '../lib/supabase';
import { setCurrentUser, clearUsageCache, syncUsageFromServer } from '../lib/subscription';

// ─── BroadcastChannel for multi-tab usage sync ─────────────────────────
// When one tab increments usage, all other open tabs update immediately.
let _usageChannel: BroadcastChannel | null = null;
try {
  _usageChannel = new BroadcastChannel('ts_usage_sync');
} catch { /* Safari private mode or old browser — graceful degradation */ }

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (provider: 'google' | 'twitter') => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;

  // Usage (reactive — drives ProfileView progress bars + feature gates)
  dailyUsage: { scripts: number; narrations: number; videoGenerations: number };
  isPro: boolean;
  setDailyUsage: (usage: { scripts: number; narrations: number; videoGenerations: number }, isPro: boolean) => void;
  incrementUsage: (type: 'scripts' | 'narrations' | 'videoGenerations') => void;
  
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
  addReel: (reel: CreatorReel) => Promise<void>;
  getAllReels: () => CreatorReel[];
  
  // UI
  currentView: 'feed' | 'detail' | 'creator' | 'search' | 'profile';
  setView: (view: AppState['currentView']) => void;
  showCreatorMode: boolean;
  setCreatorMode: (show: boolean) => void;
  prefilledHook: string | null;
  setPrefilledHook: (hook: string | null) => void;
  
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

  // Usage (reactive)
  dailyUsage: { scripts: 0, narrations: 0, videoGenerations: 0 },
  isPro: false,

  setDailyUsage: (usage, isPro) => {
    set({ dailyUsage: usage, isPro });
  },

  incrementUsage: (type) => {
    const current = get().dailyUsage;
    const updated = { ...current, [type]: current[type] + 1 };
    set({ dailyUsage: updated });
    // Broadcast to other tabs so they update immediately
    try {
      _usageChannel?.postMessage({ type: 'usage_update', usage: updated, isPro: get().isPro });
    } catch { /* ignore */ }
  },
  
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
    clearUsageCache(); // clears per-user localStorage cache so next user starts fresh
    localStorage.removeItem('trendsense_user');
    set({ user: null, isAuthenticated: false });
  },

  initAuth: async () => {
    // Safety net: never leave the app stuck on the loading screen indefinitely.
    // If Supabase doesn't fire onAuthStateChange within 4s, unblock the UI.
    setTimeout(() => {
      if (get().isAuthLoading) {
        set({ isAuthLoading: false });
      }
    }, 4000);

    // Listen for usage updates from other tabs (BroadcastChannel)
    if (_usageChannel) {
      _usageChannel.onmessage = (e) => {
        if (e.data?.type === 'usage_update') {
          set({ dailyUsage: e.data.usage, isPro: e.data.isPro });
        }
      };
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const su = session.user;
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

        // Restore device-local preferences
        const saved = localStorage.getItem('trendsense_user');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.id === user.id) {
              user.preferences = parsed.preferences || user.preferences;
            }
          } catch { /* ignore */ }
        }

        // Key cache to this user and show the app immediately
        setCurrentUser(su.id);
        localStorage.setItem('trendsense_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isAuthLoading: false });

        // Sync usage from server and update reactive store state
        syncUsageFromServer(su.id).then((snapshot) => {
          if (snapshot && get().user?.id === su.id) {
            set({ dailyUsage: snapshot.usage, isPro: snapshot.isPro });
          }
        }).catch(() => {});

        // Fetch all other user data in the background
        Promise.all([
          supabase.from('saved_stories').select('news_id').eq('user_id', su.id),
          supabase.from('user_history').select('news_id').order('viewed_at', { ascending: false }).limit(100).eq('user_id', su.id),
          supabase.from('creator_scripts').select('*').eq('user_id', su.id).order('created_at', { ascending: false }).limit(100),
          supabase.from('reels').select('*, profiles(name, avatar_url)').eq('creator_id', su.id).order('created_at', { ascending: false }).limit(50),
        ]).then(([{ data: savedData }, { data: historyData }, { data: scriptsData }, { data: reelsData }]) => {
          const currentUser = get().user;
          if (!currentUser || currentUser.id !== su.id) return;

          if (savedData) set({ user: { ...currentUser, savedStories: savedData.map((r: any) => r.news_id) } });
          if (historyData) set({ user: { ...get().user!, history: historyData.map((r: any) => r.news_id) } });

          if (scriptsData) {
            const scripts: CreatorScript[] = scriptsData.map((r: any) => ({
              id: r.id, newsId: r.news_id, hook: r.hook, setup: r.setup,
              points: r.points, twist: r.twist, cta: r.cta, fullScript: r.full_script,
              format: r.format, duration: r.duration, viralTitle: r.viral_title,
              description: r.description, tags: r.tags, thumbnailText: r.thumbnail_text,
              thumbnailIdea: r.thumbnail_idea, imagePrompt: r.image_prompt, createdAt: r.created_at,
            }));
            set({ scripts });
          }

          if (reelsData) {
            const reels: CreatorReel[] = reelsData.map((r: any) => ({
              id: r.id, newsId: r.news_id, creatorId: r.creator_id,
              creatorName: r.profiles?.name || currentUser.name,
              creatorAvatar: r.profiles?.avatar_url || currentUser.avatar,
              videoUrl: r.video_url, thumbnailUrl: r.thumbnail_url, caption: r.caption,
              likes: r.likes, views: r.views, duration: r.duration, createdAt: r.created_at,
            }));
            set({ reels });
          }
        }).catch(() => {});
      } else {
        localStorage.removeItem('trendsense_user');
        set({ user: null, isAuthenticated: false, isAuthLoading: false, dailyUsage: { scripts: 0, narrations: 0, videoGenerations: 0 }, isPro: false });
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
        if (n.sourceUrl && (n.trendAnalysis || n.explanation || n.narrationScript)) {
          enrichMap.set(n.sourceUrl, {
            trendAnalysis: n.trendAnalysis,
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
    const user = get().user;
    const scripts = [script, ...get().scripts].slice(0, 100);
    set({ scripts });
    // Sync to Supabase
    if (user) {
      supabase.from('creator_scripts').insert({
        id: script.id,
        user_id: user.id,
        news_id: script.newsId,
        hook: script.hook,
        setup: script.setup,
        points: script.points,
        twist: script.twist,
        cta: script.cta,
        full_script: script.fullScript,
        format: script.format,
        duration: script.duration,
        viral_title: script.viralTitle,
        description: script.description,
        tags: script.tags,
        thumbnail_text: script.thumbnailText,
        thumbnail_idea: script.thumbnailIdea,
        image_prompt: script.imagePrompt,
        created_at: script.createdAt,
      }).then(() => {});
    }
  },
  
  // Reels
  reels: [],
  
  loadReelsForNews: (newsId: string) => {
    return get().reels.filter(r => r.newsId === newsId);
  },
  
  addReel: async (reel: CreatorReel) => {
    const user = get().user;
    if (!user) {
      console.error('addReel: no user');
      throw new Error('Not logged in');
    }

    // Insert into Supabase first — let the DB generate the UUID
    const payload = {
      news_id: reel.newsId,
      creator_id: user.id,
      video_url: reel.videoUrl,
      thumbnail_url: reel.thumbnailUrl,
      caption: reel.caption,
      likes: reel.likes,
      views: reel.views,
      duration: reel.duration,
    };
    console.log('addReel: inserting', payload);
    const { data, error } = await supabase.from('reels').insert(payload).select('id, created_at').single();

    if (error) {
      console.error('addReel: Supabase error', error);
      throw new Error(error.message);
    }

    console.log('addReel: success', data);
    // Use the real DB id so reloads find it
    const saved: CreatorReel = { ...reel, id: data.id, createdAt: data.created_at };
    const reels = [saved, ...get().reels].slice(0, 50);
    set({ reels });
  },
  
  getAllReels: () => get().reels,
  
  // UI
  currentView: 'feed',
  setView: (view) => set({ currentView: view }),
  showCreatorMode: false,
  setCreatorMode: (show) => set({ showCreatorMode: show }),
  prefilledHook: null,
  setPrefilledHook: (hook) => set({ prefilledHook: hook }),
  
  // User behavior
  addToHistory: (newsId) => {
    const user = get().user;
    if (user) {
      user.history = [newsId, ...user.history.filter(id => id !== newsId)].slice(0, 100);
      set({ user: { ...user } });
      localStorage.setItem('trendsense_user', JSON.stringify(user));
      // Sync to Supabase (upsert so repeated views just update timestamp)
      supabase.from('user_history').upsert(
        { user_id: user.id, news_id: newsId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,news_id' }
      ).then(() => {});
    }
  },
  
  toggleSaved: (newsId) => {
    const user = get().user;
    if (user) {
      const isSaved = user.savedStories.includes(newsId);
      const saved = isSaved
        ? user.savedStories.filter(id => id !== newsId)
        : [newsId, ...user.savedStories].slice(0, 500);
      user.savedStories = saved;
      set({ user: { ...user } });
      localStorage.setItem('trendsense_user', JSON.stringify(user));
      // Sync to Supabase
      if (isSaved) {
        supabase.from('saved_stories').delete().eq('user_id', user.id).eq('news_id', newsId).then(() => {});
      } else {
        supabase.from('saved_stories').insert({ user_id: user.id, news_id: newsId }).then(() => {});
      }
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
