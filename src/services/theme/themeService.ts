export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
export type AccentPreset = 'BLUE' | 'PURPLE' | 'GREEN' | 'ORANGE' | 'RED' | 'TEAL' | 'PINK' | 'CUSTOM';
export type Density = 'COMPACT' | 'COMFORTABLE' | 'SPACIOUS';
export type CornerStyle = 'SHARP' | 'SOFT' | 'ROUND';
export type BackgroundStyle = 'SOLID' | 'GRADIENT' | 'MIDNIGHT' | 'AURORA';

export interface AppThemePreferences {
  mode: ThemeMode;
  accent: AccentPreset;
  customAccent: string;
  density: Density;
  cornerStyle: CornerStyle;
  background: BackgroundStyle;
  fontScale: number;
  reduceMotion: boolean;
  highContrast: boolean;
  showNavigationLabels: boolean;
}

export const THEME_STORAGE_KEY = 'vigilshield_theme_preferences_v1';

export const DEFAULT_THEME: AppThemePreferences = {
  mode: 'DARK',
  accent: 'BLUE',
  customAccent: '#3b82f6',
  density: 'COMFORTABLE',
  cornerStyle: 'SOFT',
  background: 'SOLID',
  fontScale: 1,
  reduceMotion: false,
  highContrast: false,
  showNavigationLabels: true,
};

export const ACCENT_COLORS: Record<Exclude<AccentPreset, 'CUSTOM'>, string> = {
  BLUE: '#3b82f6',
  PURPLE: '#8b5cf6',
  GREEN: '#10b981',
  ORANGE: '#f97316',
  RED: '#ef4444',
  TEAL: '#14b8a6',
  PINK: '#ec4899',
};

export function readThemePreferences(): AppThemePreferences {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw) as Partial<AppThemePreferences>;
    return {
      ...DEFAULT_THEME,
      ...parsed,
      fontScale: clampNumber(Number(parsed.fontScale ?? DEFAULT_THEME.fontScale), 0.9, 1.15),
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export function resolveAccent(theme: AppThemePreferences): string {
  if (theme.accent === 'CUSTOM') return normalizeHex(theme.customAccent, DEFAULT_THEME.customAccent);
  return ACCENT_COLORS[theme.accent];
}

export function applyTheme(theme: AppThemePreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme.mode === 'DARK' || (theme.mode === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const accent = resolveAccent(theme);

  root.classList.toggle('vs-theme-dark', isDark);
  root.classList.toggle('vs-theme-light', !isDark);
  root.classList.toggle('vs-high-contrast', theme.highContrast);
  root.classList.toggle('vs-reduce-motion', theme.reduceMotion);
  root.classList.toggle('vs-density-compact', theme.density === 'COMPACT');
  root.classList.toggle('vs-density-spacious', theme.density === 'SPACIOUS');
  root.classList.toggle('vs-corners-sharp', theme.cornerStyle === 'SHARP');
  root.classList.toggle('vs-corners-round', theme.cornerStyle === 'ROUND');
  root.dataset.vsBackground = theme.background;
  root.style.setProperty('--vs-accent', accent);
  root.style.setProperty('--vs-accent-soft', hexToRgba(accent, 0.14));
  root.style.setProperty('--vs-accent-border', hexToRgba(accent, 0.42));
  root.style.setProperty('--vs-font-scale', String(theme.fontScale));
}

export function persistAndApplyTheme(theme: AppThemePreferences): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  applyTheme(theme);
}

function clampNumber(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function normalizeHex(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
