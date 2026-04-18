import { motion } from 'framer-motion';
import { Check, Loader2, FileText, Mic, Palette, Film, Sparkles } from 'lucide-react';
import type { VideoProgress as VProgress } from '../types/video';

const STEPS: { id: VProgress['step']; label: string; icon: typeof FileText }[] = [
  { id: 'script', label: 'Writing your script...', icon: FileText },
  { id: 'voiceover', label: 'Recording voiceover...', icon: Mic },
  { id: 'design', label: 'Designing scenes...', icon: Palette },
  { id: 'render', label: 'Rendering video...', icon: Film },
  { id: 'finalize', label: 'Almost ready...', icon: Sparkles },
];

const ORDER: VProgress['step'][] = ['script', 'voiceover', 'design', 'render', 'finalize'];

interface Props {
  progress: VProgress;
}

export default function VideoProgress({ progress }: Props) {
  const activeIdx = ORDER.indexOf(progress.step);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl px-6"
    >
      <div className="w-full max-w-xs space-y-4">
        {STEPS.map((step, i) => {
          const isComplete = i < activeIdx;
          const isActive = i === activeIdx;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                isComplete
                  ? 'bg-green-500/20'
                  : isActive
                    ? 'bg-purple-500/20'
                    : 'bg-white/5'
              }`}>
                {isComplete ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : isActive ? (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 text-gray-600" />
                )}
              </div>

              {/* Label + progress */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  isComplete ? 'text-green-400' : isActive ? 'text-white' : 'text-gray-600'
                }`}>
                  {isActive ? progress.message || step.label : step.label.replace('...', '')}
                  {isActive && progress.step === 'render' && ` ${progress.percent}%`}
                </p>
                {isActive && (
                  <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-purple-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress.percent}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
