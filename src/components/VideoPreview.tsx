import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Palette, Zap } from 'lucide-react';

interface Props {
  videoBlob: Blob | null;
  hookPreviewCanvas: HTMLCanvasElement | null;
  isGenerating: boolean;
  onRegenerate: () => void;
  onChangeStyle: () => void;
  onChangeHook: () => void;
}

export default function VideoPreview({
  videoBlob,
  hookPreviewCanvas,
  isGenerating,
  onRegenerate,
  onChangeStyle,
  onChangeHook,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Create blob URL for video
  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [videoBlob]);

  // Auto-play loop when video is ready
  useEffect(() => {
    const video = videoRef.current;
    if (video && blobUrl) {
      video.play().catch(() => {});
    }
  }, [blobUrl]);

  // Mount hook preview canvas during generation
  useEffect(() => {
    if (hookPreviewCanvas && canvasContainerRef.current && !videoBlob) {
      const container = canvasContainerRef.current;
      // Scale canvas to fit container while maintaining 9:16
      hookPreviewCanvas.style.width = '100%';
      hookPreviewCanvas.style.height = '100%';
      hookPreviewCanvas.style.objectFit = 'contain';
      hookPreviewCanvas.style.borderRadius = '16px';
      container.innerHTML = '';
      container.appendChild(hookPreviewCanvas);
    }
  }, [hookPreviewCanvas, videoBlob]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  return (
    <div className="space-y-4">
      {/* Video / Canvas preview container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative w-full aspect-[9/16] max-h-[60vh] rounded-2xl overflow-hidden bg-black/50 border border-white/10"
      >
        {/* Hook preview during generation */}
        {!videoBlob && (
          <div ref={canvasContainerRef} className="w-full h-full" />
        )}

        {/* Final video with auto-loop */}
        {blobUrl && (
          <>
            <video
              ref={videoRef}
              src={blobUrl}
              className="w-full h-full object-contain"
              loop
              playsInline
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
            />

            {/* Playback controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-center gap-3">
              <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
              </button>
              <button onClick={toggleMute} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
              <div className="flex-1" />
              <button onClick={toggleFullscreen} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </div>
          </>
        )}

        {/* Gradient pulse background during generation */}
        {isGenerating && !videoBlob && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 animate-pulse bg-gradient-radial from-purple-500/10 via-transparent to-transparent" />
          </div>
        )}
      </motion.div>

      {/* Replay loop actions (only after video is ready) */}
      {videoBlob && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2"
        >
          <button
            onClick={onRegenerate}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Regenerate
          </button>
          <button
            onClick={onChangeStyle}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
          >
            <Palette className="w-4 h-4" />
            Try Style
          </button>
          <button
            onClick={onChangeHook}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
          >
            <Zap className="w-4 h-4" />
            Try Hook
          </button>
        </motion.div>
      )}
    </div>
  );
}
