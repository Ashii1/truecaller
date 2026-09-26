import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Share2, Trash2 } from 'lucide-react';
import { CallRecordingItem } from '../types';
import { useI18n } from '../i18n/LanguageContext';

interface CallAudioPlayerProps {
  recording: CallRecordingItem;
  onDelete?: (id: string) => void;
  autoPlay?: boolean;
}

const formatAudioTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CallAudioPlayer({ recording, onDelete, autoPlay = false }: CallAudioPlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds || 0);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [autoPlay]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const cycleSpeed = () => {
    const speeds: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const handleShare = async () => {
    if (navigator.share && recording.dataUri) {
      try {
        await navigator.share({
          title: `Call Recording - ${recording.callerName || recording.number}`,
          text: `CallShield Call Recording (${formatAudioTime(duration)})`,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    // Fallback: download/export
    if (recording.dataUri) {
      const a = document.createElement('a');
      a.href = recording.dataUri;
      a.download = recording.fileName || `recording_${recording.id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#070b13] p-3 text-white shadow-inner">
      {recording.dataUri && <audio ref={audioRef} src={recording.dataUri} preload="metadata" />}

      <div className="flex items-center justify-between gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition active:scale-95 shadow-md ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
          }`}
          title={isPlaying ? t('pause_recording') : t('play_recording')}
          aria-label={isPlaying ? t('pause_recording') : t('play_recording')}
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </button>

        {/* Progress Bar & Timing */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400 focus:outline-none"
              style={{
                background: `linear-gradient(to right, rgb(52, 211, 153) ${progressPercent}%, rgb(30, 41, 59) ${progressPercent}%)`,
              }}
              aria-label="Seek recording position"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{formatAudioTime(currentTime)}</span>
            <div className="flex items-center gap-1.5">
              {isPlaying && (
                <span className="flex items-center gap-0.5 text-emerald-400 font-sans text-[10px] font-bold">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {t('playing_audio')}
                </span>
              )}
              <span>{formatAudioTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Playback Controls: Speed, Mute, Share, Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-lg bg-slate-800/90 hover:bg-slate-700 px-2 py-1 text-[11px] font-mono font-bold text-slate-300 transition active:scale-95 cursor-pointer"
            title="Cycle playback speed"
          >
            {speed}×
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition active:scale-95 cursor-pointer"
            title={isMuted ? t('unmute') : t('mute')}
            aria-label={isMuted ? t('unmute') : t('mute')}
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition active:scale-95 cursor-pointer"
            title={t('export_recording')}
            aria-label={t('export_recording')}
          >
            <Share2 className="h-4 w-4" />
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(recording.id)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-950/60 hover:text-rose-400 transition active:scale-95 cursor-pointer"
              title={t('delete_recording')}
              aria-label={t('delete_recording')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {copyFeedback && (
        <div className="mt-1.5 text-right text-[10px] font-semibold text-emerald-400 animate-in fade-in">
          {t('recording_downloaded')}
        </div>
      )}
    </div>
  );
}
