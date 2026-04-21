import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { CATEGORIES } from '../types';
import type { Category } from '../types';

export default function CategoryBar() {
  const { selectedCategory, setCategory } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const allCategories = [{ id: null as Category | null, label: 'For You' }, ...CATEGORIES.map(c => ({ id: c.id as Category | null, label: c.label }))];

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-black via-black/90 to-transparent"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide snap-x-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {allCategories.map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <motion.button
              key={cat.label}
              onClick={() => setCategory(cat.id)}
              whileTap={{ scale: 0.92 }}
              className={`relative flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 snap-center ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 active:text-gray-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="category-bg"
                  className="absolute inset-0 bg-white/15 backdrop-blur-sm rounded-full border border-white/10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10">{cat.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
