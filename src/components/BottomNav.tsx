import { motion } from 'framer-motion';
import { Newspaper, Search, Sparkles, User } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function BottomNav() {
  const { currentView, setView, setCreatorMode } = useStore();

  const items = [
    { id: 'feed' as const, icon: Newspaper, label: 'Feed' },
    { id: 'search' as const, icon: Search, label: 'Search' },
    { id: 'creator' as const, icon: Sparkles, label: 'Create' },
    { id: 'profile' as const, icon: User, label: 'Profile' },
  ];

  const handleNav = (id: typeof items[number]['id']) => {
    if (id === 'creator') {
      setCreatorMode(true);
      setView('creator');
    } else {
      setView(id);
    }
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-white/5"
    >
      <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map(item => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="flex flex-col items-center gap-0.5 py-1 px-4 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 w-8 h-0.5 rounded-full bg-indigo-500"
                />
              )}
              <item.icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-white' : 'text-gray-600'
                }`}
              />
              <span
                className={`text-[10px] transition-colors ${
                  isActive ? 'text-white font-medium' : 'text-gray-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
