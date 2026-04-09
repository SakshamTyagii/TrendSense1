import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CATEGORIES } from '../types';
import type { Category } from '../types';

export default function SearchView() {
  const { search, filteredNews, isLoadingNews, setSelectedNews, setView, setCategory, searchQuery, setSearchQuery } = useStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (value: string) => {
    setLocalQuery(value);
    setSearchQuery(value);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) search(value);
    }, 500);
  };

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleSelectNews = (news: any) => {
    setSelectedNews(news);
    setView('detail');
  };

  const handleCategoryClick = (cat: Category) => {
    setCategory(cat);
    setView('feed');
  };

  const trendingSearches = ['AI regulation', 'Climate summit', 'Stock market rally', 'Space exploration', 'Crypto ETF'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-40 bg-[#0a0a0f] overflow-y-auto"
    >
      {/* Search header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/90 backdrop-blur-xl p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('feed')}
            className="text-gray-400 hover:text-white text-sm font-medium"
          >
            Cancel
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              value={localQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search news, topics, trends..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
            />
            {localQuery && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-6">
        {/* Show results if searching */}
        {localQuery.trim() ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-4">
              {isLoadingNews ? 'Searching...' : `${filteredNews.length} results`}
            </p>
            <AnimatePresence>
              {filteredNews.map((news, i) => (
                <motion.button
                  key={news.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleSelectNews(news)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-left"
                >
                  <img
                    src={news.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold line-clamp-2 mb-1">{news.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 uppercase">{news.source}</span>
                      <span className="text-[10px] text-gray-600">·</span>
                      <span className="text-[10px] text-gray-500">{news.category}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <>
            {/* Trending searches */}
            <div className="mb-8">
              <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" /> Trending Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map(term => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-4 py-2 rounded-full bg-white/5 text-gray-400 text-sm hover:bg-white/10 hover:text-white transition-all border border-white/5"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3">Browse Categories</h3>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className="relative overflow-hidden rounded-2xl h-28 group"
                  >
                    <img src={cat.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
                    <span className="absolute bottom-3 left-3 text-white font-bold text-sm">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
