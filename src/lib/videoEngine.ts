import type { VideoScene, StyleConfig, SceneType } from '../types/video';
import { SCENE_LABELS } from './videoStyles';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

// ── Scene duration calculation (audio-driven) ──────────────────────────

export function calculateSceneDurations(
  scenes: VideoScene[],
  totalAudioMs: number,
): VideoScene[] {
  const totalWords = scenes.reduce((sum, s) => sum + s.words.length, 0);
  if (totalWords === 0) {
    const per = totalAudioMs / scenes.length;
    return scenes.map(s => ({ ...s, durationMs: per }));
  }
  return scenes.map(s => ({
    ...s,
    durationMs: totalAudioMs * (s.words.length / totalWords),
  }));
}

// ── Build scenes from VideoScript ──────────────────────────────────────

export function buildScenes(
  videoScript: { hook: string; context: string; explanation: string; payoff: string; cta: string },
  selectedHook: string,
  length: 'short' | 'standard',
): VideoScene[] {
  const hookText = selectedHook || videoScript.hook;
  const scenes: { type: SceneType; text: string }[] = length === 'short'
    ? [
        { type: 'hook', text: hookText },
        { type: 'payoff', text: `${videoScript.payoff} ${videoScript.cta}` },
      ]
    : [
        { type: 'hook', text: hookText },
        { type: 'context', text: videoScript.context },
        { type: 'insight', text: videoScript.explanation },
        { type: 'payoff', text: `${videoScript.payoff} ${videoScript.cta}` },
      ];

  return scenes.map(s => ({
    ...s,
    words: s.text.split(/\s+/).filter(Boolean),
    durationMs: 0,
  }));
}

// ── Canvas Renderer ────────────────────────────────────────────────────

export class VideoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly width = WIDTH;
  readonly height = HEIGHT;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
  }

  // ── Hook preview — renders instantly (<100ms) ──────────────────────

  renderHookPreview(hookText: string, style: StyleConfig): void {
    const ctx = this.ctx;
    this.drawBackground(ctx, style, 0);
    // Draw label
    this.drawLabel(ctx, SCENE_LABELS.hook, style);
    // Draw hook text
    this.drawText(ctx, hookText, style, style.hookFontSize, style.colors.text, 'center', 1);
  }

  // ── Render a single frame at a given time ──────────────────────────

  renderFrame(
    scenes: VideoScene[],
    style: StyleConfig,
    timeMs: number,
  ): void {
    const ctx = this.ctx;
    let accumulated = 0;
    let sceneIdx = 0;

    for (let i = 0; i < scenes.length; i++) {
      if (timeMs < accumulated + scenes[i].durationMs || i === scenes.length - 1) {
        sceneIdx = i;
        break;
      }
      accumulated += scenes[i].durationMs;
    }

    const scene = scenes[sceneIdx];
    const sceneProgress = scene.durationMs > 0
      ? Math.min(1, (timeMs - accumulated) / scene.durationMs)
      : 1;

    // Check if we're in a transition zone between scenes
    const transMs = style.transitionDurationMs;
    const inTransition = sceneIdx > 0 && (timeMs - accumulated) < transMs && transMs > 0;
    const transProgress = inTransition ? (timeMs - accumulated) / transMs : 1;

    // Background
    this.drawBackground(ctx, style, timeMs);

    // Transition blending for fade style
    if (inTransition && style.transition === 'fade') {
      ctx.globalAlpha = transProgress;
    }

    // Scene label
    const label = SCENE_LABELS[scene.type] || scene.type.toUpperCase();
    this.drawLabel(ctx, label, style);

    // Text rendering based on style animation
    const fontSize = scene.type === 'hook' ? style.hookFontSize : style.bodyFontSize;
    if (style.wordAnimation === 'highlight') {
      this.drawHighlightText(ctx, scene, style, fontSize, sceneProgress);
    } else if (style.wordAnimation === 'pop') {
      this.drawPopText(ctx, scene, style, fontSize, sceneProgress);
    } else {
      // fade
      this.drawText(ctx, scene.text, style, fontSize, style.colors.text, style.textPosition, sceneProgress);
    }

    ctx.globalAlpha = 1;

    // Emphasis effect on key words (first 3 words of hook)
    if (scene.type === 'hook' && style.emphasisEffect === 'shake' && sceneProgress < 0.3) {
      // tiny screen shake effect (translate canvas briefly)
      const intensity = (1 - sceneProgress / 0.3) * 4;
      const offsetX = Math.sin(timeMs * 0.05) * intensity;
      const offsetY = Math.cos(timeMs * 0.07) * intensity;
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.restore();
    }
  }

  // ── Background ─────────────────────────────────────────────────────

  private drawBackground(ctx: CanvasRenderingContext2D, style: StyleConfig, timeMs: number): void {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, style.colors.bgGradientStart);
    grad.addColorStop(1, style.colors.bgGradientEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Animated gradient pulse (subtle radial glow)
    const pulse = 0.15 + Math.sin(timeMs * 0.002) * 0.08;
    const radGrad = ctx.createRadialGradient(
      WIDTH / 2, HEIGHT * 0.4, 100,
      WIDTH / 2, HEIGHT * 0.4, 600,
    );
    radGrad.addColorStop(0, this.hexToRgba(style.colors.accent, pulse));
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // ── Scene label badge ──────────────────────────────────────────────

  private drawLabel(ctx: CanvasRenderingContext2D, label: string, style: StyleConfig): void {
    ctx.font = `${style.fontWeight} ${style.labelFontSize}px ${style.fontFamily}`;
    const textWidth = ctx.measureText(label).width;
    const x = WIDTH / 2 - textWidth / 2 - 16;
    const y = style.textPosition === 'bottom-third' ? HEIGHT * 0.52 : HEIGHT * 0.28;

    // Badge background
    ctx.fillStyle = style.colors.labelBg;
    ctx.beginPath();
    ctx.roundRect(x, y, textWidth + 32, style.labelFontSize + 20, 12);
    ctx.fill();

    // Badge text
    ctx.fillStyle = style.colors.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, WIDTH / 2, y + (style.labelFontSize + 20) / 2);
  }

  // ── Standard text draw (fade style) ────────────────────────────────

  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    style: StyleConfig,
    fontSize: number,
    color: string,
    position: 'center' | 'bottom-third',
    progress: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 3); // fade-in over first 33%
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const y = position === 'bottom-third' ? HEIGHT * 0.72 : HEIGHT * 0.48;
    const maxWidth = WIDTH - 120;
    const lines = this.wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.3;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], WIDTH / 2, startY + i * lineHeight, maxWidth);
    }
    ctx.restore();
  }

  // ── Word-by-word highlight (Viral Bold) ────────────────────────────

  private drawHighlightText(
    ctx: CanvasRenderingContext2D,
    scene: VideoScene,
    style: StyleConfig,
    fontSize: number,
    progress: number,
  ): void {
    ctx.save();
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const maxWidth = WIDTH - 120;
    const lines = this.wrapText(ctx, scene.text, maxWidth);
    const lineHeight = fontSize * 1.3;
    const y = style.textPosition === 'bottom-third' ? HEIGHT * 0.72 : HEIGHT * 0.48;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;

    // Which word is currently highlighted
    const activeWordIndex = Math.floor(progress * scene.words.length);
    let wordCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineWords = lines[i].split(/\s+/);
      // Draw each word with highlight if active
      const lineFullWidth = ctx.measureText(lines[i]).width;
      let wordX = WIDTH / 2 - lineFullWidth / 2;

      for (const word of lineWords) {
        const wordWidth = ctx.measureText(word + ' ').width;
        const isActive = wordCounter <= activeWordIndex;
        ctx.fillStyle = isActive ? style.colors.textSecondary : style.colors.text;

        // Shake emphasis on active word
        let offsetY = 0;
        if (wordCounter === activeWordIndex && style.emphasisEffect === 'shake') {
          offsetY = Math.sin(progress * 60) * 3;
        }

        ctx.textAlign = 'left';
        ctx.fillText(word, wordX, startY + i * lineHeight + offsetY);
        wordX += wordWidth;
        wordCounter++;
      }
    }
    ctx.restore();
  }

  // ── TikTok-style word pop (Fast Captions) ──────────────────────────

  private drawPopText(
    ctx: CanvasRenderingContext2D,
    scene: VideoScene,
    style: StyleConfig,
    fontSize: number,
    progress: number,
  ): void {
    ctx.save();

    // Show 2-3 words at a time, popping in
    const wordsPerChunk = 3;
    const totalChunks = Math.ceil(scene.words.length / wordsPerChunk);
    const activeChunk = Math.min(totalChunks - 1, Math.floor(progress * totalChunks));
    const chunkStart = activeChunk * wordsPerChunk;
    const chunkWords = scene.words.slice(chunkStart, chunkStart + wordsPerChunk);
    const chunkText = chunkWords.join(' ');

    // Pop scale animation
    const chunkProgress = (progress * totalChunks) - activeChunk;
    const scale = chunkProgress < 0.15 ? 0.5 + chunkProgress * 3.3 : 1; // scale 0.5 → 1

    const y = style.textPosition === 'bottom-third' ? HEIGHT * 0.72 : HEIGHT * 0.48;

    ctx.translate(WIDTH / 2, y);
    ctx.scale(scale, scale);
    ctx.translate(-WIDTH / 2, -y);

    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ctx.fillStyle = style.colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chunkText, WIDTH / 2, y, WIDTH - 120);

    // Colored underline strip
    const textWidth = ctx.measureText(chunkText).width;
    ctx.fillStyle = style.colors.accent;
    ctx.fillRect(WIDTH / 2 - textWidth / 2 - 10, y + fontSize * 0.6, textWidth + 20, 8);

    ctx.restore();
  }

  // ── Text wrapping ──────────────────────────────────────────────────

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
  }

  // ── Hex → rgba helper ─────────────────────────────────────────────

  private hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ── Export video via MediaRecorder ─────────────────────────────────

  async exportVideo(
    scenes: VideoScene[],
    audioBlob: Blob | null,
    style: StyleConfig,
    onProgress: (pct: number) => void,
  ): Promise<Blob> {
    const totalMs = scenes.reduce((s, sc) => s + sc.durationMs, 0);
    const totalFrames = Math.ceil((totalMs / 1000) * FPS);

    // Set up MediaRecorder on canvas stream
    const stream = this.canvas.captureStream(FPS);

    // Mix in audio if available
    let audioCtx: AudioContext | null = null;
    let audioSource: AudioBufferSourceNode | null = null;
    if (audioBlob) {
      audioCtx = new AudioContext();
      const arrayBuf = await audioBlob.arrayBuffer();
      const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuf;
      const dest = audioCtx.createMediaStreamDestination();
      audioSource.connect(dest);
      // Add audio track to video stream
      for (const track of dest.stream.getAudioTracks()) {
        stream.addTrack(track);
      }
    }

    // Determine supported codec
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    return new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        audioSource?.stop();
        audioCtx?.close();
        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.onerror = (e) => reject(e);
      recorder.start(100); // collect chunks every 100ms
      audioSource?.start();

      // Render frames in real-time so video duration matches audio duration.
      // We use setTimeout to pace each frame at exactly 1/FPS intervals,
      // ensuring the MediaRecorder captures at the correct real-time rate.
      let frame = 0;
      const frameDuration = 1000 / FPS;

      const renderNext = () => {
        if (frame >= totalFrames) {
          // Small delay to let last frame be captured before stopping
          setTimeout(() => recorder.stop(), 200);
          return;
        }

        const timeMs = frame * frameDuration;
        this.renderFrame(scenes, style, timeMs);
        frame++;
        onProgress(Math.round((frame / totalFrames) * 100));

        // Wait real-time between frames so the recorded video
        // plays back at normal speed instead of hyper-fast
        setTimeout(renderNext, frameDuration);
      };

      renderNext();
    });
  }

  // ── Capture thumbnail (first frame as PNG data URL) ────────────────

  captureThumbnail(): string {
    return this.canvas.toDataURL('image/png');
  }
}
