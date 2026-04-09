import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Heart, Share2, MessageCircle, Sparkles, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import type { CreatorReel } from '../types';

interface ReelPlayerProps {
  reel: CreatorReel;
  allReels: CreatorReel[];
  onClose: () => void;
}

export default function ReelPlayer({ reel: initialReel, allReels, onClose }: ReelPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(() => allReels.findIndex(r => r.id === initialReel.id));
  const [liked, setLiked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentReel = allReels[currentIndex] || initialReel;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < allReels.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setLiked(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setLiked(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: currentReel.caption, text: `Check out this reel on TrendSense` });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black"
    >
      {/* Video */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={currentReel.videoUrl}
          className="w-full h-full object-contain"
          loop
          playsInline
          autoPlay
          muted={false}
          onClick={(e) => {
            const video = e.target as HTMLVideoElement;
            if (video.paused) video.play();
            else video.pause();
          }}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-xs text-white/60">
          {currentIndex + 1} / {allReels.length}
        </span>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-8 z-10 bg-gradient-to-t from-black/80 to-transparent">
        {/* Creator */}
        <div className="flex items-center gap-3 mb-3">
          <img
            src={currentReel.creatorAvatar}
            alt=""
            className="w-10 h-10 rounded-full bg-white/10 border-2 border-purple-500"
          />
          <div>
            <p className="text-white font-bold text-sm">{currentReel.creatorName}</p>
            <p className="text-gray-400 text-xs">Creator</p>
          </div>
        </div>
        {/* Caption */}
        <p className="text-white text-sm leading-relaxed mb-3">
          {currentReel.caption}
        </p>
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {currentReel.views.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {currentReel.likes + (liked ? 1 : 0)} likes
          </span>
        </div>
      </div>

      {/* Side actions */}
      <div className="absolute right-4 bottom-40 flex flex-col items-center gap-6 z-20">
        <button
          onClick={() => setLiked(!liked)}
          className="flex flex-col items-center gap-1"
        >
          <Heart className={`w-8 h-8 transition-colors ${liked ? 'text-pink-500 fill-pink-500' : 'text-white'}`} />
          <span className="text-[10px] text-white">{currentReel.likes + (liked ? 1 : 0)}</span>
        </button>
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-[10px] text-white">Share</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-[10px] text-white">Comment</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Sparkles className="w-7 h-7 text-purple-400" />
          <span className="text-[10px] text-white">Create</span>
        </button>
      </div>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrev}
          className="absolute top-1/2 -translate-y-8 left-1/2 -translate-x-1/2 z-20"
        >
          <ChevronUp className="w-8 h-8 text-white/40" />
        </button>
      )}
      {currentIndex < allReels.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute bottom-1/2 translate-y-8 left-1/2 -translate-x-1/2 z-20"
        >
          <ChevronDown className="w-8 h-8 text-white/40" />
        </button>
      )}
    </motion.div>
  );
}
