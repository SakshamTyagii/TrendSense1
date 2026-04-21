import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, Share2, ChevronUp, Volume2, VolumeX, Sparkles, Clock, TrendingUp, Loader2, Film } from 'lucide-react';
import { useStore } from '../store/useStore';
import { speakText, stopSpeaking } from '../lib/ttsService';
import { generateNarrationScript } from '../lib/aiService';
import ProGate from './ProGate';
import type { NewsItem } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface FeedCardProps {
  news: NewsItem;
  index: number;
  isActive: boolean;
}

export default function FeedCard({ news, index, isActive }: FeedCardProps) {
  const { setSelectedNews, setView, isPlaying, currentAudioId, setPlaying, user, toggleSaved, addToHistory, setCreatorMode, updateNewsItem, loadReelsForNews } = useStore();
  const reelCount = loadReelsForNews(news.id).length;
  const cardRef = useRef<HTMLDivElement>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [showProGate, setShowProGate] = useState<{ feature: string; used: number; limit: number } | null>(null);
  const isCurrentPlaying = isPlaying && currentAudioId === news.id;
  const isSaved = user?.savedStories.includes(news.id) || false;

  useEffect(() => {
    if (isActive) {
      addToHistory(news.id);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive && isCurrentPlaying) {
      stopSpeaking();
      setPlaying(false);
    }
  }, [isActive]);

  const handlePlayAudio = async () => {
    if (isCurrentPlaying) {
      stopSpeaking();
      setPlaying(false);
      return;
    }

    // Use cached narration, or generate one
    let narration = news.narrationScript;
    if (!narration) {
      setIsLoadingAudio(true);
      try {
        narration = await generateNarrationScript(news);
        const updated = { ...news, narrationScript: narration };
        updateNewsItem(updated);
      } catch {
        // Fallback to description if AI fails
        narration = news.trendAnalysis?.whatsGoingOn || news.explanation || news.description;
      }
      setIsLoadingAudio(false);
    }

    speakText(narration, () => setPlaying(false));
    setPlaying(true, news.id);
  };

  const handleExpand = () => {
    setSelectedNews(news);
    setView('detail');
  };

  const handleCreator = () => {
    setSelectedNews(news);
    setCreatorMode(true);
    setView('creator');
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: news.title, text: news.description });
    }
  };

  const categoryColors: Record<string, string> = {
    tech: 'from-blue-500 to-cyan-500',
    politics: 'from-red-500 to-orange-500',
    finance: 'from-green-500 to-emerald-500',
    sports: 'from-yellow-500 to-amber-500',
    entertainment: 'from-purple-500 to-pink-500',
    world: 'from-indigo-500 to-violet-500',
  };

  return (
    <>
    {showProGate && (
      <ProGate
        feature={showProGate.feature}
        used={showProGate.used}
        limit={showProGate.limit}
        onClose={() => setShowProGate(null)}
      />
    )}
    <div
      ref={cardRef}
      className="relative w-full h-screen snap-start snap-always flex-shrink-0"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={news.imageUrl}
          alt={news.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = `/images/category-${news.category}.jpg`; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 h-full flex flex-col justify-end pb-24 px-5">
        {/* Category + Trend Score */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isActive ? 0.2 : 0 }}
          className="flex items-center gap-2 mb-3"
        >
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r ${categoryColors[news.category]} text-white`}>
            {news.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold bg-amber-400/10 px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" />
            {news.trendScore}%
          </span>
          {reelCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-pink-400 font-semibold bg-pink-400/10 px-2 py-1 rounded-full">
              <Film className="w-3 h-3" />
              {reelCount} {reelCount === 1 ? 'Reel' : 'Reels'}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(news.publishedAt), { addSuffix: true })}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isActive ? 0.3 : 0 }}
          className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3 max-w-lg"
        >
          {news.title}
        </motion.h2>

        {/* Source */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: isActive ? 0.4 : 0 }}
          className="flex items-center gap-2 mb-3"
        >
          <span className="text-xs text-gray-300 bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
            {news.source}
          </span>
        </motion.div>

        {/* Preview text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isActive ? 0.5 : 0 }}
        >
          <p className="text-gray-300 text-sm leading-relaxed line-clamp-3 max-w-lg mb-4">
            {(news.trendAnalysis?.whatsGoingOn || news.explanation) ? (news.trendAnalysis?.whatsGoingOn || news.explanation || '').slice(0, 200) + '...' : news.description}
          </p>
        </motion.div>

        {/* Action buttons row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isActive ? 0.6 : 0 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
              isCurrentPlaying
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                : isLoadingAudio
                ? 'bg-white/10 text-white/50'
                : 'bg-white/15 text-white backdrop-blur-sm hover:bg-white/25'
            }`}
          >
            {isLoadingAudio ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>    
            ) : isCurrentPlaying ? (
              <><VolumeX className="w-4 h-4" /> Stop</>    
            ) : (
              <><Volume2 className="w-4 h-4" /> Listen</>    
            )}
          </button>

          <button
            onClick={handleExpand}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 font-semibold text-sm transition-all"
          >
            <ChevronUp className="w-4 h-4" />
            Full Story
          </button>

          <button
            onClick={handleCreator}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Create
          </button>
        </motion.div>
      </div>

      {/* Side actions */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5 z-20">
        <button
          onClick={() => toggleSaved(news.id)}
          className="flex flex-col items-center gap-1"
        >
          {isSaved ? (
            <BookmarkCheck className="w-7 h-7 text-indigo-400" />
          ) : (
            <Bookmark className="w-7 h-7 text-white/70 hover:text-white transition-colors" />
          )}
          <span className="text-[10px] text-white/50">Save</span>
        </button>
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1"
        >
          <Share2 className="w-7 h-7 text-white/70 hover:text-white transition-colors" />
          <span className="text-[10px] text-white/50">Share</span>
        </button>
      </div>

      {/* Scroll indicator */}
      {index === 0 && isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronUp className="w-5 h-5 text-white/40 rotate-180" />
          </motion.div>
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Scroll for more</span>
        </motion.div>
      )}
    </div>
    </>
  );
}
