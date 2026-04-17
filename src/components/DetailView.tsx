import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX, Bookmark, BookmarkCheck, Share2, ExternalLink, Sparkles, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { speakText, stopSpeaking } from '../lib/ttsService';
import { generateExplanation, generateNarrationScript } from '../lib/aiService';
import { formatDistanceToNow } from 'date-fns';
import ReelCarousel from './ReelCarousel';

export default function DetailView() {
  const { selectedNews: news, setView, setSelectedNews, updateNewsItem, isPlaying, currentAudioId, setPlaying, user, toggleSaved, setCreatorMode } = useStore();


  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const isCurrentPlaying = isPlaying && currentAudioId === news?.id;
  const isSaved = user?.savedStories.includes(news?.id || '') || false;

  useEffect(() => {
    return () => {
      stopSpeaking();
      setPlaying(false);
    };
  }, []);

  // Enrich article with AI-generated content if missing
  useEffect(() => {
    if (news && !news.explanation) {
      setIsEnriching(true);
      setEnrichError(null);
      generateExplanation(news)
        .then((result) => {
          const enriched = { ...news, ...result };
          setSelectedNews(enriched);
          updateNewsItem(enriched);
          setIsEnriching(false);
        })
        .catch((err) => {
          console.error('AI enrichment failed:', err);
          setIsEnriching(false);
          setEnrichError(err?.message || 'Failed to generate AI explanation');
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
        narration = `${news.title}. ${news.explanation || news.description}`;
      }
      setIsLoadingAudio(false);
    }

    speakText(narration, () => setPlaying(false));
    setPlaying(true, news.id);
  };

  const handleCreator = () => {
    setCreatorMode(true);
    setView('creator');
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
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all ${
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
              <><VolumeX className="w-4 h-4" /> Stop Listening</>
            ) : (
              <><Volume2 className="w-4 h-4" /> Listen to Story</>
            )}
          </button>
          <button
            onClick={handleCreator}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-500/20"
          >
            <Sparkles className="w-4 h-4" /> Creator Studio
          </button>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {/* Explanation */}
          <section>
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-indigo-500" />
              What Happened
              {isEnriching && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
            </h3>
            <p className="text-gray-300 leading-relaxed text-[15px] whitespace-pre-line">
              {news.explanation || news.description}
            </p>
            {enrichError && (
              <p className="mt-3 text-sm text-red-400/80 bg-red-500/10 rounded-lg px-4 py-3">
                {enrichError}
              </p>
            )}
          </section>

          {/* Why Trending */}
          {news.whyTrending && (
            <section className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">
              <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Why It's Trending
              </h3>
              <p className="text-gray-300 leading-relaxed text-[15px]">
                {news.whyTrending}
              </p>
            </section>
          )}

          {/* Why It Matters */}
          {news.whyMatters && (
            <section className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-5">
              <h3 className="text-lg font-bold text-indigo-400 mb-3">Why It Matters</h3>
              <p className="text-gray-300 leading-relaxed text-[15px]">
                {news.whyMatters}
              </p>
            </section>
          )}

          {/* Tags */}
          {news.tags && news.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
          <div className="border-t border-white/5 pt-6">
            <p className="text-xs text-gray-600 mb-2">Verified Source</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{news.source}</span>
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
      </div>
    </motion.div>
  );
}
