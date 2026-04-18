import { useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, X, Check, Zap, Loader2, Tag } from 'lucide-react';
import { PRO_PRICE, PRO_PRICE_ORIGINAL, PRO_FEATURES, startCheckout } from '../lib/subscription';
import { useStore } from '../store/useStore';

interface ProGateProps {
  feature: string;
  used: number;
  limit: number;
  onClose: () => void;
  onUpgraded?: () => void;
  emotionalMessage?: string;
}

export default function ProGate({ feature, used, limit, onClose, emotionalMessage }: ProGateProps) {
  const { user } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    
    try {
      const checkoutUrl = await startCheckout(user.id, user.email);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setError('Could not start checkout. Please try again.');
      }
    } catch {
      setError('Payment service unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-5"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#12121a] border border-white/10 rounded-3xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">TrendSense Pro</h3>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Flash discount badge */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Tag className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">Flash Sale · 67% Off</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-gray-500 text-sm line-through">{PRO_PRICE_ORIGINAL}</span>
              <span className="text-white text-lg font-bold">{PRO_PRICE}</span>
            </div>
          </div>
        </div>

        {/* Context message */}
        <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-3 mb-4">
          {emotionalMessage ? (
            <>
              <p className="text-white text-sm font-bold">{emotionalMessage}</p>
              <p className="text-gray-400 text-xs mt-1">
                You've created {used} today — upgrade to keep the momentum going.
              </p>
            </>
          ) : (
            <>
              <p className="text-white text-sm font-bold">You're on a roll 🚀</p>
              <p className="text-gray-400 text-xs mt-1">
                You've used {used}/{limit} free {feature} today. Upgrade to Pro for unlimited access.
              </p>
            </>
          )}
        </div>

        {/* Features */}
        <div className="space-y-2.5 mb-6">
          {PRO_FEATURES.map(f => (
            <div key={f} className="flex items-center gap-3">
              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-gray-300 text-sm">{f}</span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-500/20 mb-3 disabled:opacity-50"
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <><Zap className="w-4 h-4" /> Upgrade to Pro — ₹33/mo</>
          )}
        </button>
        {error && (
          <p className="text-center text-xs text-red-400 mb-2">{error}</p>
        )}
        <p className="text-center text-[10px] text-gray-600">
          Powered by Stripe · Cancel anytime
        </p>
      </motion.div>
    </motion.div>
  );
}
