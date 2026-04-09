import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import FeedCard from './FeedCard';
import { Loader2 } from 'lucide-react';

export default function HomeFeed() {
  const { filteredNews, isLoadingNews, loadNews } = useStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNews();
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const cardHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / cardHeight);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex]);

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

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`::-webkit-scrollbar { display: none; }`}</style>
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
