import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Voice + prosody mapping per style.
// Each style uses a DIFFERENT voice AND different prosody for maximum contrast.
const STYLE_CONFIG: Record<string, {
  voice: string;
  prosody: { rate: string; pitch: string; volume: string };
}> = {
  professional: {
    voice: 'en-US-AndrewNeural',       // Warm, Confident, Authoritative male
    prosody: { rate: 'medium', pitch: 'medium', volume: 'medium' },
  },
  casual: {
    voice: 'en-US-EmmaNeural',         // Cheerful, Clear, Conversational female
    prosody: { rate: 'medium', pitch: 'medium', volume: 'medium' },
  },
  energetic: {
    voice: 'en-US-AriaNeural',         // Positive, Confident female
    prosody: { rate: 'fast', pitch: 'high', volume: 'loud' },
  },
  calm: {
    voice: 'en-GB-SoniaNeural',        // British, soothing female
    prosody: { rate: 'slow', pitch: 'low', volume: 'medium' },
  },
};

function sanitizeText(text: string): string {
  return text
    .replace(/[<>&"]/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .slice(0, 5000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, style = 'professional' } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty text' });
  }

  const config = STYLE_CONFIG[style] || STYLE_CONFIG.professional;
  const cleanText = sanitizeText(text);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(config.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(cleanText, config.prosody);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      audioStream.on('end', () => resolve());
      audioStream.on('error', (err: Error) => reject(err));
      setTimeout(() => reject(new Error('TTS generation timed out')), 30_000);
    });

    tts.close();

    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length === 0) {
      return res.status(500).json({ error: 'TTS produced empty audio' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(audioBuffer);
  } catch (err: any) {
    console.error('Edge TTS error:', err?.message || err);
    return res.status(500).json({ error: 'TTS generation failed' });
  }
}
