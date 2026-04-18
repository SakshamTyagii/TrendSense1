import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Download, Copy, Check, Play, Pause, FileText, Mic, Loader2, Upload, Film, X, Flame, Video, Lock } from 'lucide-react';
import VideoGenerator from './VideoGenerator';
import { useStore } from '../store/useStore';
import { speakText, stopSpeaking, downloadScript, type VoiceStyle } from '../lib/ttsService';
import { canUseFeature, trackUsageWithServer } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import ProGate from './ProGate';
import type { CreatorReel } from '../types';

type ExportFormat = 'youtube-short' | 'tiktok' | 'instagram-reel' | 'long-form';

const EXPORT_PRESETS: Record<ExportFormat, { label: string; icon: string; duration: string; captionPrefix: string }> = {
  'youtube-short': { label: 'YT Short', icon: '▶️', duration: '30-60 sec', captionPrefix: '' },
  'tiktok': { label: 'TikTok', icon: '🎵', duration: '15-30 sec', captionPrefix: '📌 Pin this → ' },
  'instagram-reel': { label: 'IG Reel', icon: '📷', duration: '30-60 sec', captionPrefix: '' },
  'long-form': { label: 'Long Form', icon: '🎥', duration: '5-8 min', captionPrefix: '' },
};

export default function CreatorStudio() {
  const { selectedNews: news, setView, isPlaying, setPlaying, addReel, user, prefilledHook, setPrefilledHook } = useStore();
  const [activeTab, setActiveTab] = useState<'script' | 'voiceover' | 'upload' | 'video'>(prefilledHook ? 'video' : 'script');
  const [format, setFormat] = useState<ExportFormat>('youtube-short');
  const [copied, setCopied] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('professional');
  const [showProGate, setShowProGate] = useState<{ feature: string; used: number; limit: number } | null>(null);

  // Upload reel state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [reelCaption, setReelCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build the full script text from trendAnalysis
  const fullScriptText = useMemo(() => {
    if (!news?.trendAnalysis?.videoScript) return '';
    const vs = news.trendAnalysis.videoScript;
    const hook = prefilledHook || vs.hook;
    return [hook, vs.context, vs.explanation, vs.payoff, vs.cta].filter(Boolean).join('\n\n');
  }, [news?.trendAnalysis, prefilledHook]);

  // Build platform-specific export
  const exportData = useMemo(() => {
    if (!news?.trendAnalysis) return null;
    const ta = news.trendAnalysis;
    const vs = ta.videoScript;
    const preset = EXPORT_PRESETS[format];
    const hook = prefilledHook || vs.hook;
    const tags = news.tags?.slice(0, format === 'tiktok' ? 5 : 8) || [];
    const hashtagString = tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');

    let caption = '';
    if (format === 'tiktok') {
      caption = `${preset.captionPrefix}${hook}\n\n${hashtagString}`;
    } else if (format === 'instagram-reel') {
      caption = `${hook}\n\n${ta.whyBlowingUp.split('.').slice(0, 2).join('.')}\n\n${hashtagString}`;
    } else if (format === 'youtube-short') {
      caption = `${hook}\n\n${ta.creatorOpportunity.split('.').slice(0, 1).join('.')}`;
    } else {
      caption = `VIDEO OUTLINE:\n\n1. INTRO: ${hook}\n2. CONTEXT: ${vs.context}\n3. DEEP DIVE: ${vs.explanation}\n4. WHY IT MATTERS: ${vs.payoff}\n5. CTA: ${vs.cta}\n\nTALKING POINTS:\n- ${ta.whyBlowingUp}\n- ${ta.creatorOpportunity}`;
    }

    return {
      script: format === 'tiktok'
        ? [hook, vs.context, vs.payoff].filter(Boolean).join('\n\n')
        : format === 'long-form'
        ? caption
        : fullScriptText,
      caption,
      hashtags: hashtagString,
      title: hook,
      duration: preset.duration,
    };
  }, [news?.trendAnalysis, format, prefilledHook, fullScriptText]);

  const handleCopy = (text: string) => {
    // Gate: check script export limit
    const check = canUseFeature('scripts');
    if (!check.allowed) {
      setShowProGate({ feature: 'script exports', used: check.used, limit: check.limit });
      return;
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Track usage
    if (user) trackUsageWithServer(user.id, 'scripts').catch(() => {});
  };

  const handlePlayVoiceover = () => {
    if (isPlaying) {
      stopSpeaking();
      setPlaying(false);
    } else if (fullScriptText) {
      speakText(fullScriptText, () => setPlaying(false), voiceStyle);
      setPlaying(true, 'creator-preview');
    }
  };

  const handleDownloadScript = () => {
    if (exportData?.script) {
      // Gate: check script export limit
      const check = canUseFeature('scripts');
      if (!check.allowed) {
        setShowProGate({ feature: 'script exports', used: check.used, limit: check.limit });
        return;
      }
      downloadScript(exportData.script, `trendsense-${format}`);
      if (user) trackUsageWithServer(user.id, 'scripts').catch(() => {});
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) return;
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setUploadSuccess(false);
  };

  const handleUploadReel = async () => {
    if (!videoFile || !news || !user) return;
    setIsUploading(true);

    let videoUrl = videoPreviewUrl || URL.createObjectURL(videoFile);

    try {
      const filePath = `${user.id}/${Date.now()}-${videoFile.name}`;
      const { data, error } = await supabase.storage
        .from('reels')
        .upload(filePath, videoFile, { contentType: videoFile.type });

      if (!error && data) {
        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(data.path);
        videoUrl = publicUrl.publicUrl;
      }
    } catch {
      console.warn('Supabase Storage not available, using local blob URL');
    }

    const reel: CreatorReel = {
      id: `reel-${Date.now()}`,
      newsId: news.id,
      creatorId: user.id,
      creatorName: user.name,
      creatorAvatar: user.avatar,
      videoUrl,
      thumbnailUrl: '',
      caption: reelCaption || `My take on: ${news.title}`,
      likes: 0,
      views: 0,
      duration: 30,
      createdAt: new Date().toISOString(),
    };

    addReel(reel);

    setIsUploading(false);
    setUploadSuccess(true);
    setVideoFile(null);
    setReelCaption('');
  };

  const handleRemoveVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setUploadSuccess(false);
  };

  if (!news) {
    return (
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col items-center justify-center px-6"
      >
        <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-white font-bold text-lg mb-2">No Story Selected</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Select a trending story to start creating content.
        </p>
        <button
          onClick={() => setView('feed')}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-sm border border-purple-500/20"
        >
          Browse Stories
        </button>
      </motion.div>
    );
  }

  const proGateModal = showProGate && (
    <ProGate
      feature={showProGate.feature}
      used={showProGate.used}
      limit={showProGate.limit}
      onClose={() => setShowProGate(null)}
      emotionalMessage="🔥 This script could go viral — unlock unlimited exports"
    />
  );

  const vs = news.trendAnalysis?.videoScript;

  return (
    <>
    {proGateModal}
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-[#0a0a0f] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => { stopSpeaking(); setPlaying(false); setPrefilledHook(null); setView('detail'); }}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-bold text-white">Creator Studio</h1>
          </div>
          <div className="w-10" />
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1 pb-3">
          {[
            { id: 'script' as const, label: 'Script', icon: FileText },
            { id: 'voiceover' as const, label: 'Voiceover', icon: Mic },
            { id: 'video' as const, label: 'Video', icon: Video },
            { id: 'upload' as const, label: 'Upload', icon: Upload },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Story context */}
      <div className="px-5 py-4 border-b border-white/5">
        <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Creating from</p>
        <p className="text-sm text-gray-300 font-medium line-clamp-2">{news.title}</p>
      </div>

      <div className="px-5 py-6 pb-32">
        <AnimatePresence mode="wait">
          {/* ═══ SCRIPT TAB ═══ */}
          {activeTab === 'script' && (
            <motion.div
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* No analysis fallback */}
              {!news.trendAnalysis && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Flame className="w-8 h-8 text-orange-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Go back to the story to generate the trend analysis first.</p>
                  <button
                    onClick={() => setView('detail')}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-orange-500/20 text-orange-300 font-semibold text-sm border border-orange-500/20"
                  >
                    ← Back to Story
                  </button>
                </div>
              )}

              {/* Script content */}
              {vs && (
                <>
                  {/* The script itself */}
                  <div className="bg-gradient-to-br from-orange-500/8 to-pink-500/8 border border-orange-500/15 rounded-2xl p-5">
                    {prefilledHook && (
                      <div className="mb-4 pb-4 border-b border-white/5">
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">YOUR HOOK</p>
                        <p className="text-white text-lg font-bold leading-snug">"{prefilledHook}"</p>
                      </div>
                    )}
                    <div className="space-y-4">
                      {!prefilledHook && vs.hook && (
                        <div>
                          <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">HOOK</p>
                          <p className="text-white text-[15px] leading-relaxed font-semibold">"{vs.hook}"</p>
                        </div>
                      )}
                      {vs.context && (
                        <div>
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">CONTEXT</p>
                          <p className="text-gray-300 text-sm leading-relaxed">{vs.context}</p>
                        </div>
                      )}
                      {vs.explanation && (
                        <div>
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">MAIN POINT</p>
                          <p className="text-gray-300 text-sm leading-relaxed">{vs.explanation}</p>
                        </div>
                      )}
                      {vs.payoff && (
                        <div>
                          <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">PAYOFF</p>
                          <p className="text-gray-200 text-sm leading-relaxed font-medium">{vs.payoff}</p>
                        </div>
                      )}
                      {vs.cta && (
                        <div>
                          <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-1">CTA</p>
                          <p className="text-gray-400 text-sm leading-relaxed">{vs.cta}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Export Format Selector */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Export For</p>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.entries(EXPORT_PRESETS) as [ExportFormat, typeof EXPORT_PRESETS[ExportFormat]][]).map(([id, preset]) => (
                        <button
                          key={id}
                          onClick={() => setFormat(id)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-all ${
                            format === id
                              ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                              : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          <span className="text-lg">{preset.icon}</span>
                          <span className="font-medium">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Platform-specific export preview */}
                  {exportData && (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {EXPORT_PRESETS[format].label} Export
                        </p>
                        <span className="text-[10px] text-gray-600">{exportData.duration}</span>
                      </div>

                      {/* Caption preview */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                          {format === 'long-form' ? 'OUTLINE' : 'CAPTION'}
                        </p>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                          {exportData.caption}
                        </p>
                      </div>

                      {/* Copy buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        {(() => {
                          const scriptCheck = canUseFeature('scripts');
                          const isLocked = !scriptCheck.allowed;
                          return (
                            <>
                              <button
                                onClick={() => handleCopy(exportData.script)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
                                  isLocked
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                    : 'bg-white/10 text-white hover:bg-white/15'
                                }`}
                              >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : isLocked ? <Lock className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : isLocked ? 'Unlock Copy' : 'Copy Script'}
                              </button>
                              <button
                                onClick={() => handleCopy(exportData.caption)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all border ${
                                  isLocked
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-500/20 hover:bg-purple-500/30'
                                }`}
                              >
                                {isLocked ? <Lock className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {isLocked ? 'Unlock Copy' : 'Copy Caption'}
                              </button>
                            </>
                          );
                        })()}
                      </div>

                      {/* Limit indicator */}
                      {(() => {
                        const scriptCheck = canUseFeature('scripts');
                        return !scriptCheck.allowed ? (
                          <p className="text-center text-xs text-amber-400/80">
                            Daily export limit reached ({scriptCheck.used}/{scriptCheck.limit})
                          </p>
                        ) : (
                          <p className="text-center text-xs text-gray-600">
                            {scriptCheck.limit - scriptCheck.used} free export{scriptCheck.limit - scriptCheck.used !== 1 ? 's' : ''} remaining today
                          </p>
                        );
                      })()}

                      {/* Download */}
                      {(() => {
                        const dlCheck = canUseFeature('scripts');
                        const isLocked = !dlCheck.allowed;
                        return (
                          <button
                            onClick={handleDownloadScript}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-medium text-sm transition-all ${
                              isLocked
                                ? 'border-amber-500/20 text-amber-300 bg-amber-500/10 hover:bg-amber-500/15'
                                : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {isLocked ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                            {isLocked ? 'Unlock Download' : 'Download Script'}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ VOICEOVER TAB ═══ */}
          {activeTab === 'voiceover' && (
            <motion.div
              key="voiceover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {!fullScriptText ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="text-gray-400 text-sm">No script available. Go back to the story to generate the trend analysis.</p>
                  <button
                    onClick={() => setView('detail')}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold text-sm border border-indigo-500/20"
                  >
                    ← Back to Story
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <Mic className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">AI Voiceover</h3>
                        <p className="text-gray-500 text-xs">Preview your script read aloud</p>
                      </div>
                    </div>

                    {/* Waveform visualization */}
                    <div className="flex items-center gap-1 h-16 mb-4 px-2">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-full bg-indigo-500/40"
                          animate={isPlaying ? {
                            height: [8, Math.random() * 50 + 10, 8],
                          } : { height: Math.sin(i * 0.3) * 15 + 20 }}
                          transition={isPlaying ? {
                            duration: 0.5 + Math.random() * 0.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          } : {}}
                          style={{ minHeight: 4 }}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handlePlayVoiceover}
                      className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all ${
                        isPlaying
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? 'Stop' : 'Preview Voice'}
                    </button>
                  </div>

                  {/* Script being read */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">READING THIS SCRIPT</p>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{fullScriptText}</p>
                  </div>

                  {/* Voice settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Voice Style</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: 'professional' as VoiceStyle, label: 'Professional', desc: 'Clear, authoritative' },
                        { id: 'casual' as VoiceStyle, label: 'Casual', desc: 'Relaxed, friendly' },
                        { id: 'energetic' as VoiceStyle, label: 'Energetic', desc: 'Upbeat, fast' },
                        { id: 'calm' as VoiceStyle, label: 'Calm', desc: 'Slow, thoughtful' },
                      ]).map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setVoiceStyle(voice.id)}
                          className={`p-3 rounded-xl text-left transition-all ${
                            voiceStyle === voice.id
                              ? 'bg-indigo-500/20 border border-indigo-500/30'
                              : 'bg-white/5 border border-white/5 hover:bg-white/8'
                          }`}
                        >
                          <p className={`text-sm font-medium ${voiceStyle === voice.id ? 'text-indigo-300' : 'text-gray-400'}`}>
                            {voice.label}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{voice.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export */}
                  <button
                    onClick={handleDownloadScript}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Export Script as Text
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* ═══ VIDEO TAB ═══ */}
          {activeTab === 'video' && (
            <motion.div
              key="video"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VideoGenerator />
            </motion.div>
          )}

          {/* ═══ UPLOAD REEL TAB ═══ */}
          {activeTab === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoSelect}
                className="hidden"
              />

              {!videoFile && !uploadSuccess && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-64 border-2 border-dashed border-purple-500/30 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                >
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Film className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">Select a Video</p>
                    <p className="text-gray-500 text-xs mt-1">MP4, WebM · Max 60 seconds</p>
                  </div>
                </button>
              )}

              {videoFile && videoPreviewUrl && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video
                      src={videoPreviewUrl}
                      className="w-full h-64 object-contain"
                      controls
                      playsInline
                    />
                    <button
                      onClick={handleRemoveVideo}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Caption</label>
                    <textarea
                      value={reelCaption}
                      onChange={(e) => setReelCaption(e.target.value)}
                      placeholder={`My take on: ${news.title.slice(0, 60)}...`}
                      maxLength={200}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
                      rows={3}
                    />
                    <p className="text-right text-[10px] text-gray-600 mt-1">{reelCaption.length}/200</p>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                    <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-600 uppercase">Linked to story</p>
                      <p className="text-xs text-gray-300 truncate">{news.title}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleUploadReel}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Publish Reel</>
                    )}
                  </button>
                </div>
              )}

              {uploadSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 gap-4 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-white font-bold text-lg">Reel Published!</h3>
                  <p className="text-gray-400 text-sm">Your reel is now live under this story.</p>
                  <button
                    onClick={() => {
                      setUploadSuccess(false);
                      fileInputRef.current?.click();
                    }}
                    className="mt-2 flex items-center gap-2 px-6 py-3 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-sm border border-purple-500/20"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Another
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    </>
  );
}
