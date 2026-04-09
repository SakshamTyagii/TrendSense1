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
      ref={scrollRef}
      className="fixed top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent pt-[max(1rem,env(safe-area-inset-top))] pb-3"
    >
      <div className="flex items-center gap-2 px-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {allCategories.map(cat => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.label}
              onClick={() => setCategory(cat.id)}
              className={`relative flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
