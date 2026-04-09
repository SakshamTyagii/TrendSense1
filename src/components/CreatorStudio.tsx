import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Download, Copy, Check, Play, Pause, FileText, Mic, TrendingUp, Target, Hash, Lightbulb, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateCreatorScript, generateCreatorInsights } from '../lib/aiService';
import { speakText, stopSpeaking, downloadScript } from '../lib/ttsService';
import type { CreatorScript, CreatorInsight } from '../types';

export default function CreatorStudio() {
  const { selectedNews: news, setView, isPlaying, setPlaying, addScript } = useStore();
  const [activeTab, setActiveTab] = useState<'script' | 'voiceover' | 'insights'>('script');
  const [format, setFormat] = useState<CreatorScript['format']>('youtube-short');
  const [script, setScript] = useState<CreatorScript | null>(null);
  const [insights, setInsights] = useState<CreatorInsight | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>('viral');

  useEffect(() => {
    if (news) {
      handleGenerateScript();
      handleGenerateInsights();
    }
  }, [news]);

  const handleGenerateScript = async () => {
    if (!news) return;
    setIsGenerating(true);
    const result = await generateCreatorScript(news, format);
    setScript(result);
    addScript(result);
    setIsGenerating(false);
  };

  const handleGenerateInsights = async () => {
    if (!news) return;
    const result = await generateCreatorInsights(news);
    setInsights(result);
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
      speakText(script.fullScript, () => setPlaying(false));
      setPlaying(true, 'creator-preview');
    }
  };

  const handleDownloadScript = () => {
    if (script) {
      downloadScript(script.fullScript, `trendsense-script-${format}`);
    }
  };

  if (!news) return null;

  const formats: { id: CreatorScript['format']; label: string; icon: string }[] = [
    { id: 'youtube-short', label: 'YT Short', icon: '▶️' },
    { id: 'tiktok', label: 'TikTok', icon: '🎵' },
    { id: 'instagram-reel', label: 'IG Reel', icon: '📷' },
    { id: 'long-form', label: 'Long Form', icon: '🎥' },
  ];

  return (
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
                        setTimeout(handleGenerateScript, 100);
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
              ) : script ? (
                <div className="space-y-4">
                  {/* Hook */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">🎣 Hook</span>
                      <span className="text-[10px] text-gray-600">First 3 seconds</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{script.hook}</p>
                  </div>

                  {/* Body */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">📝 Body</span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{script.body}</p>
                  </div>

                  {/* Ending */}
                  <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-green-400 uppercase tracking-wider">🎬 Ending / CTA</span>
                    </div>
                    <p className="text-white text-sm leading-relaxed">{script.ending}</p>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-gray-600">Est. Duration: <span className="text-gray-400">{script.duration}</span></span>
                    <span className="text-xs text-gray-600">Format: <span className="text-gray-400">{format}</span></span>
                  </div>

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
                  {['Professional', 'Casual', 'Energetic', 'Calm'].map((voice, i) => (
                    <button
                      key={voice}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        i === 0
                          ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                          : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      {voice}
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
          {activeTab === 'insights' && insights && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
