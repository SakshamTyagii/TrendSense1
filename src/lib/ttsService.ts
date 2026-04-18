// Edge TTS — neural voices via /api/tts serverless endpoint
// Falls back to browser speechSynthesis if API unavailable.

export type VoiceStyle = 'professional' | 'casual' | 'energetic' | 'calm';

// ── Audio player state ─────────────────────────────────────────────────
let _audio: HTMLAudioElement | null = null;
let _blobUrl: string | null = null;
let _abortCtrl: AbortController | null = null;
let _genId = 0; // generation counter — only the latest request plays

function cleanup() {
  if (_audio) {
    _audio.pause();
    _audio.removeAttribute('src');
    _audio.load();
    _audio = null;
  }
  if (_blobUrl) {
    URL.revokeObjectURL(_blobUrl);
    _blobUrl = null;
  }
  if (_abortCtrl) {
    _abortCtrl.abort();
    _abortCtrl = null;
  }
}

// ── Main speak function ────────────────────────────────────────────────

export function speakText(text: string, onEnd?: () => void, style: VoiceStyle = 'professional'): void {
  stopSpeaking();

  if (!text || text.trim().length === 0) { onEnd?.(); return; }

  const myGen = ++_genId;
  const ctrl = new AbortController();
  _abortCtrl = ctrl;

  (async () => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 5000), style }),
        signal: ctrl.signal,
      });

      // Stale request — a newer speakText() was called while we were waiting
      if (myGen !== _genId) return;

      if (!res.ok) throw new Error(`TTS API ${res.status}`);

      const blob = await res.blob();
      if (myGen !== _genId) return;
      if (blob.size === 0) throw new Error('Empty audio');

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      // Double-check we're still the active request before playing
      if (myGen !== _genId) {
        URL.revokeObjectURL(url);
        return;
      }

      _blobUrl = url;
      _audio = audio;
      audio.onended = () => { cleanup(); onEnd?.(); };
      audio.onerror = () => { cleanup(); fallbackSpeak(text, onEnd, style); };
      await audio.play();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (myGen === _genId) fallbackSpeak(text, onEnd, style);
    }
  })();
}

export function stopSpeaking() {
  _genId++; // invalidate any in-flight requests
  cleanup();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ── Browser TTS fallback ───────────────────────────────────────────────
// Basic speechSynthesis in case the API is down. Quality is lower but
// ensures voiceover always works.

const FALLBACK_PRESETS: Record<VoiceStyle, { rate: number; pitch: number }> = {
  professional: { rate: 0.9,  pitch: 0.85 },
  casual:       { rate: 1.05, pitch: 1.15 },
  energetic:    { rate: 1.3,  pitch: 1.4  },
  calm:         { rate: 0.75, pitch: 0.75 },
};

function fallbackSpeak(text: string, onEnd?: () => void, style: VoiceStyle = 'professional') {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }

  const preset = FALLBACK_PRESETS[style];
  const utt = new SpeechSynthesisUtterance(text.slice(0, 3000));
  utt.rate = preset.rate;
  utt.pitch = preset.pitch;
  utt.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const english = voices.find(v => v.lang.startsWith('en'));
  if (english) utt.voice = english;

  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utt);
}

// ── Download helper ────────────────────────────────────────────────────

export function downloadScript(text: string, filename: string) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Fetch audio blob (for download without playing) ────────────────────

export async function fetchAudioBlob(text: string, style: VoiceStyle = 'professional'): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 5000), style }),
  });
  if (!res.ok) throw new Error(`TTS API ${res.status}`);
  const blob = await res.blob();
  if (blob.size === 0) throw new Error('Empty audio');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
