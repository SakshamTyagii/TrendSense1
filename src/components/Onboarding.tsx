import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { INTEREST_OPTIONS, type UserIntent, type ContentFormat, type IntentProfile } from '../types';

/* ─── Static Data ─────────────────────────────────────────────────────── */
const INTENT_OPTIONS: { id: UserIntent; label: string; emoji: string; desc: string; gradient: string }[] = [
  { id: 'educational',       label: 'Learn',          emoji: '🎓', desc: 'Stay informed with clear explanations',    gradient: 'from-blue-500/20 to-cyan-500/20' },
  { id: 'entertainment',     label: 'Entertainment',  emoji: '🎬', desc: 'Discover fun & engaging stories',          gradient: 'from-pink-500/20 to-rose-500/20' },
  { id: 'content_creation',  label: 'Create Content', emoji: '🎯', desc: 'Turn trends into viral content',           gradient: 'from-purple-500/20 to-violet-500/20' },
  { id: 'general_knowledge', label: 'Stay Updated',   emoji: '🌍', desc: "General awareness of what's happening",    gradient: 'from-emerald-500/20 to-teal-500/20' },
];

const FORMAT_OPTIONS: { id: ContentFormat; label: string; emoji: string; desc: string; gradient: string }[] = [
  { id: 'reels',   label: 'Reels',   emoji: '🎥', desc: 'Short-form vertical videos',     gradient: 'from-rose-500/20 to-orange-500/20' },
  { id: 'scripts', label: 'Scripts',  emoji: '📝', desc: 'Ready-to-film viral scripts',     gradient: 'from-sky-500/20 to-blue-500/20' },
  { id: 'audio',   label: 'Audio',    emoji: '🎙️', desc: 'Podcast-style narrations',        gradient: 'from-amber-500/20 to-yellow-500/20' },
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function buildIntentProfile(intents: UserIntent[]): IntentProfile {
  const profile: IntentProfile = { content_creation: 0, entertainment: 0, education: 0, general: 0.4 };
  for (const i of intents) {
    if (i === 'content_creation') profile.content_creation = 1.0;
    if (i === 'entertainment') profile.entertainment = 1.0;
    if (i === 'educational') profile.education = 1.0;
    if (i === 'general_knowledge') profile.general = 1.0;
  }
  if (!intents.includes('content_creation') && intents.includes('entertainment')) profile.content_creation = 0.3;
  if (!intents.includes('entertainment') && intents.includes('content_creation')) profile.entertainment = 0.4;
  return profile;
}

/* ─── Floating Particles (background ambiance) ────────────────────────── */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  duration: Math.random() * 12 + 10,
  delay: Math.random() * 5,
  opacity: Math.random() * 0.3 + 0.1,
}));

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-indigo-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 10, -20, 0],
            x: [0, 15, -10, 5, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity, p.opacity * 1.5, p.opacity],
          }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─── Aurora gradient background ──────────────────────────────────────── */
function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(168,85,247,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(236,72,153,0.08) 0%, transparent 50%)',
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute top-0 left-0 w-full h-full"
        style={{
          background: 'radial-gradient(ellipse at 60% 30%, rgba(56,189,248,0.1) 0%, transparent 50%)',
        }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ─── Animated heading (word-by-word reveal) ──────────────────────────── */
function AnimatedHeading({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <h1 className={`text-[28px] font-black text-white leading-tight ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.1 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}

/* ─── Animated subtitle ───────────────────────────────────────────────── */
function AnimatedSubtitle({ text, delay = 0.4 }: { text: string; delay?: number }) {
  return (
    <motion.p
      className="text-sm text-gray-400 mt-2 leading-relaxed"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      {text}
    </motion.p>
  );
}

/* ─── Glow ring on selection ──────────────────────────────────────────── */
function SelectionRing({ color = 'indigo' }: { color?: string }) {
  return (
    <motion.div
      className={`absolute inset-0 rounded-2xl border-2 border-${color}-400/50`}
      initial={{ scale: 1, opacity: 0.8 }}
      animate={{ scale: 1.04, opacity: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  );
}

/* ─── Step indicator dots ─────────────────────────────────────────────── */
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor: i === current ? 'rgb(129, 140, 248)' : i < current ? 'rgb(99, 102, 241)' : 'rgba(255,255,255,0.1)',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      ))}
    </div>
  );
}

/* ─── Personalizing orbs (final step) ─────────────────────────────────── */
function PersonalizingOrbs() {
  return (
    <div className="relative w-40 h-40 mb-10">
      {/* Outer ring particles */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <motion.div
          key={`ring-${i}`}
          className="absolute w-3 h-3 rounded-full"
          style={{
            background: `hsl(${240 + i * 20}, 80%, 65%)`,
            top: '50%', left: '50%',
          }}
          animate={{
            x: [0, Math.cos(i * 60 * Math.PI / 180) * 70],
            y: [0, Math.sin(i * 60 * Math.PI / 180) * 70],
            scale: [0, 1, 0.5],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
        />
      ))}
      {/* Orbiting dots */}
      {[0, 1, 2].map(i => (
        <motion.div
          key={`orbit-${i}`}
          className="absolute w-2 h-2 rounded-full bg-white/60"
          style={{ top: '50%', left: '50%', marginTop: -4, marginLeft: -4 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
        >
          <motion.div
            className="absolute rounded-full bg-white/40"
            style={{ width: 6, height: 6, top: -(30 + i * 12), left: -1 }}
          />
        </motion.div>
      ))}
      {/* Core orb */}
      <motion.div
        className="absolute inset-0 m-auto w-28 h-28 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #6366f1, #a855f7, #ec4899, #6366f1)',
          filter: 'blur(1px)',
        }}
        animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
        transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }}
      />
      {/* Inner glow */}
      <motion.div
        className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-[#0a0a0f]"
        animate={{ scale: [1, 0.92, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Center icon */}
      <motion.div
        className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles className="w-6 h-6 text-white" />
      </motion.div>
      {/* Glow halo */}
      <motion.div
        className="absolute inset-0 m-auto w-40 h-40 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ─── Progress counter animation ──────────────────────────────────────── */
function AnimatedCounter({ value, max }: { value: number; max: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, v => Math.round(v));
  // Animate the counter whenever value changes
  useMemo(() => { animate(mv, value, { duration: 0.3 }); }, [value, mv]);
  return (
    <span className={`ml-2 font-bold tabular-nums ${value >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
      <motion.span>{display}</motion.span>/{max}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0, scale: 0.95, filter: 'blur(4px)' }),
  center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0, scale: 0.95, filter: 'blur(4px)' }),
};

const cardStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 30, scale: 0.92 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

const pillStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const pillItem = {
  hidden: { opacity: 0, scale: 0.7, y: 15 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 22 } },
};

export default function Onboarding() {
  const { completeOnboarding, skipOnboarding } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [intents, setIntents] = useState<UserIntent[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [formats, setFormats] = useState<ContentFormat[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSelected, setJustSelected] = useState<string | null>(null);

  const showCreatorStep = intents.includes('content_creation');
  const totalSteps = showCreatorStep ? 4 : 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const goNext = useCallback(() => { setDir(1); setStep(s => s + 1); }, []);
  const goBack = useCallback(() => { setDir(-1); setStep(s => s - 1); }, []);

  const toggleIntent = (id: UserIntent) => {
    setJustSelected(id);
    setTimeout(() => setJustSelected(null), 600);
    setIntents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleInterest = (id: string) => {
    setJustSelected(id);
    setTimeout(() => setJustSelected(null), 600);
    setInterests(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const toggleFormat = (id: ContentFormat) => {
    setJustSelected(id);
    setTimeout(() => setJustSelected(null), 600);
    setFormats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFinish = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const intentProfile = buildIntentProfile(intents);
    await completeOnboarding(intents, intentProfile, interests, formats);
  }, [isSubmitting, intents, interests, formats, completeOnboarding]);

  const getStepContent = () => {
    if (step === 0) return 'intent';
    if (step === 1) return 'interests';
    if (step === 2 && showCreatorStep) return 'creator';
    return 'personalizing';
  };
  const currentStep = getStepContent();

  const canContinue =
    (currentStep === 'intent' && intents.length >= 1) ||
    (currentStep === 'interests' && interests.length >= 3) ||
    (currentStep === 'creator');

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Animated background layers */}
      <AuroraBackground />
      <FloatingParticles />

      {/* Progress bar with glow */}
      <div className="relative z-10 w-full h-1 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white"
            animate={{ boxShadow: ['0 0 6px 2px rgba(129,140,248,0.6)', '0 0 12px 4px rgba(168,85,247,0.8)', '0 0 6px 2px rgba(129,140,248,0.6)'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        {step > 0 && currentStep !== 'personalizing' ? (
          <motion.button
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.05 }}
            onClick={goBack}
            className="w-10 h-10 rounded-full bg-white/[0.07] backdrop-blur-sm flex items-center justify-center border border-white/[0.08]"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
        ) : <div className="w-10" />}
        <StepDots current={step} total={totalSteps} />
        {currentStep !== 'personalizing' && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={skipOnboarding}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]"
          >
            Skip
          </motion.button>
        )}
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex flex-col px-6 overflow-y-auto pb-32">
        <AnimatePresence mode="wait" custom={dir}>

          {/* ═══ STEP 1: Intent ═══ */}
          {currentStep === 'intent' && (
            <motion.div key="intent" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <AnimatedHeading text="What brings you here?" />
                <AnimatedSubtitle text="Select all that apply — we'll personalize everything for you." />
              </div>
              <motion.div className="grid grid-cols-1 gap-3" variants={cardStagger} initial="hidden" animate="show">
                {INTENT_OPTIONS.map(opt => {
                  const selected = intents.includes(opt.id);
                  const wasJustSelected = justSelected === opt.id;
                  return (
                    <motion.button key={opt.id} variants={cardItem}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleIntent(opt.id)}
                      className={`relative flex items-center gap-4 p-5 rounded-2xl text-left border overflow-hidden ${
                        selected
                          ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/15'
                          : 'border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      {/* Card background gradient */}
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-r ${opt.gradient}`}
                        animate={{ opacity: selected ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                      />
                      <div className={`absolute inset-0 ${selected ? '' : 'bg-white/[0.03]'}`} />

                      {/* Selection ring burst */}
                      {wasJustSelected && selected && <SelectionRing />}

                      {/* Emoji with bounce */}
                      <motion.span
                        className="relative text-3xl"
                        animate={selected ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : { scale: 1 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      >
                        {opt.emoji}
                      </motion.span>
                      <div className="relative flex-1 min-w-0">
                        <p className={`font-bold text-sm ${selected ? 'text-white' : 'text-gray-200'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      {/* Animated checkmark */}
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="relative w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/40"
                          >
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Interests ═══ */}
          {currentStep === 'interests' && (
            <motion.div key="interests" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <AnimatedHeading text="Pick your interests" />
                <motion.p
                  className="text-sm text-gray-400 mt-2 leading-relaxed"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  Choose 3–5 topics. We'll prioritize these in your feed.
                  <AnimatedCounter value={interests.length} max={5} />
                </motion.p>
              </div>
              <motion.div className="flex flex-wrap gap-3" variants={pillStagger} initial="hidden" animate="show">
                {INTEREST_OPTIONS.map(opt => {
                  const selected = interests.includes(opt.id);
                  return (
                    <motion.button key={opt.id} variants={pillItem}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleInterest(opt.id)}
                      layout
                      className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold border overflow-hidden ${
                        selected
                          ? 'border-indigo-500/50 text-white shadow-lg shadow-indigo-500/15'
                          : 'border-white/[0.08] text-gray-400 hover:text-gray-200 hover:border-white/[0.15]'
                      }`}
                    >
                      {/* Background */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
                        animate={{ opacity: selected ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                      />
                      <div className={`absolute inset-0 ${selected ? '' : 'bg-white/[0.03]'}`} />

                      <motion.span
                        className="relative text-lg"
                        animate={selected ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {opt.emoji}
                      </motion.span>
                      <span className="relative">{opt.label}</span>
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 18, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="relative overflow-hidden"
                          >
                            <Check className="w-4 h-4 text-indigo-400" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>

              {/* Visual feedback: selected interest tags */}
              <AnimatePresence>
                {interests.length > 0 && (
                  <motion.div
                    className="mt-8 flex flex-wrap gap-2"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <span className="text-xs text-gray-600 self-center mr-1">Your picks:</span>
                    {interests.map(id => {
                      const opt = INTEREST_OPTIONS.find(o => o.id === id);
                      return opt ? (
                        <motion.span
                          key={id}
                          layoutId={`tag-${id}`}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs font-medium border border-indigo-500/20"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          {opt.emoji} {opt.label}
                        </motion.span>
                      ) : null;
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═══ STEP 3: Creator Prefs (conditional) ═══ */}
          {currentStep === 'creator' && (
            <motion.div key="creator" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col"
            >
              <div className="pt-8 pb-6">
                <AnimatedHeading text="What do you create?" />
                <AnimatedSubtitle text="We'll tailor scripts, tools, and suggestions to your format." />
              </div>
              <motion.div className="grid grid-cols-1 gap-3" variants={cardStagger} initial="hidden" animate="show">
                {FORMAT_OPTIONS.map(opt => {
                  const selected = formats.includes(opt.id);
                  const wasJustSelected = justSelected === opt.id;
                  return (
                    <motion.button key={opt.id} variants={cardItem}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleFormat(opt.id)}
                      className={`relative flex items-center gap-4 p-5 rounded-2xl text-left border overflow-hidden ${
                        selected
                          ? 'border-purple-500/50 shadow-lg shadow-purple-500/15'
                          : 'border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      <motion.div
                        className={`absolute inset-0 bg-gradient-to-r ${opt.gradient}`}
                        animate={{ opacity: selected ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                      />
                      <div className={`absolute inset-0 ${selected ? '' : 'bg-white/[0.03]'}`} />

                      {wasJustSelected && selected && <SelectionRing color="purple" />}

                      <motion.span
                        className="relative text-3xl"
                        animate={selected ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : { scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        {opt.emoji}
                      </motion.span>
                      <div className="relative flex-1 min-w-0">
                        <p className={`font-bold text-sm ${selected ? 'text-white' : 'text-gray-200'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <AnimatePresence>
                        {selected && (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="relative w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/40"
                          >
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </motion.div>
            </motion.div>
          )}

          {/* ═══ STEP 4: Personalizing ═══ */}
          {currentStep === 'personalizing' && (
            <motion.div key="personalizing" custom={dir} variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col items-center justify-center"
              onAnimationComplete={() => { if (!isSubmitting) handleFinish(); }}
            >
              <PersonalizingOrbs />

              <motion.h2
                className="text-2xl font-black text-white mb-3 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
              >
                Personalizing your feed
              </motion.h2>

              <motion.p
                className="text-sm text-gray-400 text-center max-w-[260px] leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                Setting up AI-powered recommendations just for you
              </motion.p>

              {/* Animated loading dots */}
              <div className="flex gap-1.5 mt-6">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-400"
                    animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <AnimatePresence>
        {currentStep !== 'personalizing' && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-20 p-5"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {/* Fade gradient behind button */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/95 to-transparent pointer-events-none" />

            <motion.button
              whileTap={canContinue ? { scale: 0.96 } : {}}
              whileHover={canContinue ? { scale: 1.01 } : {}}
              onClick={goNext}
              disabled={!canContinue}
              className={`relative w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base overflow-hidden ${
                !canContinue
                  ? 'bg-white/[0.05] text-gray-600 cursor-not-allowed'
                  : 'text-white shadow-xl shadow-indigo-500/25'
              }`}
            >
              {/* Button gradient background */}
              {canContinue && (
                <>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                    style={{ backgroundSize: '200% 200%' }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
                  />
                </>
              )}
              <span className="relative z-10">Continue</span>
              <ArrowRight className="relative z-10 w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
