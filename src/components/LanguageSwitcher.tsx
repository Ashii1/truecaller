import { Globe } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface LanguageSwitcherProps {
  variant?: 'header' | 'settings';
}

export default function LanguageSwitcher({ variant = 'header' }: LanguageSwitcherProps) {
  const { language, setLanguage, toggleLanguage, isTamil } = useI18n();

  if (variant === 'settings') {
    return (
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">
              {isTamil ? 'செயலி மொழி (Language)' : 'App Language / மொழி'}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              {isTamil
                ? 'முழு செயலியையும் ஆங்கிலம் அல்லது தமிழில் பயன்படுத்தலாம்.'
                : 'Choose between English and தமிழ் (Tamil) for the entire app.'}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                  language === 'en'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>🇬🇧</span>
                <span>English</span>
              </button>

              <button
                type="button"
                onClick={() => setLanguage('ta')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                  language === 'ta'
                    ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>🇮🇳</span>
                <span>தமிழ் (Tamil)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      title={isTamil ? 'Switch to English' : 'தமிழுக்கு மாறவும்'}
      className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 active:scale-95"
      aria-label="Toggle language between English and Tamil"
    >
      <Globe className="h-3.5 w-3.5 text-blue-400" />
      <span className="text-[11px] uppercase tracking-wider font-semibold">
        {isTamil ? (
          <span className="text-blue-300">தமிழ்</span>
        ) : (
          <span className="text-slate-300">EN</span>
        )}
      </span>
      <span className="text-[10px] text-slate-500">|</span>
      <span className="text-[10px] text-slate-400">
        {isTamil ? 'EN' : 'தமிழ்'}
      </span>
    </button>
  );
}
