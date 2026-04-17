import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Heart, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import ReelPlayer from './ReelPlayer';
import type { CreatorReel } from '../types';

interface ReelCarouselProps {
  newsId: string;
}

export default function ReelCarousel({ newsId }: ReelCarouselProps) {
  const { reels, setView, setCreatorMode } = useStore();
  const [activeReel, setActiveReel] = useState<CreatorReel | null>(null);

  const newsReels = reels.filter(r => r.newsId === newsId);

  const handleCreateReel = () => {
    setCreatorMode(true);
    setView('creator');
  };

  if (newsReels.length === 0) {
    return (
      <section className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-purple-400">Creator Reels</h3>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          No reels yet for this story. Be the first creator to make one!
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
