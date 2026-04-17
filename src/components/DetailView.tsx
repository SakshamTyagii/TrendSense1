import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX, Bookmark, BookmarkCheck, Share2, ExternalLink, Clock, TrendingUp, Loader2, Copy, Check, Zap, Flame } from 'lucide-react';
import { useStore } from '../store/useStore';
import { speakText, stopSpeaking } from '../lib/ttsService';
import { generateTrendAnalysis, generateNarrationScript } from '../lib/aiService';
import { formatDistanceToNow } from 'date-fns';
import ReelCarousel from './ReelCarousel';

export default function DetailView() {
  const { selectedNews: news, setView, setSelectedNews, updateNewsItem, isPlaying, currentAudioId, setPlaying, user, toggleSaved, setCreatorMode, setPrefilledHook } = useStore();


  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [copiedHook, setCopiedHook] = useState<number | null>(null);
  const isCurrentPlaying = isPlaying && currentAudioId === news?.id;
  const isSaved = user?.savedStories.includes(news?.id || '') || false;

  useEffect(() => {
    return () => {
      stopSpeaking();
      setPlaying(false);
    };
  }, []);

  // Enrich article with AI-generated trend analysis if missing
  useEffect(() => {
    if (news && !news.trendAnalysis) {
      setIsEnriching(true);
      setEnrichError(null);
      generateTrendAnalysis(news)
        .then((result) => {
          const enriched = { ...news, trendAnalysis: result };
          setSelectedNews(enriched);
          updateNewsItem(enriched);
          setIsEnriching(false);
        })
        .catch((err) => {
          console.error('AI enrichment failed:', err);
          setIsEnriching(false);
          setEnrichError(err?.message || 'Failed to generate trend analysis');
        });
    }
  }, [news?.id]);

  if (!news) return null;

  const handlePlayAudio = async () => {
    if (isCurrentPlaying) {
      stopSpeaking();
      setPlaying(false);
      return;
    }

    // Generate full narration for detail view (longer than feed version)
    let narration = news.narrationScript;
    if (!narration) {
      setIsLoadingAudio(true);
      try {
        narration = await generateNarrationScript(news);
        const enriched = { ...news, narrationScript: narration };
        setSelectedNews(enriched);
        updateNewsItem(enriched);
      } catch {
        narration = `${news.title}. ${news.trendAnalysis?.whatsGoingOn || news.description}`;
      }
      setIsLoadingAudio(false);
    }

    speakText(narration, () => setPlaying(false));
    setPlaying(true, news.id);
  };

  const handleCreator = () => {
    setPrefilledHook(null);
    setCreatorMode(true);
    setView('creator');
  };

  const handleHookTap = (hook: string) => {
    setPrefilledHook(hook);
    setCreatorMode(true);
    setView('creator');
  };

  const handleCopyHook = (e: React.MouseEvent, text: string, index: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedHook(index);
    setTimeout(() => setCopiedHook(null), 2000);
  };

  const categoryColors: Record<string, string> = {
    tech: 'from-blue-500 to-cyan-500',
    politics: 'from-red-500 to-orange-500',
    finance: 'from-green-500 to-emerald-500',
    sports: 'from-yellow-500 to-amber-500',
    entertainment: 'from-purple-500 to-pink-500',
    world: 'from-indigo-500 to-violet-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-[#0a0a0f] overflow-y-auto"
    >
      {/* Hero */}
      <div className="relative h-72 sm:h-80">
        <img src={news.imageUrl} alt={news.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `/images/category-${news.category}.jpg`; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/60 to-transparent" />
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
          <button
            onClick={() => { stopSpeaking(); setPlaying(false); setView('feed'); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSaved(news.id)}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
            >
              {isSaved ? <BookmarkCheck className="w-5 h-5 text-indigo-400" /> : <Bookmark className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => navigator.share?.({ title: news.title, text: news.description })}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-32 -mt-16 relative z-10">
        {/* Meta */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r ${categoryColors[news.category]} text-white`}>
            {news.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
            <TrendingUp className="w-3 h-3" />{news.trendScore}%
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(news.publishedAt), { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2">
          {news.title}
        </h1>

        {/* Source */}
        <p className="text-sm text-gray-500 mb-6">
          Source: <span className="text-gray-400">{news.source}</span>
        </p>

        {/* Audio controls */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
              isCurrentPlaying
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                : isLoadingAudio
                ? 'bg-white/10 text-white/50'
                : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            {isLoadingAudio ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Preparing...</>
            ) : isCurrentPlaying ? (
              <><VolumeX className="w-4 h-4" /> Stop</>
            ) : (
              <><Volume2 className="w-4 h-4" /> Listen</>
            )}
          </button>
        </div>

        {/* Loading state */}
        {isEnriching && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-gray-500 text-sm">Analyzing trend...</p>
          </div>
        )}

        {enrichError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
            <p className="text-sm text-red-400">{enrichError}</p>
          </div>
        )}

        {/* === HERO: VIRAL HOOKS === */}
        {news.trendAnalysis?.viralHooks && news.trendAnalysis.viralHooks.some(h => h) && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">Use This Hook</h3>
              <span className="text-[10px] text-gray-600 ml-1">tap to create</span>
            </div>
            <div className="space-y-3">
              {news.trendAnalysis.viralHooks.filter(h => h).map((hook, i) => (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleHookTap(hook)}
                  className="w-full text-left bg-gradient-to-r from-yellow-500/8 to-orange-500/8 border border-yellow-500/20 rounded-2xl p-4 group hover:border-yellow-500/40 hover:bg-yellow-500/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <p className="text-white text-[15px] leading-relaxed font-semibold">{hook}</p>
                    </div>
                    <button
                      onClick={(e) => handleCopyHook(e, hook, i)}
                      className="flex-shrink-0 mt-1 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {copiedHook === i ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                      )}
                    </button>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* === COMPRESSED INSIGHT (1 block) === */}
        {news.trendAnalysis && (
          <section className="mb-8 bg-white/[0.03] border border-white/5 rounded-2xl p-5">
            <p className="text-gray-300 text-[15px] leading-relaxed">
              {news.trendAnalysis.whyBlowingUp}
            </p>
            {news.trendAnalysis.creatorOpportunity && (
              <p className="text-purple-300/90 text-sm leading-relaxed mt-3 pt-3 border-t border-white/5">
                <span className="text-purple-400 font-semibold">Creator angle:</span>{' '}
                {news.trendAnalysis.creatorOpportunity}
              </p>
            )}
          </section>
        )}

        {/* Fallback description when no analysis yet */}
        {!news.trendAnalysis && !isEnriching && (
          <section className="mb-8">
            <p className="text-gray-300 text-[15px] leading-relaxed">{news.description}</p>
          </section>
        )}

        {/* === VIDEO SCRIPT (visible, not collapsed) === */}
        {news.trendAnalysis?.videoScript && (
          <section className="mb-8 bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 border border-indigo-500/15 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-400" />
              <h3 className="text-base font-bold text-white">Ready-to-Use Script</h3>
              <span className="text-[10px] text-gray-600">30-45 sec</span>
            </div>
            <div className="space-y-3">
              {news.trendAnalysis.videoScript.hook && (
                <p className="text-white text-[15px] leading-relaxed font-semibold">
                  "{news.trendAnalysis.videoScript.hook}"
                </p>
              )}
              {news.trendAnalysis.videoScript.context && (
                <p className="text-gray-400 text-sm leading-relaxed">{news.trendAnalysis.videoScript.context}</p>
              )}
              {news.trendAnalysis.videoScript.explanation && (
                <p className="text-gray-300 text-sm leading-relaxed">{news.trendAnalysis.videoScript.explanation}</p>
              )}
              {news.trendAnalysis.videoScript.payoff && (
                <p className="text-gray-200 text-sm leading-relaxed font-medium">{news.trendAnalysis.videoScript.payoff}</p>
              )}
              {news.trendAnalysis.videoScript.cta && (
                <p className="text-gray-400 text-xs italic">{news.trendAnalysis.videoScript.cta}</p>
              )}
            </div>
            {/* CTA */}
            <button
              onClick={handleCreator}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-sm shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
            >
              <Flame className="w-4 h-4" />
              Turn This Into a Viral Video
            </button>
          </section>
        )}

        {/* Tags */}
        {news.tags && news.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {news.tags.map(tag => (
              <span key={tag} className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Creator Reels */}
        <ReelCarousel newsId={news.id} />

        {/* Source reference */}
        <div className="border-t border-white/5 pt-6 mt-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Source:</span>
            <span className="text-xs text-gray-400">{news.source}</span>
            {news.sourceUrl && (
              <a
                href={news.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Original
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
