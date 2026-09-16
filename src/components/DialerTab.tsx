import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import { Check, Delete, Layers, Phone, ShieldAlert, ShieldCheck, User, UserPlus, X, Sparkles } from 'lucide-react';
import { ContactItem, CallLogItem, TruecallerDirectoryProfile, ShieldSettings } from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';

interface DialerTabProps {
  contacts: ContactItem[];
  recentCalls: CallLogItem[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => TruecallerDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  onOpenCallerDetail: (item: CallLogItem | TruecallerDirectoryProfile) => void;
  onSaveContact: (number: string, name?: string) => void;
  selectedSim: 'SIM 1 (Personal)' | 'SIM 2 (Work)';
  onChangeSim: (sim: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  initialNumber?: string;
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
  lookupProfile,
  onInitiateCall,
  onOpenCallerDetail,
  onSaveContact,
  selectedSim,
  onChangeSim,
  initialNumber,
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

  const callWithSim = (sim: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => {
    if (!value.trim()) return;
    onChangeSim(sim);
    onInitiateCall(value.trim(), matchedContact?.name || profile?.name || undefined, sim);
  };

  const call = () => {
    if (value.trim()) {
      onInitiateCall(value.trim(), matchedContact?.name || profile?.name || undefined, selectedSim);
    }
  };

  const isSim1 = selectedSim.includes('SIM 1');

  // Quick fallback chips when no search query has been typed yet
  const defaultSuggestions = useMemo(() => {
    return contacts.filter((c) => c.isFavorite).slice(0, 3);
  }, [contacts]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-3 pb-6 pt-1 sm:px-4 select-none">
      {/* Top Header & Selected SIM Pill */}
      <div className="mb-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{t('nav_phone')}</p>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('dialer_keypad')}</h1>
        </div>

        {/* Selected SIM Selector Button */}
        <button
          type="button"
          onClick={() => setShowSimPicker(true)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            isSim1
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
          }`}
          title={t('call_using')}
        >
          <Layers className="h-3 w-3" />
          <span>{isSim1 ? t('sim_1') : t('sim_2')}</span>
        </button>
      </div>

      {/* Dual SIM Switcher Strip */}
      <div className="mb-2 flex items-center rounded-xl border border-white/10 bg-[#0e141b] p-1 text-xs">
        <button
          type="button"
          onClick={() => onChangeSim('SIM 1 (Personal)')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            isSim1 ? 'bg-emerald-500/20 text-emerald-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isSim1 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span>{t('sim_1')}</span>
        </button>
        <button
          type="button"
          onClick={() => onChangeSim('SIM 2 (Work)')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
            !isSim1 ? 'bg-blue-500/20 text-blue-300 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${!isSim1 ? 'bg-blue-400' : 'bg-slate-600'}`} />
          <span>{t('sim_2')}</span>
        </button>
      </div>

      {/* Fixed-Height T9 Matches Strip (h-9) - Never shifts the keypad layout below */}
      <div className="mb-2 flex h-9 items-center gap-1.5 overflow-x-auto no-scrollbar">
        {results.matchingContacts.length > 0 || results.matchingRecents.length > 0 || results.possibleCaller ? (
          <>
            {results.matchingContacts.slice(0, 3).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setValue(c.number)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 border border-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
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
                className="shrink-0 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 transition"
              >
                {r.callerName || formatPhoneNumber(r.number)}
              </button>
            ))}
            {results.possibleCaller && (
              <button
                type="button"
                onClick={() => onOpenCallerDetail(results.possibleCaller!)}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
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
                className="shrink-0 rounded-lg bg-white/5 border border-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {c.name}
              </button>
            ))}
          </>
        ) : (
          <div className="flex items-center px-1 text-[11px] text-slate-600">
            <span>{t('smart_dialer_ready')}</span>
          </div>
        )}
      </div>

      {/* STRICT FIXED-HEIGHT Hero Display Card (h-[102px]) - Never expands or shrinks */}
      <div
        id="dialer-display-card"
        onClick={() => inputRef.current?.focus()}
        onPaste={handlePaste}
        className="mb-3.5 flex h-[102px] flex-col justify-center rounded-2xl border border-white/10 bg-[#0e141c] px-3 py-1 shadow-lg shadow-black/20 transition-colors focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20"
      >
        {/* Row 1: Fixed-Height Number Input (h-11) */}
        <div className="relative flex h-11 items-center justify-center">
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
            className="w-full bg-transparent px-8 text-center text-2xl sm:text-[28px] font-normal tracking-wide text-white outline-none placeholder:text-sm placeholder:font-normal placeholder:text-slate-600 selection:bg-emerald-500/30"
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
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Row 2: Fixed-Height Formatted Preview / Sub-line (h-4) */}
        <div className="flex h-4 items-center justify-center text-[10.5px] font-mono text-slate-400 overflow-hidden">
          {value && !/[a-zA-Z]/.test(value) ? (
            <span>{formatPhoneNumber(value)}</span>
          ) : (
            <span className="invisible select-none">&nbsp;</span>
          )}
        </div>

        {/* Row 3: Fixed-Height Caller ID & Action Line (h-6) */}
        <div className="flex h-6 items-center justify-center overflow-hidden">
          {matchedContact ? (
            <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400 truncate">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{matchedContact.name}</span>
            </div>
          ) : profile?.name && profile.name !== value ? (
            <div className="flex items-center justify-center gap-1.5 text-xs truncate">
              <span className={`font-semibold truncate max-w-[150px] ${profile.isSpam ? 'text-rose-400' : 'text-slate-200'}`}>
                {profile.name}
              </span>
              {profile.isSpam ? (
                <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                  {t('spam_badge')}
                </span>
              ) : (
                <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                  {t('safe_badge')}
                </span>
              )}
            </div>
          ) : digits.length >= 3 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSaveContact(value, profile?.name);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300 transition"
            >
              <UserPlus className="h-3 w-3 text-emerald-400" />
              <span>{t('add_to_contacts')}</span>
            </button>
          ) : (
            <span className="text-[10px] font-medium text-slate-500 select-none">
              {t('enter_number_to_call')}
            </span>
          )}
        </div>
      </div>

      {/* STRICTLY ANCHORED Keypad Grid: 3 columns, stationary coordinates */}
      <div className="mx-auto w-full max-w-[270px] sm:max-w-[290px] shrink-0">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {KEYPAD.map(([digit, letters]) => (
            <button
              type="button"
              key={digit}
              onClick={() => press(digit)}
              className="mx-auto flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full bg-[#151c24] ring-1 ring-white/5 transition hover:bg-[#1a232e] active:scale-95 sm:h-[58px] sm:w-[58px] shrink-0"
            >
              <span className="text-xl font-normal leading-none text-white sm:text-2xl">{digit}</span>
              {letters && (
                <span className="-mt-0.5 text-[8px] font-medium tracking-[.18em] text-slate-400 sm:text-[9px]">
                  {letters}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Fixed 5th Row:
            Col 1: SIM 2 Quick Call
            Col 2: Primary Call button with active SIM
            Col 3: Backspace / Delete button
        */}
        <div className="mt-3 grid grid-cols-3 items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Column 1: Call using SIM 2 */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => callWithSim('SIM 2 (Work)')}
              disabled={!value.trim()}
              className={`flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full border transition active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:h-[50px] sm:w-[50px] shrink-0 ${
                !isSim1
                  ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
              title={`${t('call_action')} - ${t('sim_2')}`}
              aria-label={`${t('call_action')} - ${t('sim_2')}`}
            >
              <Phone className="h-3.5 w-3.5 fill-current" />
              <span className="mt-0.5 text-[8px] font-bold leading-none">SIM 2</span>
            </button>
          </div>

          {/* Column 2 (Center): Primary Call Button with Active SIM */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={call}
              disabled={!value.trim()}
              className="flex h-[56px] w-[56px] flex-col items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition active:scale-95 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none sm:h-[60px] sm:w-[60px] shrink-0"
              aria-label={`${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})`}
            >
              <Phone className="h-5 w-5 fill-current" />
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
                className="grid h-[46px] w-[46px] place-items-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-white active:scale-95 sm:h-[50px] sm:w-[50px] shrink-0"
                aria-label="Delete"
                title="Backspace (Hold to clear all)"
              >
                <Delete className="h-5 w-5" />
              </button>
            ) : (
              <div className="h-[46px] w-[46px] sm:h-[50px] sm:w-[50px] shrink-0" />
            )}
          </div>
        </div>

        {/* Protection Footer Note */}
        <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
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
