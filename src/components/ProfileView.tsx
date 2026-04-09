import { motion } from 'framer-motion';
import { ArrowLeft, LogOut, Moon, Volume2, Bell, Shield, ChevronRight, Bookmark, Clock, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { CATEGORIES } from '../types';

export default function ProfileView() {
  const { user, logout, setView } = useStore();

  if (!user) return null;

  const menuItems = [
    { icon: Bookmark, label: 'Saved Stories', count: user.savedStories.length, color: 'text-indigo-400' },
    { icon: Clock, label: 'History', count: user.history.length, color: 'text-blue-400' },
    { icon: Sparkles, label: 'My Scripts', count: 0, color: 'text-purple-400' },
  ];

  const settingsItems = [
    { icon: Volume2, label: 'Auto-play Audio', toggle: true, value: user.preferences.autoPlayAudio },
    { icon: Moon, label: 'Dark Mode', toggle: true, value: user.preferences.darkMode },
    { icon: Bell, label: 'Notifications', toggle: true, value: true },
    { icon: Shield, label: 'Privacy', toggle: false },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-[#0a0a0f] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button
          onClick={() => setView('feed')}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Profile</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 py-6">
        {/* User info */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-full bg-white/10"
          />
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-gray-500 text-sm">{user.email}</p>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mt-1 inline-block">
              {user.provider === 'google' ? 'Google' : 'X'} Account
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {menuItems.map(item => (
            <div key={item.label} className="bg-white/5 rounded-2xl p-4 text-center">
              <item.icon className={`w-5 h-5 mx-auto mb-2 ${item.color}`} />
              <p className="text-xl font-bold text-white">{item.count}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Preferred categories */}
        <div className="mb-8">
          <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3">Your Interests</h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <span
                key={cat.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  user.preferences.categories.includes(cat.id)
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-white/5 text-gray-500 border border-white/5'
                }`}
              >
                {cat.label}
              </span>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="mb-8">
          <h3 className="text-xs text-gray-600 uppercase tracking-wider mb-3">Settings</h3>
          <div className="space-y-1">
            {settingsItems.map(item => (
              <div
                key={item.label}
                className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-300">{item.label}</span>
                </div>
                {item.toggle ? (
                  <div className={`w-10 h-6 rounded-full transition-colors ${
                    item.value ? 'bg-indigo-500' : 'bg-white/10'
                  } flex items-center ${item.value ? 'justify-end' : 'justify-start'} px-0.5`}>
                    <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                  </div>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-all border border-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          TrendSense v1.0 · AI-Powered News Platform
        </p>
      </div>
    </motion.div>
  );
}
