import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check, Share2, AlertTriangle, Zap, Clock, Lock } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { VideoStyle, VideoLength, VideoProgress as VProgress, VideoScene } from '../types/video';
import { STYLE_CONFIGS } from '../lib/videoStyles';
import { VideoRenderer, buildScenes, calculateSceneDurations } from '../lib/videoEngine';
import { generateVideoVoiceover, createAudioTimeline } from '../lib/videoAudio';
import { canUseFeature, trackUsageWithServer } from '../lib/subscription';
import VideoProgress from './VideoProgress';
import VideoPreview from './VideoPreview';
import ProGate from './ProGate';

type Phase = 'select-hook' | 'configure' | 'generating' | 'done';

export default function VideoGenerator() {
  const { selectedNews: news, prefilledHook, user } = useStore();

  // ── Phase state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(prefilledHook ? 'configure' : 'select-hook');
  const [selectedHook, setSelectedHook] = useState<string>(prefilledHook || '');
  const [style, setStyle] = useState<VideoStyle>('viral-bold');
  const [length, setLength] = useState<VideoLength>('standard');
  const [progress, setProgress] = useState<VProgress>({ step: 'script', percent: 0, message: '' });
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showProGate, setShowProGate] = useState<{ feature: string; used: number; limit: number } | null>(null);

  // Canvas ref for renderer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hookPreviewCanvas, setHookPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────

  const hooks = useMemo(() => {
    if (!news?.trendAnalysis?.viralHooks) return [];
    return news.trendAnalysis.viralHooks.filter(Boolean);
  }, [news?.trendAnalysis]);

  const videoScript = news?.trendAnalysis?.videoScript;

  const caption = useMemo(() => {
    if (!news?.trendAnalysis) return '';
    const ta = news.trendAnalysis;
    const hook = selectedHook || ta.videoScript.hook;
    const tags = news.tags?.slice(0, 5).map(t => `#${t.replace(/\s+/g, '')}`).join(' ') || '';
    return `${hook}\n\n${ta.creatorOpportunity.split('.').slice(0, 2).join('.')}\n\n${tags}`;
  }, [news, selectedHook]);

  const hashtags = useMemo(() => {
    return news?.tags?.slice(0, 8).map(t => `#${t.replace(/\s+/g, '')}`).join(' ') || '';
  }, [news?.tags]);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // ── Hook selection ───────────────────────────────────────────────────

  const selectHook = (hook: string) => {
    setSelectedHook(hook);
    setPhase('configure');
  };

  // ── Generate video ───────────────────────────────────────────────────

  const generate = useCallback(async () => {
    if (!videoScript || !selectedHook) return;

    // Gate: check video generation limit
    const check = canUseFeature('videoGenerations');
    if (!check.allowed) {
      setShowProGate({ feature: 'video generation', used: check.used, limit: check.limit });
      return;
    }

    setPhase('generating');
    setError(null);
    setVideoBlob(null);

    const styleConfig = STYLE_CONFIGS[style];

    try {
      // Step 1: Build scenes
      setProgress({ step: 'script', percent: 30, message: 'Building your script...' });
      const rawScenes = buildScenes(videoScript, selectedHook, length);

      // Step 1b: Render hook preview immediately (<100ms)
      const previewCanvas = document.createElement('canvas');
      canvasRef.current = previewCanvas;
      const renderer = new VideoRenderer(previewCanvas);
      await document.fonts.ready; // ensure DM Sans is loaded
      renderer.renderHookPreview(selectedHook, styleConfig);
      setHookPreviewCanvas(previewCanvas);
      setProgress({ step: 'script', percent: 100, message: 'Script ready' });

      // Step 2: Generate voiceover
      setProgress({ step: 'voiceover', percent: 10, message: 'Recording voiceover...' });
      const fullText = rawScenes.map(s => s.text).join('. ');
      const { blob: voBlob, durationMs } = await generateVideoVoiceover(fullText, 'professional');
      setProgress({ step: 'voiceover', percent: 80, message: 'Voiceover ready' });

      // Step 2b: Calculate audio-driven scene durations
      const scenes: VideoScene[] = calculateSceneDurations(rawScenes, durationMs);
      setProgress({ step: 'voiceover', percent: 100, message: 'Audio synced' });

      // Step 3: Create audio timeline with SFX
      setProgress({ step: 'design', percent: 30, message: 'Designing scenes...' });
      const transitionTimes: number[] = [];
      let accum = 0;
      for (let i = 0; i < scenes.length - 1; i++) {
        accum += scenes[i].durationMs;
        transitionTimes.push(accum);
      }
      const finalAudio = await createAudioTimeline(voBlob, transitionTimes);
      setProgress({ step: 'design', percent: 100, message: 'Sound design complete' });

      // Step 4: Render video frames + capture
      setProgress({ step: 'render', percent: 0, message: 'Rendering video...' });
      const blob = await renderer.exportVideo(
        scenes,
        finalAudio,
        styleConfig,
        (pct) => setProgress({ step: 'render', percent: pct, message: `Rendering video... ${pct}%` }),
      );

      // Step 5: Finalize
      setProgress({ step: 'finalize', percent: 50, message: 'Almost ready...' });
      const thumbnail = renderer.captureThumbnail();
      setThumbnailUrl(thumbnail);
      setProgress({ step: 'finalize', percent: 100, message: 'Done!' });

      setVideoBlob(blob);
      setPhase('done');

      // Track usage after successful generation
      if (user) {
        trackUsageWithServer(user.id, 'videoGenerations').catch(() => {});
      }
    } catch (err: any) {
      console.error('Video generation failed:', err);
      setError(err?.message || 'Video generation failed');
      setPhase('configure');
    }
  }, [videoScript, selectedHook, style, length]);

  // ── Actions ──────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trendsense-${style}-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    generate();
  };

  const handleChangeStyle = () => {
    setVideoBlob(null);
    setPhase('configure');
  };

  const handleChangeHook = () => {
    setVideoBlob(null);
    setPhase('select-hook');
  };

  // ── No script guard ──────────────────────────────────────────────────

  if (!news || !videoScript) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <p className="text-gray-400 text-sm">Generate trend analysis first to create a video.</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
    {showProGate && (
      <ProGate
        feature={showProGate.feature}
        used={showProGate.used}
        limit={showProGate.limit}
        onClose={() => setShowProGate(null)}
        emotionalMessage="\ud83d\ude80 You're creating fast \u2014 unlock unlimited videos"
      />
    )}
    <div className="space-y-6">
      <AnimatePresence mode="wait">

        {/* ═══ PHASE 1: HOOK SELECTION ═══ */}
        {phase === 'select-hook' && (
          <motion.div key="hooks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div>
              <h3 className="text-white font-bold text-lg mb-1">Choose Your Hook</h3>
              <p className="text-gray-500 text-sm">This becomes the first thing viewers see</p>
            </div>

            <div className="space-y-3">
              {hooks.map((hook, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectHook(hook)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedHook === hook
                      ? 'bg-orange-500/15 border-orange-500/40'
                      : 'bg-white/[0.03] border-white/10 hover:border-orange-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                    <p className="text-white text-[15px] leading-relaxed font-semibold">{hook}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ PHASE 2: CONFIGURE (style + length) ═══ */}
        {phase === 'configure' && (
          <motion.div key="configure" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

            {/* Selected hook preview */}
            <div className="bg-orange-500/8 border border-orange-500/15 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">YOUR HOOK</p>
              <p className="text-white font-bold leading-snug">"{selectedHook}"</p>
              <button onClick={() => setPhase('select-hook')} className="text-orange-400 text-xs mt-2 hover:underline">Change hook</button>
            </div>

            {/* Style picker */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Video Style</h3>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(STYLE_CONFIGS) as [VideoStyle, typeof STYLE_CONFIGS[VideoStyle]][]).map(([id, cfg]) => (
                  <button
                    key={id}
                    onClick={() => setStyle(id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                      style === id
                        ? 'bg-purple-500/15 border-purple-500/40'
                        : 'bg-white/[0.03] border-white/10 hover:border-purple-500/30'
                    }`}
                  >
                    <span className="text-2xl">{cfg.icon}</span>
                    <span className={`text-xs font-medium ${style === id ? 'text-purple-300' : 'text-gray-400'}`}>
                      {cfg.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Length toggle */}
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Video Length</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLength('short')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    length === 'short'
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-cyan-500/30'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">Short (15-20s)</span>
                </button>
                <button
                  onClick={() => setLength('standard')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all ${
                    length === 'standard'
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-cyan-500/30'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Standard (30-45s)</span>
                </button>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Generate CTA */}
            {(() => {
              const genCheck = canUseFeature('videoGenerations');
              const isLocked = !genCheck.allowed;
              return (
                <>
                  {!isLocked && (
                    <p className="text-center text-xs text-gray-500">
                      {genCheck.limit - genCheck.used} free video{genCheck.limit - genCheck.used !== 1 ? 's' : ''} remaining today
                    </p>
                  )}
                  <button
                    onClick={generate}
                    className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isLocked
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/20'
                        : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-orange-500/20 hover:shadow-orange-500/30'
                    }`}
                  >
                    {isLocked ? (
                      <><Lock className="w-5 h-5" /> Unlock Unlimited Videos</>
                    ) : (
                      <><Zap className="w-5 h-5" /> Generate Video</>
                    )}
                  </button>
                </>
              );
            })()}
          </motion.div>
        )}

        {/* ═══ PHASE 3: GENERATING ═══ */}
        {phase === 'generating' && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="relative">
              <VideoPreview
                videoBlob={null}
                hookPreviewCanvas={hookPreviewCanvas}
                isGenerating={true}
                onRegenerate={handleRegenerate}
                onChangeStyle={handleChangeStyle}
                onChangeHook={handleChangeHook}
              />
              <VideoProgress progress={progress} />
            </div>
          </motion.div>
        )}

        {/* ═══ PHASE 4: DONE — preview + publish prep ═══ */}
        {phase === 'done' && videoBlob && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Video preview with replay loop */}
            <VideoPreview
              videoBlob={videoBlob}
              hookPreviewCanvas={null}
              isGenerating={false}
              onRegenerate={handleRegenerate}
              onChangeStyle={handleChangeStyle}
              onChangeHook={handleChangeHook}
            />

            {/* Thumbnail preview */}
            {thumbnailUrl && (
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">THUMBNAIL PREVIEW</p>
                <img src={thumbnailUrl} alt="Thumbnail" className="w-20 h-36 object-cover rounded-lg border border-white/10" />
              </div>
            )}

            {/* Auto-generated caption */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">CAPTION</p>
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{caption}</p>
              <button
                onClick={() => handleCopy(caption)}
                className="mt-3 flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Caption'}
              </button>
            </div>

            {/* Hashtags */}
            {hashtags && (
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">HASHTAGS</p>
                <p className="text-cyan-300 text-sm">{hashtags}</p>
              </div>
            )}

            {/* Platform-aware download */}
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-base shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Video
              </button>

              {isIOS && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-300">
                    Downloads as WebM. Use InShot or VN to convert to MP4 for TikTok/Instagram.
                  </p>
                </div>
              )}

              {/* Share button */}
              {typeof navigator.share === 'function' && (
                <button
                  onClick={() => {
                    if (videoBlob) {
                      const file = new File([videoBlob], `trendsense-${style}.webm`, { type: 'video/webm' });
                      navigator.share({ files: [file], title: 'Check out this video!', text: caption }).catch(() => {});
                    }
                  }}
                  className="w-full py-3 rounded-xl border border-white/10 text-gray-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
