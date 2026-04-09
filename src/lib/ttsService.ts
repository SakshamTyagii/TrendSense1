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

export function speakText(text: string, onEnd?: () => void): void {
  stopSpeaking();

  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported in this browser');
    onEnd?.();
    return;
  }

  // Chrome bug: voices may not be loaded yet
  const trySpeak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
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
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
