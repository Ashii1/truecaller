import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent } from 'react';
import {
  Check,
  Delete,
  EyeOff,
  Layers,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X,
  Sparkles,
} from 'lucide-react';
import { ContactItem, CallLogItem, CallShieldDirectoryProfile, ShieldSettings, DisplayDensity } from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
import { playDtmfTone } from '../utils/dtmfTones';
import { telecomBridge } from '../services/telephony/telecomBridge';

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

const KEYPAD_KEYS = [
  { digit: '1', sub: '⚲' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: ',' },
  { digit: '0', sub: '+' },
  { digit: '#', sub: ';' },
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
  const longPressTimerRef = useRef<number | null>(null);
  const deleteIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialNumber) setValue(initialNumber);
  }, [initialNumber]);

  const handlePaste = (e: ReactClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (text) {
      e.preventDefault();
      const sanitized = sanitizePastedText(text);
      if (sanitized) setValue(sanitized);
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
    [value, contacts, recentCalls, lookupProfile]
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

  const handleKeyPress = (digit: string) => {
    playDtmfTone(digit);
    telecomBridge.vibratePhone(20);
    setValue((v) => v + digit);
  };

  const handleKeyDown = (digit: string) => {
    if (digit === '0') {
      longPressTimerRef.current = window.setTimeout(() => {
        playDtmfTone('0');
        telecomBridge.vibratePhone(35);
        setValue((v) => v.slice(0, -1) + '+');
        longPressTimerRef.current = null;
      }, 500);
    } else if (digit === '1' && !value) {
      longPressTimerRef.current = window.setTimeout(() => {
        // Voicemail shortcut
        onInitiateCall('*86', 'Voicemail', selectedSim);
        longPressTimerRef.current = null;
      }, 700);
    }
  };

  const handleKeyUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const startContinuousDelete = () => {
    telecomBridge.vibratePhone(25);
    setValue((v) => v.slice(0, -1));
    deleteIntervalRef.current = window.setInterval(() => {
      setValue((v) => {
        if (!v) {
          if (deleteIntervalRef.current) clearInterval(deleteIntervalRef.current);
          return '';
        }
        return v.slice(0, -1);
      });
    }, 120);
  };

  const stopContinuousDelete = () => {
    if (deleteIntervalRef.current) {
      clearInterval(deleteIntervalRef.current);
      deleteIntervalRef.current = null;
    }
  };

  const call = (isPrivate = false) => {
    if (value.trim()) {
      onInitiateCall(value.trim(), matchedContact?.name || profile?.name || undefined, selectedSim, isPrivate);
    } else if (recentCalls && recentCalls.length > 0) {
      // Native phone dialer feature: recall last dialed/received number when dialer is blank
      const lastCall = recentCalls[0];
      if (lastCall?.number) {
        setValue(lastCall.number);
        telecomBridge.vibratePhone(30);
      }
    }
  };

  const isSim1 = selectedSim.includes('SIM 1');
  const isCompact = density === 'compact';

  const defaultSuggestions = useMemo(() => {
    const favs = contacts.filter((c) => c.isFavorite).slice(0, 3);
    if (favs.length > 0) return favs;
    return contacts.slice(0, 3);
  }, [contacts]);

  // Dynamic font sizing based on length of dialed number
  const numberFontSizeClass = useMemo(() => {
    const len = value.length;
    if (isCompact) {
      if (len > 16) return 'text-base sm:text-lg';
      if (len > 12) return 'text-lg sm:text-xl';
      return 'text-xl sm:text-2xl';
    }
    if (len > 16) return 'text-lg sm:text-xl';
    if (len > 12) return 'text-xl sm:text-2xl';
    return 'text-2xl sm:text-[30px]';
  }, [value.length, isCompact]);

  return (
    <div className={`mx-auto flex w-full max-w-md flex-col select-none transition-all ${isCompact ? 'px-2 pb-4 pt-0.5 sm:px-3' : 'px-3.5 pb-6 pt-1 sm:px-4'}`}>
      {/* Top Header Bar with Dual-SIM pill */}
      <div className={`flex items-center justify-between transition-all ${isCompact ? 'mb-1.5' : 'mb-2.5'}`}>
        <div>
          <h1 className={`font-black tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>
            {t('dialer_keypad')}
          </h1>
        </div>

        {/* Quick SIM Active Line Badge Pill */}
        <button
          type="button"
          onClick={() => setShowSimPicker(true)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-bold text-xs transition active:scale-95 ${
            isSim1
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
              : 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
          }`}
          title={t('choose_line')}
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="text-[11px] font-bold">{isSim1 ? 'SIM 1' : 'SIM 2'}</span>
        </button>
      </div>

      {/* T9 Smart Suggestions Horizontal Strip */}
      <div className={`flex items-center overflow-x-auto no-scrollbar transition-all ${isCompact ? 'mb-1.5 h-8 gap-1.5' : 'mb-2.5 h-9 gap-2'}`}>
        {results.matchingContacts.length > 0 || results.matchingRecents.length > 0 || results.possibleCaller ? (
          <>
            {results.matchingContacts.slice(0, 3).map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setValue(c.number)}
                className={`flex shrink-0 items-center rounded-xl bg-white/10 border border-white/15 font-semibold text-white hover:bg-white/20 transition active:scale-95 ${
                  isCompact ? 'gap-1 px-2.5 py-1 text-[11px]' : 'gap-1.5 px-3 py-1 text-xs'
                }`}
              >
                <div className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-black">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate max-w-[110px]">{c.name}</span>
              </button>
            ))}
            {results.matchingRecents.slice(0, 2).map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setValue(r.number)}
                className={`shrink-0 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/15 hover:text-white transition active:scale-95 ${
                  isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs'
                }`}
              >
                {r.callerName || formatPhoneNumber(r.number)}
              </button>
            ))}
            {results.possibleCaller && (
              <button
                type="button"
                onClick={() => onOpenCallerDetail(results.possibleCaller!)}
                className={`flex shrink-0 items-center rounded-xl border font-semibold transition active:scale-95 ${
                  results.possibleCaller.isSpam
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                } ${isCompact ? 'gap-1 px-2.5 py-1 text-[11px]' : 'gap-1.5 px-3 py-1 text-xs'}`}
              >
                {results.possibleCaller.isSpam ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                )}
                <span className="truncate max-w-[120px]">{results.possibleCaller.name}</span>
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
                className={`flex shrink-0 items-center gap-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/15 hover:text-white transition active:scale-95 ${
                  isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs'
                }`}
              >
                <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-slate-700 text-[8px] font-bold">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span>{c.name}</span>
              </button>
            ))}
          </>
        ) : null}
      </div>

      {/* Sleek Minimalist Number Display Card - Compact Single View without Duplication */}
      <div
        id="dialer-display-card"
        onClick={() => inputRef.current?.focus()}
        onPaste={handlePaste}
        className={`relative flex flex-col justify-center rounded-2xl border border-white/[0.08] bg-slate-900/70 shadow-lg shadow-black/20 transition-all focus-within:border-emerald-500/40 backdrop-blur-md ${
          isCompact ? 'mb-2 min-h-[58px] px-3 py-1.5' : 'mb-3 min-h-[66px] px-4 py-2'
        }`}
      >
        {/* Main Number Row */}
        <div className="relative flex items-center justify-center">
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
            className={`w-full bg-transparent px-8 text-center font-semibold tracking-wide text-white outline-none selection:bg-emerald-500/30 transition-all ${numberFontSizeClass} placeholder:text-slate-500 placeholder:font-normal`}
          />
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setValue('');
                inputRef.current?.focus();
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              aria-label={t('clear_input')}
              title={t('clear_input')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Dynamic Caller Identification or Contact Quick Add (Only if relevant; NO duplicate formatted number) */}
        {(matchedContact || ((profile?.isSpam || profile?.isVerified) && profile?.name && profile.name !== value) || digits.length >= 3) ? (
          <div className="flex items-center justify-center overflow-hidden transition-all text-xs mt-0.5">
            {matchedContact ? (
              <div className="flex items-center justify-center gap-1 font-bold text-emerald-400 truncate text-[11px]">
                <User className="h-3 w-3 shrink-0" />
                <span className="truncate">{matchedContact.name}</span>
              </div>
            ) : (profile?.isSpam || profile?.isVerified) && profile?.name && profile.name !== value ? (
              <div className="flex items-center justify-center gap-1.5 truncate text-[11px]">
                <span className={`font-bold truncate max-w-[170px] ${profile.isSpam ? 'text-rose-400' : 'text-slate-200'}`}>
                  {profile.name}
                </span>
                {profile.isSpam ? (
                  <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[8.5px] font-black uppercase text-rose-300">
                    {t('spam_badge')}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[8.5px] font-black uppercase text-emerald-300">
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
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95"
              >
                <UserPlus className="h-2.5 w-2.5" />
                <span>{t('add_to_contacts')}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Professional Frameless Keypad Grid - No Boxes, No Alphabets, Sleek & Compact */}
      <div className={`mx-auto w-full shrink-0 transition-all ${isCompact ? 'max-w-[270px]' : 'max-w-[290px]'}`}>
        <div className={`grid grid-cols-3 transition-all ${isCompact ? 'gap-x-4 gap-y-2' : 'gap-x-5 gap-y-2.5'}`}>
          {KEYPAD_KEYS.map((k) => (
            <button
              type="button"
              key={k.digit}
              onClick={() => handleKeyPress(k.digit)}
              onMouseDown={() => handleKeyDown(k.digit)}
              onMouseUp={handleKeyUp}
              onTouchStart={() => handleKeyDown(k.digit)}
              onTouchEnd={handleKeyUp}
              className={`group mx-auto flex flex-col items-center justify-center rounded-full bg-slate-900/60 hover:bg-slate-800/80 border border-white/[0.04] hover:border-white/[0.1] transition-all duration-150 active:bg-slate-700/80 active:ring-2 active:ring-emerald-400/25 active:scale-95 focus:outline-none shrink-0 shadow-sm ${
                isCompact
                  ? 'h-[50px] w-[50px] sm:h-[52px] sm:w-[52px]'
                  : 'h-[58px] w-[58px] sm:h-[62px] sm:w-[62px]'
              }`}
            >
              <span className={`font-semibold tracking-tight text-white transition-all ${isCompact ? 'text-[22px]' : 'text-[25px]'}`}>
                {k.digit}
              </span>
              {k.sub ? (
                <span className="text-[9px] font-bold text-slate-400 -mt-0.5 tracking-wider leading-none">
                  {k.sub}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* 5th Row: Action Controls (SIM Switcher, Sleek Call Button, Backspace) */}
        <div className={`grid grid-cols-3 items-center shrink-0 transition-all ${isCompact ? 'mt-2 gap-x-4' : 'mt-3 gap-x-5'}`}>
          {/* SIM Selector Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onChangeSim(isSim1 ? 'SIM 2 (Work)' : 'SIM 1 (Personal)')}
              className={`flex flex-col items-center justify-center rounded-full border transition-all active:scale-90 shrink-0 ${
                isCompact
                  ? 'h-[44px] w-[44px]'
                  : 'h-[48px] w-[48px]'
              } ${
                !isSim1
                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
              }`}
              title={isSim1 ? 'Switch to SIM 2' : 'Switch to SIM 1'}
              aria-label={isSim1 ? 'Switch to SIM 2' : 'Switch to SIM 1'}
            >
              <Layers className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className="mt-0.5 text-[8px] font-extrabold uppercase leading-none">
                {isSim1 ? 'SIM 1' : 'SIM 2'}
              </span>
            </button>
          </div>

          {/* Primary Call Button with Accent Glow */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => call()}
              className={`group flex items-center justify-center rounded-full text-white shadow-xl transition-all active:scale-95 shrink-0 ${
                isCompact
                  ? 'h-[52px] w-[52px]'
                  : 'h-[58px] w-[58px]'
              } ${
                isSim1
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/20'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 ring-2 ring-blue-400/20'
              }`}
              aria-label={`${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})`}
              title={value.trim() ? `${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})` : (recentCalls.length > 0 ? `Redial ${recentCalls[0].callerName || recentCalls[0].number}` : t('call_action'))}
            >
              <Phone className={`fill-current transition-transform group-hover:scale-110 ${isCompact ? 'h-5 w-5' : 'h-5.5 w-5.5'}`} />
            </button>
          </div>

          {/* Backspace Button with Tap & Hold Continuous Delete */}
          <div className="flex justify-center">
            {value ? (
              <button
                type="button"
                onMouseDown={startContinuousDelete}
                onMouseUp={stopContinuousDelete}
                onMouseLeave={stopContinuousDelete}
                onTouchStart={startContinuousDelete}
                onTouchEnd={stopContinuousDelete}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setValue('');
                }}
                className={`grid place-items-center rounded-full text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-90 shrink-0 ${
                  isCompact
                    ? 'h-[44px] w-[44px]'
                    : 'h-[48px] w-[48px]'
                }`}
                aria-label={t('delete')}
                title="Backspace (Hold to delete continuously)"
              >
                <Delete className={isCompact ? 'h-4 w-4' : 'h-4.5 w-4.5'} />
              </button>
            ) : (
              <div
                className={`shrink-0 ${
                  isCompact ? 'h-[44px] w-[44px]' : 'h-[48px] w-[48px]'
                }`}
              />
            )}
          </div>
        </div>

        {/* Masked / Private Call Quick Action Pill */}
        <div className={`flex items-center justify-center transition-all ${isCompact ? 'mt-2' : 'mt-3'}`}>
          <button
            type="button"
            onClick={() => call(true)}
            disabled={!value.trim()}
            className={`inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/60 font-semibold text-indigo-200 transition hover:bg-indigo-900/80 active:scale-95 disabled:pointer-events-none disabled:opacity-30 shadow-sm ${
              isCompact ? 'px-3 py-1 text-[10px]' : 'px-4 py-1.5 text-[11px]'
            }`}
            title={`Dial with ${settings?.privateCallPrefix || '*67'} Caller ID Masking`}
          >
            <EyeOff className="h-3.5 w-3.5 text-indigo-400" />
            <span>{t('private_call_masked')}</span>
          </button>
        </div>

        {/* Protection Footer Badge */}
        <div className={`flex items-center justify-center gap-1.5 text-slate-500 transition-all ${isCompact ? 'mt-2 text-[9.5px]' : 'mt-3 text-[10.5px]'}`}>
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>{t('protected_calls')}</span>
        </div>
      </div>

      {/* Dual-SIM Selection Modal */}
      {showSimPicker && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-slate-900 p-5 sm:rounded-3xl shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{t('choose_line')}</p>
                <h2 className="text-base font-bold text-white">{t('call_using')}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSimPicker(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
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
                className={`mb-2.5 flex w-full items-center justify-between rounded-2xl border p-3.5 text-left text-sm font-bold transition ${
                  selectedSim === sim
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`grid h-8 w-8 place-items-center rounded-xl ${sim.includes('SIM 1') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-bold">{sim.includes('SIM 1') ? t('sim_1') : t('sim_2')}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{sim.includes('SIM 1') ? 'Primary Line' : 'Business Line'}</span>
                  </div>
                </div>
                {selectedSim === sim && <Check className="h-5 w-5 text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default DialerTab;
