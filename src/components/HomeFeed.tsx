import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import FeedCard from './FeedCard';
import { Loader2, RefreshCw, AlertCircle, ArrowUp } from 'lucide-react';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export default function HomeFeed() {
  const { filteredNews, isLoadingNews, newsError, loadNews, pendingNews, applyPendingNews, loadNewsBackground, currentView } = useStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNews();
  }, []);

  // Auto-refresh every 10 minutes (only when tab visible + on feed)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && currentView === 'feed') {
        loadNewsBackground();
      }
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [currentView]);

  const handleApplyPending = () => {
    applyPendingNews();
    setActiveIndex(0);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const cardHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / cardHeight);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex]);

  // Loading state
  if (isLoadingNews && filteredNews.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-500 text-sm">Loading stories...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (newsError && filteredNews.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-white font-bold text-lg">Failed to Load News</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{newsError}</p>
          <button
            onClick={() => loadNews()}
            className="mt-2 flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  // Empty state (no error but no articles)
  if (!isLoadingNews && filteredNews.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-black px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 max-w-sm text-center"
        >
          <p className="text-gray-400 text-sm">No stories found.</p>
          <button
            onClick={() => loadNews()}
            className="mt-2 flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 text-white font-semibold text-sm hover:bg-indigo-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide relative"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`::-webkit-scrollbar { display: none; }`}</style>

      {/* New stories pill */}
      <AnimatePresence>
        {pendingNews && (
          <motion.button
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            onClick={handleApplyPending}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/30 backdrop-blur-sm"
          >
            <ArrowUp className="w-4 h-4" />
            New stories available
          </motion.button>
        )}
      </AnimatePresence>

      {filteredNews.map((news, index) => (
          <FeedCard
            key={news.id}
            news={news}
            index={index}
            isActive={index === activeIndex}
          />
      ))}
    </div>
  );
}
