import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Moon, Palette, RotateCcw, Sun, Sparkles, Type } from 'lucide-react';
import {
  ACCENT_COLORS,
  AppThemePreferences,
  DEFAULT_THEME,
  persistAndApplyTheme,
  readThemePreferences,
  resolveAccent,
} from '../services/theme/themeService';
import { useI18n } from '../i18n/LanguageContext';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCENTS = Object.keys(ACCENT_COLORS) as Array<keyof typeof ACCENT_COLORS>;

export default function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<AppThemePreferences>(readThemePreferences);

  useEffect(() => {
    if (isOpen) setTheme(readThemePreferences());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    persistAndApplyTheme(theme);
  }, [theme, isOpen]);

  const accent = useMemo(() => resolveAccent(theme), [theme]);
  if (!isOpen) return null;

  const update = <K extends keyof AppThemePreferences>(key: K, value: AppThemePreferences[K]) => {
    setTheme(previous => ({ ...previous, [key]: value }));
  };

  const reset = () => {
    setTheme(DEFAULT_THEME);
    persistAndApplyTheme(DEFAULT_THEME);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t('appearance_title')}>
      <section className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-400"><Palette className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-extrabold text-white">{t('appearance_title')}</h2>
              <p className="text-xs text-slate-400">{t('appearance_desc')}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95" aria-label="Back" title="Back"><ArrowLeft className="h-5 w-5" /><span className="text-xs font-semibold">Back</span></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <Section title={t('appearance_theme_title')} icon={<Moon className="h-4 w-4" />}>
            <div className="grid grid-cols-3 gap-2">
              <Choice active={theme.mode === 'SYSTEM'} onClick={() => update('mode', 'SYSTEM')}><Sparkles className="h-4 w-4" />{t('theme_system')}</Choice>
              <Choice active={theme.mode === 'LIGHT'} onClick={() => update('mode', 'LIGHT')}><Sun className="h-4 w-4" />{t('theme_light')}</Choice>
              <Choice active={theme.mode === 'DARK'} onClick={() => update('mode', 'DARK')}><Moon className="h-4 w-4" />{t('theme_dark')}</Choice>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{t('theme_system_description')}</p>
          </Section>

          <Section title={t('accent_colour_title')} icon={<Palette className="h-4 w-4" />}>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ACCENTS.map(name => <button key={name} type="button" onClick={() => update('accent', name)} className="group flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-2.5" aria-label={`${name.toLowerCase()} accent`}>
                <span className="grid h-8 w-8 place-items-center rounded-full" style={{ backgroundColor: ACCENT_COLORS[name] }}>{theme.accent === name && <Check className="h-4 w-4 text-white" />}</span>
                <span className="text-[10px] font-semibold text-slate-400">{name[0] + name.slice(1).toLowerCase()}</span>
              </button>)}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
              <input type="color" value={accent} onChange={e => { update('accent', 'CUSTOM'); update('customAccent', e.target.value); }} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Custom accent colour" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">{t('custom_colour_title')}</div>
                <div className="text-[10px] text-slate-500">{t('custom_colour_desc')}</div>
              </div>
              <span className="font-mono text-[11px] text-slate-400">{accent.toUpperCase()}</span>
            </div>
          </Section>

          <Section title={t('interface_settings_title')} icon={<Sparkles className="h-4 w-4" />}>
            <div className="space-y-3">
              <SelectRow label={t('information_density')} description={t('density_spacing_desc')} value={theme.density} options={[['COMPACT', t('density_compact')], ['COMFORTABLE', t('density_comfortable')], ['SPACIOUS', t('density_spacious')]]} onChange={value => update('density', value as AppThemePreferences['density'])} />
              <SelectRow label={t('corner_style_title')} description={t('corner_style_description')} value={theme.cornerStyle} options={[['SHARP', t('corner_sharp')], ['SOFT', t('corner_soft')], ['ROUND', t('corner_round')]]} onChange={value => update('cornerStyle', value as AppThemePreferences['cornerStyle'])} />
              <SelectRow label={t('background_style_title')} description={t('background_style_description')} value={theme.background} options={[['SOLID', t('bg_solid')], ['GRADIENT', t('bg_gradient')], ['MIDNIGHT', t('bg_midnight')], ['AURORA', t('bg_aurora')]]} onChange={value => update('background', value as AppThemePreferences['background'])} />
            </div>
          </Section>

          <Section title={t('text_accessibility_title')} icon={<Type className="h-4 w-4" />}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{t('text_size_title')}</div>
                  <div className="text-[10px] text-slate-500">{t('text_size_description')}</div>
                </div>
                <span className="text-xs font-bold text-white">{Math.round(theme.fontScale * 100)}%</span>
              </div>
              <input type="range" min="90" max="115" step="5" value={Math.round(theme.fontScale * 100)} onChange={e => update('fontScale', Number(e.target.value) / 100)} className="mt-3 w-full accent-[var(--vs-accent)]" aria-label="Text size" />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>90%</span><span>100%</span><span>115%</span></div>
            </div>
            <Toggle label={t('high_contrast_title')} description={t('high_contrast_description')} checked={theme.highContrast} onChange={value => update('highContrast', value)} />
            <Toggle label={t('reduce_motion_title')} description={t('reduce_motion_description')} checked={theme.reduceMotion} onChange={value => update('reduceMotion', value)} />
            <Toggle label={t('show_nav_labels_title')} description={t('show_nav_labels_description')} checked={theme.showNavigationLabels} onChange={value => update('showNavigationLabels', value)} />
          </Section>

          <button onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> {t('reset_appearance_button')}</button>
        </div>
      </section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="space-y-3"><div className="flex items-center gap-2 text-white"><span className="text-blue-400">{icon}</span><h3 className="text-sm font-bold">{title}</h3></div>{children}</section>;
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition ${active ? 'border-blue-500/50 bg-blue-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}>{children}</button>;
}

function SelectRow({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: Array<[string,string]>; onChange: (value: string) => void }) {
  return <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></div><select value={value} onChange={e => onChange(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white outline-none" style={{ colorScheme: 'dark' }}>{options.map(([id, name]) => <option key={id} value={id} className="bg-slate-900 text-white">{name}</option>)}</select></label>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></div>;
}
