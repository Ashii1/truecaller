import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { Check, Delete, EyeOff, Layers, Phone, ShieldAlert, ShieldCheck, User, UserPlus, X, Sparkles } from 'lucide-react';
import { ContactItem, CallLogItem, CallShieldDirectoryProfile, ShieldSettings, DisplayDensity } from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';

interface DialerTabProps {
  contacts: ContactItem[];
  recentCalls: CallLogItem[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)', isPrivate?: boolean) => void;
  onOpenCallerDetail: (item: CallLogItem | CallShieldDirectoryProfile) => void;
  onSaveContact: (number: string, name?: string) => void;
  selectedSim: 'SIM 1 (Personal)' | 'SIM 2 (Work)';
  onChangeSim: (sim: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  initialNumber?: string;
  density?: DisplayDensity;
}

const KEYPAD = [
  ['1', ''],
  ['2', 'ABC'],
  ['3', 'DEF'],
  ['4', 'GHI'],
  ['5', 'JKL'],
  ['6', 'MNO'],
  ['7', 'PQRS'],
  ['8', 'TUV'],
  ['9', 'WXYZ'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

function sanitizePastedText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[\d\s()+\-*#.]+$/.test(trimmed)) {
    return trimmed.replace(/[^\d+*#]/g, '');
  }
  return trimmed;
}

const DialerTab = memo(function DialerTab({
  contacts,
  recentCalls,
  settings,
  lookupProfile,
  onInitiateCall,
  onOpenCallerDetail,
  onSaveContact,
  selectedSim,
  onChangeSim,
  initialNumber,
  density = 'comfortable',
}: DialerTabProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialNumber || '');
  const [showSimPicker, setShowSimPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialNumber) setValue(initialNumber);
  }, [initialNumber]);

  const handlePaste = (e: ReactClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (text) {
      e.preventDefault();
      const sanitized = sanitizePastedText(text);
      if (sanitized) {
        setValue(sanitized);
      }
    }
  };

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName) && activeEl.id !== 'dialer-number-input') {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text) {
        const sanitized = sanitizePastedText(text);
        if (sanitized) {
          e.preventDefault();
          setValue(sanitized);
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  const results = useMemo(
    () =>
      value.trim()
        ? smartDialerSearch(value, contacts, recentCalls, lookupProfile)
        : { matchingContacts: [], matchingRecents: [], possibleCaller: null },
    [value, contacts, recentCalls, lookupProfile],
  );

  const digits = value.replace(/\D/g, '');
  const matchedContact = useMemo(() => {
    if (!digits) return null;
    return (
      contacts.find((c) => {
        const n = c.number.replace(/\D/g, '');
        return n === digits || (digits.length >= 7 && n.length >= 7 && digits.endsWith(n));
      }) || null
    );
  }, [digits, contacts]);

  const profile = useMemo(() => (digits.length >= 4 ? lookupProfile(value) : null), [digits, value, lookupProfile]);

  const press = (d: string) => {
    setValue((v) => v + d);
  };

  const call = (isPrivate = false) => {
    if (value.trim()) {
      onInitiateCall(value.trim(), matchedContact?.name || profile?.name || undefined, selectedSim, isPrivate);
    }
  };

  const isSim1 = selectedSim.includes('SIM 1');

  // Quick fallback chips when no search query has been typed yet
  const defaultSuggestions = useMemo(() => {
    const favs = contacts.filter((c) => c.isFavorite).slice(0, 3);
    if (favs.length > 0) return favs;
    return contacts.slice(0, 3);
  }, [contacts]);

  const isCompact = density === 'compact';

  return (
    <div className={`mx-auto flex w-full max-w-md flex-col select-none transition-all ${isCompact ? 'px-2 pb-4 pt-0.5 sm:px-3' : 'px-3 pb-6 pt-1 sm:px-4'}`}>
      {/* Top Header */}
      <div className={`flex items-center justify-between transition-all ${isCompact ? 'mb-1.5' : 'mb-2.5'}`}>
        <div>
          <p className={`font-bold uppercase tracking-[.18em] text-slate-500 transition-all ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>{t('nav_phone')}</p>
          <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('dialer_keypad')}</h1>
        </div>
      </div>

      {/* Fixed-Height T9 Matches Strip - Never shifts the keypad layout below */}
      <div className={`flex items-center overflow-x-auto no-scrollbar transition-all ${isCompact ? 'mb-1.5 h-7.5 gap-1' : 'mb-2 h-9 gap-1.5'}`}>
        {results.matchingContacts.length > 0 || results.matchingRecents.length > 0 || results.possibleCaller ? (
          <>
            {results.matchingContacts.slice(0, 3).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setValue(c.number)}
                className={`flex shrink-0 items-center rounded-lg bg-white/10 border border-white/10 font-semibold text-white hover:bg-white/20 transition ${
                  isCompact ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1 px-2.5 py-1 text-xs'
                }`}
              >
                <User className="h-3 w-3 text-emerald-400" />
                <span>{c.name}</span>
              </button>
            ))}
            {results.matchingRecents.slice(0, 2).map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setValue(r.number)}
                className={`shrink-0 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 transition ${
                  isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
                }`}
              >
                {r.callerName || formatPhoneNumber(r.number)}
              </button>
            ))}
            {results.possibleCaller && (
              <button
                type="button"
                onClick={() => onOpenCallerDetail(results.possibleCaller!)}
                className={`flex shrink-0 items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-semibold text-emerald-300 hover:bg-emerald-500/20 transition ${
                  isCompact ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1 px-2.5 py-1 text-xs'
                }`}
              >
                {results.possibleCaller.isSpam ? (
                  <ShieldAlert className="h-3 w-3 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                )}
                <span>{results.possibleCaller.name}</span>
              </button>
            )}
          </>
        ) : defaultSuggestions.length > 0 ? (
          <>
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-1">
              <Sparkles className="h-3 w-3 text-emerald-400/80" />
              <span>{t('cat_favorites')}:</span>
            </span>
            {defaultSuggestions.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setValue(c.number)}
                className={`shrink-0 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition ${
                  isCompact ? 'px-2 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
                }`}
              >
                {c.name}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {/* STRICT FIXED-HEIGHT Hero Display Card - Never expands or shrinks */}
      <div
        id="dialer-display-card"
        onClick={() => inputRef.current?.focus()}
        onPaste={handlePaste}
        className={`flex flex-col justify-center rounded-2xl border border-white/10 bg-[#0e141c] shadow-lg shadow-black/20 transition-all focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 ${
          isCompact ? 'mb-2 h-[84px] px-2.5 py-0.5' : 'mb-3.5 h-[102px] px-3 py-1'
        }`}
      >
        {/* Row 1: Fixed-Height Number Input */}
        <div className={`relative flex items-center justify-center transition-all ${isCompact ? 'h-9' : 'h-11'}`}>
          <input
            ref={inputRef}
            id="dialer-number-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter') call();
            }}
            inputMode="tel"
            autoComplete="off"
            placeholder={t('dialer_name_or_number')}
            className={`w-full bg-transparent px-8 text-center font-normal tracking-wide text-white outline-none selection:bg-emerald-500/30 transition-all ${
              isCompact
                ? 'text-xl sm:text-2xl placeholder:text-xs'
                : 'text-2xl sm:text-[28px] placeholder:text-sm'
            }`}
          />
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setValue('');
                inputRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-500 hover:bg-white/10 hover:text-white transition"
              aria-label="Clear"
              title="Clear"
            >
              <X className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
            </button>
          ) : null}
        </div>

        {/* Row 2: Fixed-Height Formatted Preview / Sub-line */}
        <div className={`flex items-center justify-center font-mono text-slate-400 overflow-hidden transition-all ${isCompact ? 'h-3 text-[9.5px]' : 'h-4 text-[10.5px]'}`}>
          {value && !/[a-zA-Z]/.test(value) ? (
            <span>{formatPhoneNumber(value)}</span>
          ) : (
            <span className="invisible select-none">&nbsp;</span>
          )}
        </div>

        {/* Row 3: Fixed-Height Caller ID & Action Line */}
        <div className={`flex items-center justify-center overflow-hidden transition-all ${isCompact ? 'h-5 text-[11px]' : 'h-6 text-xs'}`}>
          {matchedContact ? (
            <div className={`flex items-center justify-center gap-1 font-semibold text-emerald-400 truncate ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
              <User className={`shrink-0 ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
              <span className="truncate">{matchedContact.name}</span>
            </div>
          ) : (profile?.isSpam || profile?.isVerified) && profile?.name && profile.name !== value && profile.name !== formatPhoneNumber(value) ? (
            <div className={`flex items-center justify-center gap-1.5 truncate ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
              <span className={`font-semibold truncate max-w-[150px] ${profile.isSpam ? 'text-rose-400' : 'text-slate-200'}`}>
                {profile.name}
              </span>
              {profile.isSpam ? (
                <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-300">
                  {t('spam_badge')}
                </span>
              ) : (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[8.5px] font-bold text-emerald-300">
                  {t('safe_badge')}
                </span>
              )}
            </div>
          ) : digits.length >= 3 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSaveContact(value);
              }}
              className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 font-semibold text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 transition ${
                isCompact ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-0.5 text-[10px]'
              }`}
            >
              <UserPlus className="h-3 w-3 text-emerald-400" />
              <span>{t('add_to_contacts')}</span>
            </button>
          ) : (
            <span className={`font-medium text-slate-500 select-none ${isCompact ? 'text-[9.5px]' : 'text-[10px]'}`}>
              {t('enter_number_to_call')}
            </span>
          )}
        </div>
      </div>

      {/* STRICTLY ANCHORED Keypad Grid: 3 columns, stationary coordinates */}
      <div className={`mx-auto w-full shrink-0 transition-all ${isCompact ? 'max-w-[270px] sm:max-w-[285px]' : 'max-w-[300px] sm:max-w-[315px]'}`}>
        <div className={`grid grid-cols-3 transition-all ${isCompact ? 'gap-1.5 sm:gap-2' : 'gap-2.5 sm:gap-3'}`}>
          {KEYPAD.map(([digit, letters]) => (
            <button
              type="button"
              key={digit}
              onClick={() => press(digit)}
              className={`mx-auto flex flex-col items-center justify-center rounded-full border border-white/[0.08] bg-gradient-to-b from-[#1b2530] to-[#10161d] shadow-[0_5px_14px_rgba(0,0,0,0.35)] ring-1 ring-black/20 transition hover:from-[#202c38] hover:to-[#141c25] active:scale-90 shrink-0 ${
                isCompact
                  ? 'h-[52px] w-[52px] sm:h-[56px] sm:w-[56px]'
                  : 'h-[60px] w-[60px] sm:h-[64px] sm:w-[64px]'
              }`}
            >
              <span className={`font-normal leading-none text-white transition-all ${isCompact ? 'text-xl sm:text-[22px]' : 'text-[22px] sm:text-[24px]'}`}>{digit}</span>
              {letters && (
                <span className={`-mt-0.5 font-medium tracking-[.18em] text-slate-400 transition-all ${isCompact ? 'text-[7.5px]' : 'text-[8px] sm:text-[9px]'}`}>
                  {letters}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Fixed 5th Row:
            Col 1: Quick SIM toggle button (No phone icon)
            Col 2: Single Primary Call button (Adapts dynamically to SIM 1 / SIM 2)
            Col 3: Backspace / Delete button
        */}
        <div className={`grid grid-cols-3 items-center shrink-0 transition-all ${isCompact ? 'mt-2 gap-1.5 sm:gap-2' : 'mt-3 gap-2.5 sm:gap-3'}`}>
          {/* Column 1: Quick SIM Toggle Button (No call icon) */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onChangeSim(isSim1 ? 'SIM 2 (Work)' : 'SIM 1 (Personal)')}
              className={`flex flex-col items-center justify-center rounded-full border transition active:scale-95 shrink-0 ${
                isCompact
                  ? 'h-[40px] w-[40px] sm:h-[42px] sm:w-[42px]'
                  : 'h-[46px] w-[46px] sm:h-[50px] sm:w-[50px]'
              } ${
                !isSim1
                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              }`}
              title={`Switch line to ${isSim1 ? 'SIM 2' : 'SIM 1'}`}
              aria-label={`Switch line to ${isSim1 ? 'SIM 2' : 'SIM 1'}`}
            >
              <Layers className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className="mt-0.5 text-[8px] font-bold leading-none">
                {isSim1 ? 'SIM 1' : 'SIM 2'}
              </span>
            </button>
          </div>

          {/* Column 2 (Center): Single Primary Call Button with Active SIM styling */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => call()}
              disabled={!value.trim()}
              className={`flex flex-col items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none shrink-0 ${
                isCompact
                  ? 'h-[48px] w-[48px] sm:h-[50px] sm:w-[50px]'
                  : 'h-[56px] w-[56px] sm:h-[60px] sm:w-[60px]'
              } ${
                isSim1
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
              }`}
              aria-label={`${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})`}
            >
              <Phone className={`fill-current ${isCompact ? 'h-4 w-4' : 'h-5 w-5'}`} />
              <span className="mt-0.5 text-[8px] font-extrabold uppercase leading-none tracking-wider">
                {isSim1 ? 'SIM 1' : 'SIM 2'}
              </span>
            </button>
          </div>

          {/* Column 3: Backspace Button */}
          <div className="flex justify-center">
            {value ? (
              <button
                type="button"
                onClick={() => setValue((v) => v.slice(0, -1))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setValue('');
                }}
                className={`grid place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white active:scale-95 shrink-0 ${
                  isCompact
                    ? 'h-[40px] w-[40px] sm:h-[42px] sm:w-[42px]'
                    : 'h-[46px] w-[46px] sm:h-[50px] sm:w-[50px]'
                }`}
                aria-label="Delete"
                title="Backspace (Hold to clear all)"
              >
                <Delete className={isCompact ? 'h-4 w-4' : 'h-5 w-5'} />
              </button>
            ) : (
              <div className={`shrink-0 ${
                isCompact
                  ? 'h-[40px] w-[40px] sm:h-[42px] sm:w-[42px]'
                  : 'h-[46px] w-[46px] sm:h-[50px] sm:w-[50px]'
              }`} />
            )}
          </div>
        </div>

        {/* 1-Tap Private / Masked Callback Quick Action */}
        <div className={`flex items-center justify-center transition-all ${isCompact ? 'mt-2' : 'mt-2.5'}`}>
          <button
            type="button"
            onClick={() => call(true)}
            disabled={!value.trim()}
            className={`inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/50 font-semibold text-indigo-200 transition hover:bg-indigo-900/70 active:scale-95 disabled:pointer-events-none disabled:opacity-30 shadow-sm ${
              isCompact ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'
            }`}
            title={`Dial with ${settings?.privateCallPrefix || '*67'} Caller ID Suppression`}
          >
            <EyeOff className="h-3.5 w-3.5 text-indigo-400" />
            <span>Private Call ({settings?.privateCallPrefix || '*67'} Masked)</span>
          </button>
        </div>

        {/* Protection Footer Note */}
        <div className={`flex items-center justify-center gap-1.5 text-slate-500 transition-all ${isCompact ? 'mt-2 text-[9px]' : 'mt-3.5 text-[10px]'}`}>
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>{t('protected_calls')}</span>
        </div>
      </div>

      {/* SIM Selector Modal */}
      {showSimPicker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#10161d] p-4 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-500">{t('choose_line')}</p>
                <h2 className="text-base font-bold text-white">{t('call_using')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSimPicker(false)}
                className="rounded-full p-1.5 text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {(['SIM 1 (Personal)', 'SIM 2 (Work)'] as const).map((sim) => (
              <button
                type="button"
                key={sim}
                onClick={() => {
                  onChangeSim(sim);
                  setShowSimPicker(false);
                }}
                className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm text-white transition hover:bg-white/10"
              >
                <span className="font-semibold">{sim.includes('SIM 1') ? t('sim_1') : t('sim_2')}</span>
                {selectedSim === sim && <Check className="h-4 w-4 text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default DialerTab;
