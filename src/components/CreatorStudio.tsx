import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Download, Copy, Check, Play, Pause, FileText, Mic, TrendingUp, Target, Hash, Lightbulb, Loader2, ChevronDown, ChevronUp, Upload, Film, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateCreatorScript, generateCreatorInsights } from '../lib/aiService';
import { speakText, stopSpeaking, downloadScript, type VoiceStyle } from '../lib/ttsService';
import { canUseFeature, trackUsageWithServer } from '../lib/subscription';
import { supabase } from '../lib/supabase';
import ProGate from './ProGate';
import type { CreatorScript, CreatorInsight, CreatorReel } from '../types';

export default function CreatorStudio() {
  const { selectedNews: news, setView, isPlaying, setPlaying, addScript, addReel, user } = useStore();
  const [activeTab, setActiveTab] = useState<'script' | 'voiceover' | 'insights' | 'upload'>('script');
  const [format, setFormat] = useState<CreatorScript['format']>('youtube-short');
  const [script, setScript] = useState<CreatorScript | null>(null);
  const [insights, setInsights] = useState<CreatorInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>('viral');
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('professional');
  const [showProGate, setShowProGate] = useState<{ feature: string; used: number; limit: number } | null>(null);
  
  // Upload reel state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [reelCaption, setReelCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateScript = async () => {
    if (!news) return;
    const check = canUseFeature('scripts');
    if (!check.allowed) {
      setShowProGate({ feature: 'script generations', used: check.used, limit: check.limit });
      return;
    }
    setIsGenerating(true);
    setScriptError(null);
    try {
      const result = await generateCreatorScript(news, format);
      setScript(result);
      addScript(result);
      if (user) await trackUsageWithServer(user.id, 'scripts');
    } catch (err: any) {
      console.error('Script generation failed:', err);
      setScriptError(err?.message || 'Failed to generate script');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!news) return;
    const check = canUseFeature('scripts');
    if (!check.allowed) {
      setShowProGate({ feature: 'AI generations', used: check.used, limit: check.limit });
      return;
    }
    try {
      const result = await generateCreatorInsights(news);
      setInsights(result);
      if (user) await trackUsageWithServer(user.id, 'scripts');
    } catch (err: any) {
      console.error('Insights generation failed:', err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayScript = () => {
    if (isPlaying) {
      stopSpeaking();
      setPlaying(false);
    } else if (script) {
      speakText(script.fullScript, () => setPlaying(false), voiceStyle);
      setPlaying(true, 'creator-preview');
    }
  };

  const handleDownloadScript = () => {
    if (script) {
      downloadScript(script.fullScript, `trendsense-script-${format}`);
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
    const check = canUseFeature('reelUploads');
    if (!check.allowed) {
      setShowProGate({ feature: 'reel uploads', used: check.used, limit: check.limit });
      return;
    }
    setIsUploading(true);
    
    let videoUrl = videoPreviewUrl || URL.createObjectURL(videoFile);
    
    // Upload to Supabase Storage (cloud) — falls back to blob URL if Supabase not configured
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
      // Fall back to blob URL if storage fails (local dev)
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
    if (user) await trackUsageWithServer(user.id, 'reelUploads');
    
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
          Select a story from the feed to generate scripts, voiceovers, and insights.
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
    />
  );

  const formats: { id: CreatorScript['format']; label: string; icon: string }[] = [
    { id: 'youtube-short', label: 'YT Short', icon: '▶️' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'instagram-reel', label: 'IG Reel', icon: '📷' },
    { id: 'long-form', label: 'Long Form', icon: '🎥' },
  ];

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
            onClick={() => { stopSpeaking(); setPlaying(false); setView('detail'); }}
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
            { id: 'insights' as const, label: 'Insights', icon: Lightbulb },
            { id: 'upload' as const, label: 'Upload Reel', icon: Upload },
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
          {/* Script Tab */}
          {activeTab === 'script' && (
            <motion.div
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Format selector */}
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Format</p>
                <div className="grid grid-cols-4 gap-2">
                  {formats.map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFormat(f.id);
                        setScript(null);
                        setScriptError(null);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs transition-all ${
                        format === f.id
                          ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                          : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-lg">{f.icon}</span>
                      <span className="font-medium">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  <p className="text-gray-500 text-sm">Generating your script...</p>
                </div>
              ) : scriptError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <p className="text-red-400 text-sm">{scriptError}</p>
                  <button
                    onClick={handleGenerateScript}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-sm hover:bg-purple-500/30 transition-all border border-purple-500/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    Try Again
                  </button>
                </div>
              ) : !script ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-purple-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Pick a format above, then generate your script</p>
                  <button
                    onClick={handleGenerateScript}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Script
                  </button>
                </div>
              ) : script ? (
                <div className="space-y-4">
                  {/* Viral Title */}
                  {script.viralTitle && (
                    <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-4">
                      <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-1">🔥 Viral Title</p>
                      <p className="text-white text-base font-bold leading-snug">{script.viralTitle}</p>
                    </div>
                  )}

                  {/* Hook */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">🎣 Hook</span>
                      <span className="text-[10px] text-gray-600">First 3 seconds — stop the scroll</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{script.hook}</p>
                  </div>

                  {/* Setup */}
                  {script.setup && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">🎯 Setup</span>
                        <span className="text-[10px] text-gray-600">Relatable connection</span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">{script.setup}</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {script.points && script.points.length > 0 && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">⚡ Key Points</span>
                        <span className="text-[10px] text-gray-600">Fast-paced delivery</span>
                      </div>
                      <div className="space-y-2">
                        {script.points.map((point, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <p className="text-gray-300 text-sm leading-relaxed">{point}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Twist / Payoff */}
                  {script.twist && (
                    <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">🔀 Twist</span>
                        <span className="text-[10px] text-gray-600">The payoff</span>
                      </div>
                      <p className="text-white text-sm leading-relaxed">{script.twist}</p>
                    </div>
                  )}

                  {/* CTA */}
                  {script.cta && (
                    <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">📢 Call to Action</span>
                      </div>
                      <p className="text-white text-sm leading-relaxed">{script.cta}</p>
                    </div>
                  )}

                  {/* Duration + Format */}
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-gray-600">Est. Duration: <span className="text-gray-400">{script.duration}</span></span>
                    <span className="text-xs text-gray-600">Format: <span className="text-gray-400">{format}</span></span>
                  </div>

                  {/* Description */}
                  {script.description && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📝 Caption / Description</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{script.description}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {script.tags && script.tags.length > 0 && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">🏷️ Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {script.tags.map((tag, i) => (
                          <button
                            key={i}
                            onClick={() => handleCopy(`#${tag}`)}
                            className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full hover:bg-blue-500/20 transition-all"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Thumbnail */}
                  {(script.thumbnailText || script.thumbnailIdea) && (
                    <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-4">
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">🖼️ Thumbnail</p>
                      {script.thumbnailText && (
                        <p className="text-white text-lg font-black mb-2">{script.thumbnailText}</p>
                      )}
                      {script.thumbnailIdea && (
                        <p className="text-gray-400 text-xs">{script.thumbnailIdea}</p>
                      )}
                    </div>
                  )}

                  {/* AI Image Prompt */}
                  {script.imagePrompt && (
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">🎨 AI Image Prompt</p>
                      <p className="text-gray-400 text-xs leading-relaxed font-mono">{script.imagePrompt}</p>
                      <button
                        onClick={() => handleCopy(script.imagePrompt)}
                        className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {copied ? '✓ Copied' : 'Copy prompt'}
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={() => handleCopy(script.fullScript)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy Script'}
                    </button>
                    <button
                      onClick={handleDownloadScript}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/20 text-purple-300 font-medium text-sm hover:bg-purple-500/30 transition-all border border-purple-500/20"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={handleGenerateScript}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-gray-400 font-medium text-sm hover:text-white hover:border-white/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Regenerate Script
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Voiceover Tab */}
          {activeTab === 'voiceover' && (
            <motion.div
              key="voiceover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <Mic className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">AI Voiceover</h3>
                    <p className="text-gray-500 text-xs">Preview and export audio narration</p>
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

                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayScript}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all ${
                      isPlaying
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Stop Preview' : 'Preview Voice'}
                  </button>
                </div>
              </div>

              {/* Voice settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Voice Settings</h3>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'professional' as VoiceStyle, label: 'Professional' },
                    { id: 'casual' as VoiceStyle, label: 'Casual' },
                    { id: 'energetic' as VoiceStyle, label: 'Energetic' },
                    { id: 'calm' as VoiceStyle, label: 'Calm' },
                  ]).map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setVoiceStyle(voice.id)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        voiceStyle === voice.id
                          ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                          : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {voice.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Export Audio</h3>
                <p className="text-xs text-gray-600">Uses browser TTS for preview. Connect ElevenLabs API for HD export.</p>
                <button
                  onClick={handleDownloadScript}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20"
                >
                  <Download className="w-4 h-4" />
                  Export Script as Text
                </button>
              </div>
            </motion.div>
          )}

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {!insights ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Lightbulb className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-gray-400 text-sm">Get AI-powered insights for this story</p>
                  <button
                    onClick={handleGenerateInsights}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Generate Insights
                  </button>
                </div>
              ) : (
                <>
              {/* Viral Reason */}
              <div
                className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedInsight(expandedInsight === 'viral' ? null : 'viral')}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                    <span className="text-white font-bold text-sm">Why This Will Go Viral</span>
                  </div>
                  {expandedInsight === 'viral' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                <AnimatePresence>
                  {expandedInsight === 'viral' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4"
                    >
                      <p className="text-gray-300 text-sm leading-relaxed">{insights.viralReason}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Best Angle */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedInsight(expandedInsight === 'angle' ? null : 'angle')}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-bold text-sm">Best Content Angle</span>
                  </div>
                  {expandedInsight === 'angle' ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                <AnimatePresence>
                  {expandedInsight === 'angle' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4"
                    >
                      <p className="text-gray-300 text-sm leading-relaxed">{insights.bestAngle}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Target Audience */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold text-gray-300">🎯 Target Audience</span>
                </div>
                <p className="text-gray-400 text-sm">{insights.targetAudience}</p>
              </div>

              {/* Hashtags */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-gray-300">Suggested Hashtags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {insights.suggestedHashtags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleCopy(tag)}
                      className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full hover:bg-blue-500/20 transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Engagement Tips */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-gray-300">Engagement Tips</span>
                </div>
                <div className="space-y-2">
                  {insights.engagementTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-xs text-purple-400 font-bold mt-0.5">{i + 1}</span>
                      <p className="text-gray-400 text-sm">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Copy all button */}
              <button
                onClick={() => {
                  const allInsights = `VIRAL REASON:\n${insights.viralReason}\n\nBEST ANGLE:\n${insights.bestAngle}\n\nTARGET AUDIENCE:\n${insights.targetAudience}\n\nHASHTAGS:\n${insights.suggestedHashtags.join(' ')}\n\nTIPS:\n${insights.engagementTips.join('\n')}`;
                  handleCopy(allInsights);
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy All Insights'}
              </button>
                </>
              )}
            </motion.div>
          )}

          {/* Upload Reel Tab */}
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
                  {/* Video preview */}
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

                  {/* Caption */}
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

                  {/* Linked story */}
                  <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                    <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-600 uppercase">Linked to story</p>
                      <p className="text-xs text-gray-300 truncate">{news.title}</p>
                    </div>
                  </div>

                  {/* Upload button */}
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
