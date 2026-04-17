// Browser-only TTS — no external dependencies, no signup required

function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer high-quality voices in order
  const preferred = [
    'Google UK English Female',
    'Google UK English Male',
    'Microsoft Aria',
    'Microsoft Zira',
    'Samantha',
    'Daniel',
    'Google US English',
  ];
  for (const name of preferred) {
    const v = voices.find(voice => voice.name.includes(name));
    if (v) return v;
  }
  // Fallback to any English voice
  return voices.find(v => v.lang.startsWith('en')) || null;
}

export type VoiceStyle = 'professional' | 'casual' | 'energetic' | 'calm';

const VOICE_PRESETS: Record<VoiceStyle, { rate: number; pitch: number }> = {
  professional: { rate: 0.9, pitch: 1.0 },
  casual: { rate: 1.0, pitch: 1.1 },
  energetic: { rate: 1.15, pitch: 1.2 },
  calm: { rate: 0.8, pitch: 0.9 },
};

export function speakText(text: string, onEnd?: () => void, style: VoiceStyle = 'professional'): void {
  stopSpeaking();

  if (!text || text.trim().length === 0) {
    onEnd?.();
    return;
  }

  // Truncate very long text for browser TTS safety
  const safeText = text.length > 5000 ? text.slice(0, 5000) + '...' : text;

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported in this browser');
    onEnd?.();
    return;
  }

  const preset = VOICE_PRESETS[style];

  // Chrome bug: voices may not be loaded yet
  const trySpeak = () => {
    const utterance = new SpeechSynthesisUtterance(safeText);
    utterance.rate = preset.rate;
    utterance.pitch = preset.pitch;
    utterance.volume = 1;

    const voice = getPreferredVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Voices may load async in some browsers
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      trySpeak();
    };
    // Fallback if event never fires
    setTimeout(trySpeak, 200);
  } else {
    trySpeak();
  }
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

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
