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
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed bottom-0 left-0 right-0 z-[100]"
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-[#0a0a0f]/70 backdrop-blur-2xl border-t border-white/[0.06]" />

      <div
        className="relative flex items-center justify-around px-2 pt-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {items.map(item => {
          const isActive = currentView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNav(item.id)}
              whileTap={{ scale: 0.85 }}
              className="flex flex-col items-center gap-1 py-1.5 px-5 relative min-w-[3rem]"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-indigo-400"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
                />
              )}
              <item.icon
                className={`w-[22px] h-[22px] transition-all duration-200 ${
                  isActive ? 'text-white scale-110' : 'text-gray-600'
                }`}
              />
              <span
                className={`text-[10px] transition-all duration-200 ${
                  isActive ? 'text-white font-semibold' : 'text-gray-600'
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
