import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Download,
  Folder,
  Pause,
  Play,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  AudioLines,
} from 'lucide-react';
import { CallRecordingItem } from '../types';
import { callRecordingService } from '../services/callRecordingService';

interface AudioRecordingPlayerProps {
  key?: string | number;
  recording: CallRecordingItem;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export default function AudioRecordingPlayer({
  recording,
  onDelete,
  compact = false,
}: AudioRecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
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

  const handleDownload = () => {
    callRecordingService.downloadRecordingToDevice(recording);
    setDownloadedNotice(true);
    setTimeout(() => setDownloadedNotice(false), 3000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const dateStr = new Date(recording.timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const fileSizeKb = Math.max(1, Math.round(recording.fileSizeBytes / 1024));

  return (
    <div className="w-full rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-[#0e1724] to-[#0a1017] p-3.5 shadow-lg shadow-black/40 transition-all">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={recording.dataUri} preload="metadata" />

      {/* Header Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <AudioLines className="h-3 w-3 animate-pulse" />
              {recording.quality || '48 kHz Studio HD'}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {formatSeconds(duration)} · {fileSizeKb} KB
            </span>
          </div>

          <p className="mt-1 font-mono text-xs font-semibold text-white truncate">
            {recording.fileName}
          </p>

          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
            <Folder className="h-3 w-3 shrink-0 text-amber-400/80" />
            <span className="truncate text-slate-400 font-mono">
              {recording.folderPath}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            title="Save to Device Storage"
            className="flex items-center gap-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save to Device</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(recording.id)}
              title="Delete Recording"
              className="rounded-xl p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {downloadedNotice && (
        <div className="mt-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-300 font-semibold flex items-center justify-between">
          <span>Saved to device storage folder: {recording.fileName}</span>
        </div>
      )}

      {/* Audio Playback Controls */}
      <div className="mt-3 flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Progress Bar & Waveform Scrubbing */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="font-semibold text-emerald-400">{formatSeconds(currentTime)}</span>
            <span>{formatSeconds(duration)}</span>
          </div>

          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Playback speed toggle */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10 transition"
          title="Playback speed"
        >
          {playbackRate}x
        </button>

        {/* Mute button */}
        <button
          type="button"
          onClick={toggleMute}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-white transition"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Audio Visualizer Waves when playing */}
      {isPlaying && (
        <div className="mt-2.5 flex items-center justify-center gap-1 h-3 overflow-hidden px-2">
          {Array.from({ length: 24 }).map((_, i) => {
            const delay = (i % 6) * 0.1;
            const height = 4 + ((i * 7) % 10);
            return (
              <span
                key={i}
                className="w-1 bg-emerald-400/80 rounded-full animate-pulse"
                style={{
                  height: `${height}px`,
                  animationDuration: `${0.4 + (i % 4) * 0.15}s`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
