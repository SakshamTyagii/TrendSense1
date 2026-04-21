import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Zap } from 'lucide-react';
import { useStore } from '../store/useStore';
import { INTEREST_OPTIONS, type UserIntent, type ContentFormat, type IntentProfile } from '../types';

const INTENT_OPTIONS: { id: UserIntent; label: string; emoji: string; desc: string }[] = [
  { id: 'educational', label: 'Learn', emoji: '🎓', desc: 'Stay informed with clear explanations' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', desc: 'Discover fun & engaging stories' },
  { id: 'content_creation', label: 'Create Content', emoji: '🎯', desc: 'Turn trends into viral content' },
  { id: 'general_knowledge', label: 'Stay Updated', emoji: '🌍', desc: 'General awareness of what\'s happening' },
];

const FORMAT_OPTIONS: { id: ContentFormat; label: string; emoji: string }[] = [
  { id: 'reels', label: 'Reels', emoji: '🎥' },
  { id: 'scripts', label: 'Scripts', emoji: '📝' },
  { id: 'audio', label: 'Audio', emoji: '🎙️' },
];

function buildIntentProfile(intents: UserIntent[]): IntentProfile {
  const profile: IntentProfile = { content_creation: 0, entertainment: 0, education: 0, general: 0.4 };
  for (const i of intents) {
    if (i === 'content_creation') profile.content_creation = 1.0;
    if (i === 'entertainment') profile.entertainment = 1.0;
    if (i === 'educational') profile.education = 1.0;
    if (i === 'general_knowledge') profile.general = 1.0;
  }
  // Secondary weights for unselected
  if (!intents.includes('content_creation') && intents.includes('entertainment')) profile.content_creation = 0.3;
  if (!intents.includes('entertainment') && intents.includes('content_creation')) profile.entertainment = 0.4;
  return profile;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
};

export default function Onboarding() {
  const { completeOnboarding, skipOnboarding } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [intents, setIntents] = useState<UserIntent[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showCreatorStep = intents.includes('content_creation');
  const totalSteps = showCreatorStep ? 4 : 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const goNext = useCallback(() => { setDir(1); setStep(s => s + 1); }, []);
  const goBack = useCallback(() => { setDir(-1); setStep(s => s - 1); }, []);

  const toggleIntent = (id: UserIntent) =>
    setIntents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleInterest = (id: string) =>
    setInterests(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });

  const toggleFormat = (id: ContentFormat) =>
    setFormats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleFinish = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const intentProfile = buildIntentProfile(intents);
    await completeOnboarding(intents, intentProfile, interests, formats);
  }, [isSubmitting, intents, interests, formats, completeOnboarding]);

  // Determine actual step content
  const getStepContent = () => {
    if (step === 0) return 'intent';
    if (step === 1) return 'interests';
    if (step === 2 && showCreatorStep) return 'creator';
    return 'personalizing';
  };

  const currentStep = getStepContent();

  // Which step can proceed?
  const canContinue =
    (currentStep === 'intent' && intents.length >= 1) ||
    (currentStep === 'interests' && interests.length >= 3) ||
    (currentStep === 'creator');

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full h-1 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        {step > 0 && currentStep !== 'personalizing' ? (
          <motion.button whileTap={{ scale: 0.9 }} onClick={goBack} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
        ) : <div className="w-10" />}
        <span className="text-xs text-gray-500 font-medium">{step + 1} of {totalSteps}</span>
        {currentStep !== 'personalizing' && (
          <button onClick={skipOnboarding} className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1">Skip</button>
        )}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto pb-32">
        <AnimatePresence mode="wait" custom={dir}>
          {/* ═══ STEP 1: Intent ═══ */}
          {currentStep === 'intent' && (
            <motion.div key="intent" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <h1 className="text-2xl font-black text-white mb-2">What brings you here?</h1>
                <p className="text-sm text-gray-400">Select all that apply — we'll personalize everything for you.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {INTENT_OPTIONS.map(opt => {
                  const selected = intents.includes(opt.id);
                  return (
                    <motion.button key={opt.id} whileTap={{ scale: 0.97 }}
                      onClick={() => toggleIntent(opt.id)}
                      className={`relative flex items-center gap-4 p-5 rounded-2xl text-left transition-all duration-200 border ${
                        selected
                          ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm ${selected ? 'text-white' : 'text-gray-200'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      {selected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0"
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Interests ═══ */}
          {currentStep === 'interests' && (
            <motion.div key="interests" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <h1 className="text-2xl font-black text-white mb-2">Pick your interests</h1>
                <p className="text-sm text-gray-400">
                  Choose 3–5 topics. We'll prioritize these in your feed.
                  <span className={`ml-2 font-semibold ${interests.length >= 3 ? 'text-green-400' : 'text-amber-400'}`}>
                    {interests.length}/5
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {INTEREST_OPTIONS.map(opt => {
                  const selected = interests.includes(opt.id);
                  return (
                    <motion.button key={opt.id} whileTap={{ scale: 0.93 }}
                      onClick={() => toggleInterest(opt.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border ${
                        selected
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-md shadow-indigo-500/10'
                          : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      {opt.label}
                      {selected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Creator Prefs (conditional) ═══ */}
          {currentStep === 'creator' && (
            <motion.div key="creator" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <h1 className="text-2xl font-black text-white mb-2">What do you create?</h1>
                <p className="text-sm text-gray-400">We'll tailor scripts, tools, and suggestions to your format.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {FORMAT_OPTIONS.map(opt => {
                  const selected = formats.includes(opt.id);
                  return (
                    <motion.button key={opt.id} whileTap={{ scale: 0.97 }}
                      onClick={() => toggleFormat(opt.id)}
                      className={`flex items-center gap-4 p-5 rounded-2xl text-left transition-all duration-200 border ${
                        selected
                          ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10'
                          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <p className={`font-bold text-sm ${selected ? 'text-white' : 'text-gray-200'}`}>{opt.label}</p>
                      {selected && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="ml-auto w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center"
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 4: Personalizing ═══ */}
          {currentStep === 'personalizing' && (
            <motion.div key="personalizing" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col items-center justify-center"
              onAnimationComplete={() => { if (!isSubmitting) handleFinish(); }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-8 shadow-2xl shadow-purple-500/30"
              >
                <Zap className="w-10 h-10 text-white" />
              </motion.div>
              <h2 className="text-xl font-black text-white mb-2">Personalizing your feed...</h2>
              <p className="text-sm text-gray-400 text-center">Setting up AI-powered recommendations just for you</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {currentStep !== 'personalizing' && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            disabled={!canContinue}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all ${
              !canContinue
                ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
