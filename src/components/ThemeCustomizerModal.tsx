import { useEffect, useMemo, useState } from 'react';
import { Check, Moon, Palette, RotateCcw, Sun, Sparkles, Type, X } from 'lucide-react';
import {
  ACCENT_COLORS,
  AppThemePreferences,
  DEFAULT_THEME,
  persistAndApplyTheme,
  readThemePreferences,
  resolveAccent,
} from '../services/theme/themeService';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCENTS = Object.keys(ACCENT_COLORS) as Array<keyof typeof ACCENT_COLORS>;

export default function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Appearance customization">
      <section className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-500/10 text-blue-400"><Palette className="h-5 w-5" /></div>
            <div><h2 className="text-lg font-extrabold text-white">Appearance</h2><p className="text-xs text-slate-400">Make CallShield feel like your phone.</p></div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close appearance settings"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <Section title="Theme" icon={<Moon className="h-4 w-4" />}>
            <div className="grid grid-cols-3 gap-2">
              <Choice active={theme.mode === 'SYSTEM'} onClick={() => update('mode', 'SYSTEM')}><Sparkles className="h-4 w-4" />System</Choice>
              <Choice active={theme.mode === 'LIGHT'} onClick={() => update('mode', 'LIGHT')}><Sun className="h-4 w-4" />Light</Choice>
              <Choice active={theme.mode === 'DARK'} onClick={() => update('mode', 'DARK')}><Moon className="h-4 w-4" />Dark</Choice>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">System follows the device appearance. Your selection is stored locally.</p>
          </Section>

          <Section title="Accent colour" icon={<Palette className="h-4 w-4" />}>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ACCENTS.map(name => <button key={name} type="button" onClick={() => update('accent', name)} className="group flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-2.5" aria-label={`${name.toLowerCase()} accent`}>
                <span className="grid h-8 w-8 place-items-center rounded-full" style={{ backgroundColor: ACCENT_COLORS[name] }}>{theme.accent === name && <Check className="h-4 w-4 text-white" />}</span>
                <span className="text-[10px] font-semibold text-slate-400">{name[0] + name.slice(1).toLowerCase()}</span>
              </button>)}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
              <input type="color" value={accent} onChange={e => { update('accent', 'CUSTOM'); update('customAccent', e.target.value); }} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Custom accent colour" />
              <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">Custom colour</div><div className="text-[10px] text-slate-500">Pick any 6-digit colour. Premium accent controls apply across the app.</div></div>
              <span className="font-mono text-[11px] text-slate-400">{accent.toUpperCase()}</span>
            </div>
          </Section>

          <Section title="Interface" icon={<Sparkles className="h-4 w-4" />}>
            <div className="space-y-3">
              <SelectRow label="Information density" description="Controls spacing throughout the interface." value={theme.density} options={[['COMPACT','Compact'],['COMFORTABLE','Comfortable'],['SPACIOUS','Spacious']]} onChange={value => update('density', value as AppThemePreferences['density'])} />
              <SelectRow label="Corner style" description="Choose the visual shape of cards and controls." value={theme.cornerStyle} options={[['SHARP','Sharp'],['SOFT','Soft'],['ROUND','Round']]} onChange={value => update('cornerStyle', value as AppThemePreferences['cornerStyle'])} />
              <SelectRow label="Background" description="Change the overall backdrop without changing call protection." value={theme.background} options={[['SOLID','Solid'],['GRADIENT','Gradient'],['MIDNIGHT','Midnight'],['AURORA','Aurora']]} onChange={value => update('background', value as AppThemePreferences['background'])} />
            </div>
          </Section>

          <Section title="Text & accessibility" icon={<Type className="h-4 w-4" />}>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between"><div><div className="text-xs font-semibold text-white">Text size</div><div className="text-[10px] text-slate-500">Fine tune readability without changing layout logic.</div></div><span className="text-xs font-bold text-white">{Math.round(theme.fontScale * 100)}%</span></div>
              <input type="range" min="90" max="115" step="5" value={Math.round(theme.fontScale * 100)} onChange={e => update('fontScale', Number(e.target.value) / 100)} className="mt-3 w-full accent-[var(--vs-accent)]" aria-label="Text size" />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>90%</span><span>100%</span><span>115%</span></div>
            </div>
            <Toggle label="High contrast" description="Increase text and border contrast for easier reading." checked={theme.highContrast} onChange={value => update('highContrast', value)} />
            <Toggle label="Reduce motion" description="Minimise non-essential transitions and animations." checked={theme.reduceMotion} onChange={value => update('reduceMotion', value)} />
            <Toggle label="Show navigation labels" description="Keep text labels under primary navigation icons." checked={theme.showNavigationLabels} onChange={value => update('showNavigationLabels', value)} />
          </Section>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs leading-5 text-slate-400">
            <div className="font-bold text-white">Customization is independent of protection.</div>
            <div className="mt-1">Changing colours, dark mode, density, fonts or backgrounds never changes your call-screening rules, contacts, call logs, emergency protections or privacy settings.</div>
          </div>
          <button onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-200 hover:bg-slate-800"><RotateCcw className="h-4 w-4" /> Reset appearance</button>
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
  return <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></div><select value={value} onChange={e => onChange(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-white outline-none">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-white">{label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{description}</div></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></button></div>;
}
