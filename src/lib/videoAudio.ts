// ── Video Audio Utilities ──────────────────────────────────────────────
// Generates voiceover for video via existing /api/tts endpoint,
// detects audio duration, and manages sound effects.

import type { VoiceStyle } from '../lib/ttsService';

// ── Generate voiceover blob ────────────────────────────────────────────

export async function generateVideoVoiceover(
  scriptText: string,
  voiceStyle: VoiceStyle = 'energetic',
): Promise<{ blob: Blob; durationMs: number }> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scriptText.slice(0, 5000), style: voiceStyle }),
      });

      if (!res.ok) throw new Error(`TTS API ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error('Empty audio from TTS');

      const durationMs = await detectAudioDuration(blob);
      return { blob, durationMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Wait 1s before retry
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastError || new Error('TTS failed after retries');
}

// ── Detect audio duration ──────────────────────────────────────────────

export async function detectAudioDuration(blob: Blob): Promise<number> {
  const audioCtx = new AudioContext();
  try {
    const arrayBuf = await blob.arrayBuffer();
    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    return audioBuf.duration * 1000; // ms
  } finally {
    await audioCtx.close();
  }
}

// ── Sound effects (tiny inline-generated audio) ────────────────────────
// Instead of loading external files, we generate minimal sine/noise bursts
// via Web Audio API. Each is <0.3s and very subtle.

const sfxCache = new Map<string, AudioBuffer>();

export async function generateSfx(
  type: 'pop' | 'whoosh' | 'click',
): Promise<AudioBuffer> {
  const cached = sfxCache.get(type);
  if (cached) return cached;

  const audioCtx = new AudioContext();
  const sampleRate = audioCtx.sampleRate;

  let buffer: AudioBuffer;
  if (type === 'pop') {
    // Short sine burst — 0.08s
    buffer = audioCtx.createBuffer(1, sampleRate * 0.08, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 40) * 0.3;
    }
  } else if (type === 'whoosh') {
    // Filtered noise sweep — 0.25s
    buffer = audioCtx.createBuffer(1, sampleRate * 0.25, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 2 - 1;
      const env = Math.sin(Math.PI * t / 0.25) * 0.15;
      data[i] = noise * env;
    }
  } else {
    // Click — 0.03s impulse
    buffer = audioCtx.createBuffer(1, sampleRate * 0.03, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.exp(-t * 200) * 0.4 * (Math.random() * 0.5 + 0.5);
    }
  }

  await audioCtx.close();
  sfxCache.set(type, buffer);
  return buffer;
}

// ── Merge voiceover + sound effects into a single blob ─────────────────
// Mixes voiceover audio with transition sounds at specified times.

export async function createAudioTimeline(
  voiceoverBlob: Blob,
  transitionTimesMs: number[], // when each scene transition occurs
): Promise<Blob> {
  const audioCtx = new AudioContext();
  try {
    const voBuf = await audioCtx.decodeAudioData(await voiceoverBlob.arrayBuffer());
    const totalSamples = voBuf.length;
    const sampleRate = voBuf.sampleRate;

    // Create output buffer (stereo)
    const output = audioCtx.createBuffer(2, totalSamples, sampleRate);
    const outL = output.getChannelData(0);
    const outR = output.getChannelData(1);

    // Copy voiceover (may be mono or stereo)
    const voL = voBuf.getChannelData(0);
    const voR = voBuf.numberOfChannels > 1 ? voBuf.getChannelData(1) : voL;
    for (let i = 0; i < totalSamples; i++) {
      outL[i] = voL[i] || 0;
      outR[i] = voR[i] || 0;
    }

    // Generate and mix transition sound effects
    const whoosh = await generateSfx('whoosh');
    const whooshData = whoosh.getChannelData(0);

    for (const transMs of transitionTimesMs) {
      const startSample = Math.floor((transMs / 1000) * sampleRate);
      for (let i = 0; i < whooshData.length && startSample + i < totalSamples; i++) {
        outL[startSample + i] += whooshData[i];
        outR[startSample + i] += whooshData[i];
      }
    }

    // Encode to WAV (simple, works everywhere)
    return encodeWav(output);
  } finally {
    await audioCtx.close();
  }
}

// ── WAV encoder (PCM 16-bit) ───────────────────────────────────────────

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const arrayBuf = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuf);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // sub-chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = headerSize;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuf], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
