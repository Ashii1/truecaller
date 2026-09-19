import { useMemo, useEffect, useState } from 'react';

interface WaveformRippleVisualizerProps {
  active?: boolean;
  variant?: 'waveform' | 'ripple' | 'both';
  colorTheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan';
  barCount?: number;
  height?: number;
  statusLabel?: string;
  subLabel?: string;
  compact?: boolean;
}

export default function WaveformRippleVisualizer({
  active = true,
  variant = 'both',
  colorTheme = 'indigo',
  barCount = 18,
  height = 36,
  statusLabel,
  subLabel,
  compact = false,
}: WaveformRippleVisualizerProps) {
  const [frame, setFrame] = useState(0);

  // Animate waveform bars continuously when active
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 60);
    }, 80);
    return () => clearInterval(interval);
  }, [active]);

  const colorStyles = useMemo(() => {
    switch (colorTheme) {
      case 'emerald':
        return {
          bar: 'bg-emerald-400',
          gradient: 'from-emerald-500/30 via-emerald-400/20 to-transparent',
          ripple: 'border-emerald-500/30 bg-emerald-500/10',
          glow: 'shadow-emerald-500/40',
          text: 'text-emerald-300',
          orb: 'bg-emerald-500',
        };
      case 'amber':
        return {
          bar: 'bg-amber-400',
          gradient: 'from-amber-500/30 via-amber-400/20 to-transparent',
          ripple: 'border-amber-500/30 bg-amber-500/10',
          glow: 'shadow-amber-500/40',
          text: 'text-amber-300',
          orb: 'bg-amber-500',
        };
      case 'rose':
        return {
          bar: 'bg-rose-400',
          gradient: 'from-rose-500/30 via-rose-400/20 to-transparent',
          ripple: 'border-rose-500/30 bg-rose-500/10',
          glow: 'shadow-rose-500/40',
          text: 'text-rose-300',
          orb: 'bg-rose-500',
        };
      case 'cyan':
        return {
          bar: 'bg-cyan-400',
          gradient: 'from-cyan-500/30 via-cyan-400/20 to-transparent',
          ripple: 'border-cyan-500/30 bg-cyan-500/10',
          glow: 'shadow-cyan-500/40',
          text: 'text-cyan-300',
          orb: 'bg-cyan-500',
        };
      case 'indigo':
      default:
        return {
          bar: 'bg-indigo-400',
          gradient: 'from-indigo-500/30 via-indigo-400/20 to-transparent',
          ripple: 'border-indigo-500/30 bg-indigo-500/10',
          glow: 'shadow-indigo-500/40',
          text: 'text-indigo-300',
          orb: 'bg-indigo-500',
        };
    }
  }, [colorTheme]);

  // Compute heights for waveform bars dynamically to simulate organic voice modulation
  const bars = useMemo(() => {
    return Array.from({ length: barCount }).map((_, i) => {
      if (!active) return 15;
      // Synthesize multi-sine frequency wave
      const phase1 = Math.sin((i * 0.45) + (frame * 0.35));
      const phase2 = Math.cos((i * 0.8) - (frame * 0.2));
      const phase3 = Math.sin((i * 1.2) + (frame * 0.15));
      const combined = Math.abs((phase1 * 0.5) + (phase2 * 0.3) + (phase3 * 0.2));
      const normalized = Math.max(12, Math.min(100, Math.round(combined * 100)));
      return normalized;
    });
  }, [barCount, active, frame]);

  return (
    <div className={`flex items-center gap-3 select-none ${compact ? 'py-1' : 'py-2.5'}`}>
      {/* Ripple Animation Orb */}
      {(variant === 'ripple' || variant === 'both') && (
        <div className="relative flex items-center justify-center shrink-0 w-10 h-10">
          {active && (
            <>
              {/* Expanding Ripple Ring 1 */}
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-60 border animate-ping duration-1000 ${colorStyles.ripple}`}
              />
              {/* Expanding Ripple Ring 2 */}
              <span
                className={`absolute inline-flex h-8 w-8 rounded-full opacity-40 border animate-pulse duration-700 ${colorStyles.ripple}`}
              />
            </>
          )}
          {/* Center Orb */}
          <span
            className={`relative inline-flex h-4 w-4 rounded-full shadow-lg ${colorStyles.orb} ${colorStyles.glow} ${
              active ? 'scale-110 ring-2 ring-white/30' : 'opacity-40'
            } transition-all duration-300`}
          />
        </div>
      )}

      {/* Waveform Visualization Bars */}
      {(variant === 'waveform' || variant === 'both') && (
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div
            className="flex items-center justify-between gap-1 w-full"
            style={{ height: `${height}px` }}
            role="img"
            aria-label="Audio speech waveform visualizer"
          >
            {bars.map((barHeight, idx) => (
              <span
                key={idx}
                className={`flex-1 rounded-full transition-all duration-75 ${colorStyles.bar} ${
                  active ? 'opacity-90' : 'opacity-25'
                }`}
                style={{
                  height: `${barHeight}%`,
                  minHeight: '4px',
                  maxHeight: '100%',
                }}
              />
            ))}
          </div>

          {(statusLabel || subLabel) && (
            <div className="flex items-center justify-between mt-1 text-[10.5px]">
              {statusLabel && (
                <span className={`font-semibold tracking-tight truncate ${colorStyles.text}`}>
                  {statusLabel}
                </span>
              )}
              {subLabel && (
                <span className="text-slate-500 font-mono text-[9.5px] ml-2 shrink-0">
                  {subLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
