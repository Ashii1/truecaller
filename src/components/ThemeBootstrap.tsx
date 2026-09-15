import { useEffect } from 'react';
import { applyTheme, readThemePreferences } from '../services/theme/themeService';

export default function ThemeBootstrap() {
  useEffect(() => {
    const apply = () => applyTheme(readThemePreferences());
    apply();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  return null;
}
