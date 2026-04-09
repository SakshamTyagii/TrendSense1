import { config } from './config';

export async function generateAudio(text: string): Promise<string | null> {
  if (config.hasElevenLabs) {
    return generateElevenLabsAudio(text);
  }
  return generateBrowserTTS(text);
}

async function generateElevenLabsAudio(text: string): Promise<string | null> {
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) throw new Error('ElevenLabs API error');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('ElevenLabs error:', error);
    return generateBrowserTTS(text);
  }
}

function generateBrowserTTS(_text: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(null);
      return;
    }
    resolve('browser-tts');
  });
}

export function speakText(text: string, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (!('speechSynthesis' in window)) return null;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')
  );
  if (preferredVoice) utterance.voice = preferredVoice;
  
  if (onEnd) utterance.onend = onEnd;
  
  window.speechSynthesis.speak(utterance);
  return utterance;
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
