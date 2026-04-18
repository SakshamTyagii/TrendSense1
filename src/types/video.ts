// ── Auto Video Generator types ─────────────────────────────────────────

export type VideoStyle = 'viral-bold' | 'clean-minimal' | 'fast-captions';
export type VideoLength = 'short' | 'standard';
export type SceneType = 'hook' | 'context' | 'insight' | 'payoff';

export interface VideoScene {
  type: SceneType;
  text: string;
  words: string[];
  durationMs: number;
}

export interface VideoProgress {
  step: 'script' | 'voiceover' | 'design' | 'render' | 'finalize';
  percent: number;
  message: string;
}

export interface VideoProject {
  id: string;
  newsId: string;
  newsTitle: string;
  selectedHook: string;
  style: VideoStyle;
  length: VideoLength;
  scenes: VideoScene[];
  audioBlob: Blob | null;
  audioDurationMs: number;
  videoBlob: Blob | null;
  thumbnailUrl: string | null;
  caption: string;
  hashtags: string;
  status: 'idle' | 'generating' | 'done' | 'error';
  progress: VideoProgress;
  error: string | null;
  createdAt: string;
}

export interface StyleConfig {
  name: string;
  icon: string;
  fontFamily: string;
  fontWeight: number;
  hookFontSize: number;       // px at 1080w
  bodyFontSize: number;
  labelFontSize: number;
  colors: {
    text: string;
    textSecondary: string;
    accent: string;
    bgGradientStart: string;
    bgGradientEnd: string;
    labelBg: string;
    labelText: string;
  };
  textPosition: 'center' | 'bottom-third';
  transition: 'cut' | 'fade' | 'zoom';
  transitionDurationMs: number;
  wordAnimation: 'highlight' | 'fade' | 'pop';
  emphasisEffect: 'shake' | 'none' | 'scale';
  pacing: 'slow' | 'medium' | 'fast';
}
