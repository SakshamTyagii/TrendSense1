import type { StyleConfig, VideoStyle } from '../types/video';

// ── 3 Distinct Visual Personalities ────────────────────────────────────

export const STYLE_CONFIGS: Record<VideoStyle, StyleConfig> = {
  'viral-bold': {
    name: 'Viral Bold',
    icon: '🔥',
    fontFamily: 'Impact, Arial Black, sans-serif',
    fontWeight: 900,
    hookFontSize: 72,
    bodyFontSize: 48,
    labelFontSize: 24,
    colors: {
      text: '#FFFFFF',
      textSecondary: '#FFD700',
      accent: '#FF4444',
      bgGradientStart: '#1a0000',
      bgGradientEnd: '#0a0a0f',
      labelBg: '#FF4444',
      labelText: '#FFFFFF',
    },
    textPosition: 'center',
    transition: 'cut',
    transitionDurationMs: 0,
    wordAnimation: 'highlight',
    emphasisEffect: 'shake',
    pacing: 'fast',
  },

  'clean-minimal': {
    name: 'Clean Minimal',
    icon: '🧠',
    fontFamily: 'DM Sans, Helvetica Neue, sans-serif',
    fontWeight: 500,
    hookFontSize: 56,
    bodyFontSize: 40,
    labelFontSize: 20,
    colors: {
      text: '#F0F0F0',
      textSecondary: '#A0A0C0',
      accent: '#6366F1',
      bgGradientStart: '#0f0f1a',
      bgGradientEnd: '#0a0a0f',
      labelBg: 'rgba(99, 102, 241, 0.3)',
      labelText: '#A5B4FC',
    },
    textPosition: 'center',
    transition: 'fade',
    transitionDurationMs: 400,
    wordAnimation: 'fade',
    emphasisEffect: 'none',
    pacing: 'slow',
  },

  'fast-captions': {
    name: 'Fast Captions',
    icon: '⚡',
    fontFamily: 'Arial Black, Impact, sans-serif',
    fontWeight: 900,
    hookFontSize: 64,
    bodyFontSize: 52,
    labelFontSize: 22,
    colors: {
      text: '#FFFFFF',
      textSecondary: '#00FF88',
      accent: '#00D4FF',
      bgGradientStart: '#000a14',
      bgGradientEnd: '#0a0a0f',
      labelBg: '#00D4FF',
      labelText: '#000000',
    },
    textPosition: 'bottom-third',
    transition: 'cut',
    transitionDurationMs: 0,
    wordAnimation: 'pop',
    emphasisEffect: 'scale',
    pacing: 'fast',
  },
};

// ── Scene label configs ────────────────────────────────────────────────

export const SCENE_LABELS: Record<string, string> = {
  hook: '🎯 HOOK',
  context: '📖 CONTEXT',
  insight: '💡 INSIGHT',
  payoff: '🔥 PAYOFF',
};
