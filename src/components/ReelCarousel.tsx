import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Heart, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import ReelPlayer from './ReelPlayer';
import type { CreatorReel } from '../types';

interface ReelCarouselProps {
  newsId: string;
}

export default function ReelCarousel({ newsId }: ReelCarouselProps) {
  const { reels: storeReels, setView, setCreatorMode } = useStore();
  const [activeReel, setActiveReel] = useState<CreatorReel | null>(null);
  const [fetchedReels, setFetchedReels] = useState<CreatorReel[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch reels for this specific news story from Supabase (all creators)
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('reels')
      .select('*, profiles(name, avatar_url)')
      .eq('news_id', newsId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (cancelled || !data) { setLoaded(true); return; }
        const mapped: CreatorReel[] = data.map((r: any) => ({
          id: r.id, newsId: r.news_id, creatorId: r.creator_id,
          creatorName: r.profiles?.name || 'Creator',
          creatorAvatar: r.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.creator_id}`,
          videoUrl: r.video_url, thumbnailUrl: r.thumbnail_url || '', caption: r.caption,
          likes: r.likes, views: r.views, duration: r.duration, createdAt: r.created_at,
        }));
        setFetchedReels(mapped);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [newsId]);

  // Merge: show fetched reels, but also include any just-uploaded reel from the store
  // that might not be in fetchedReels yet (avoids a "disappears then reappears" flash)
  const fetchedIds = new Set(fetchedReels.map(r => r.id));
  const newStoreReels = storeReels.filter(r => r.newsId === newsId && !fetchedIds.has(r.id));
  const newsReels = [...newStoreReels, ...fetchedReels];

  const handleCreateReel = () => {
    setCreatorMode(true);
    setView('creator');
  };

  if (!loaded) return null; // Don't flash empty state while fetching

  if (newsReels.length === 0) {
    return (
      <section className="bg-gradient-to-r from-purple-500/5 to-pink-500/5 border border-purple-500/15 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-purple-400 mb-2">🚀 Be the first to go viral on this</h3>
        <p className="text-gray-500 text-xs mb-4">
          No one has made a reel on this story yet. This is your chance to be first.
        </p>
        <button
          onClick={handleCreateReel}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20"
        >
          <Sparkles className="w-4 h-4" />
          Create a Reel
        </button>
      </section>
    );
  }

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Creator Reels</h3>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {newsReels.length}
            </span>
          </div>
          <button
            onClick={handleCreateReel}
            className="text-xs text-purple-400 font-semibold"
          >
            + Create
          </button>
        </div>

        {/* Horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {newsReels.map((reel) => (
            <motion.button
              key={reel.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveReel(reel)}
              className="flex-shrink-0 w-32 group"
            >
              {/* Thumbnail */}
              <div className="relative w-32 h-48 rounded-xl overflow-hidden bg-white/5 mb-2">
                {reel.thumbnailUrl ? (
                  <img
                    src={reel.thumbnailUrl}
                    alt={reel.caption}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white/40" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                </div>
                {/* Duration */}
                <span className="absolute bottom-1.5 right-1.5 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">
                  {Math.floor(reel.duration / 60)}:{String(reel.duration % 60).padStart(2, '0')}
                </span>
                {/* Likes */}
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
                  <Heart className="w-3 h-3 text-pink-400" />
                  <span className="text-[10px] text-white">{reel.likes}</span>
                </div>
              </div>
              {/* Creator info */}
              <div className="flex items-center gap-1.5">
                <img
                  src={reel.creatorAvatar}
                  alt={`${reel.creatorName} avatar`}
                  className="w-5 h-5 rounded-full bg-white/10"
                />
                <span className="text-xs text-gray-400 truncate">{reel.creatorName}</span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Full-screen reel player overlay */}
      {activeReel && (
        <ReelPlayer
          reel={activeReel}
          allReels={newsReels}
          onClose={() => setActiveReel(null)}
        />
      )}
    </>
  );
}
