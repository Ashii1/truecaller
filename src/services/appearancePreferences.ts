export type StoredAppearance = {
  theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
  accent?: string;
  customAccent?: string;
  density?: 'COMFORTABLE' | 'COMPACT';
  fontScale?: 'SMALL' | 'DEFAULT' | 'LARGE' | 'XLARGE';
  reducedMotion?: boolean;
  amoled?: boolean;
};

export const APPEARANCE_STORAGE_KEY = 'vigilshield_appearance_v1';

const DEFAULT_APPEARANCE: Required<StoredAppearance> = {
  theme: 'SYSTEM',
  accent: '#3b82f6',
  customAccent: '#3b82f6',
  density: 'COMFORTABLE',
  fontScale: 'DEFAULT',
  reducedMotion: false,
  amoled: false,
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(59,130,246,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

export function readAppearancePreferences(): Required<StoredAppearance> {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;
  try {
    const stored = JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) || '{}') as StoredAppearance;
    const merged = { ...DEFAULT_APPEARANCE, ...stored };
    if (!/^#[0-9a-fA-F]{6}$/.test(merged.accent)) merged.accent = DEFAULT_APPEARANCE.accent;
    return merged;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function applyAppearancePreferences(preferences = readAppearancePreferences()) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.vsTheme = preferences.theme.toLowerCase();
  root.dataset.vsDensity = preferences.density.toLowerCase();
  root.dataset.vsFontScale = preferences.fontScale.toLowerCase();
  root.dataset.vsReducedMotion = preferences.reducedMotion ? 'true' : 'false';
  root.dataset.vsAmoled = preferences.amoled ? 'true' : 'false';
  root.style.setProperty('--vs-accent', preferences.accent);
  root.style.setProperty('--vs-accent-soft', hexToRgba(preferences.accent, 0.14));
  root.style.setProperty('--vs-accent-border', hexToRgba(preferences.accent, 0.42));
}
