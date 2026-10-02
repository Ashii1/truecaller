import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Delete,
  Grid3x3,
  Layers,
  Phone,
  PhoneMissed,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  UserPlus,
  Voicemail,
  X,
} from 'lucide-react';
import { ContactItem, CallLogItem, CallShieldDirectoryProfile, ShieldSettings, DisplayDensity } from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { isGenericOrPhoneNumber, PUBLIC_DIRECTORY_DATABASE } from '../utils/publicDirectory';
import { useI18n } from '../i18n/LanguageContext';
import { playDtmfTone } from '../utils/dtmfTones';
import { triggerHapticFeedback } from '../utils/audioAlerts';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface DialerTabProps {
  contacts: ContactItem[];
  recentCalls: CallLogItem[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  onOpenCallerDetail: (item: CallLogItem | CallShieldDirectoryProfile) => void;
  onSaveContact: (number: string, name?: string) => void;
  selectedSim: 'SIM 1 (Personal)' | 'SIM 2 (Work)';
  onChangeSim: (sim: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  initialNumber?: string;
  density?: DisplayDensity;
}

interface KeypadKeyConfig {
  digit: string;
  sub: string;
  isSpecial?: boolean;
}

const KEYPAD_KEYS: KeypadKeyConfig[] = [
  { digit: '1', sub: 'VOICEMAIL' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*', sub: '', isSpecial: true },
  { digit: '0', sub: '+' },
  { digit: '#', sub: '', isSpecial: true },
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
  const [isKeypadCollapsed, setIsKeypadCollapsed] = useState(false);
  const [activePressedKey, setActivePressedKey] = useState<string | null>(null);
  const [clipboardSnippet, setClipboardSnippet] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const didTriggerLongPressRef = useRef<boolean>(false);
  const lastKeyPressTimeRef = useRef<number>(0);

  // Dedicated backspace timers and cooldown guard to prevent accidental multiple deletions
  const lastDeleteTimeRef = useRef<number>(0);
  const deleteHoldTimeoutRef = useRef<number | null>(null);
  const deleteRepeatIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialNumber) {
      setValue(initialNumber);
      setIsKeypadCollapsed(false);
    }
  }, [initialNumber]);

  // Read clipboard on focus to detect if user has copied a phone number
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          const clean = sanitizePastedText(text);
          if (clean && clean.length >= 7 && clean.length <= 15 && clean !== value) {
            setClipboardSnippet(clean);
          } else {
            setClipboardSnippet(null);
          }
        }
      } catch {
        // Clipboard read permission might not be granted
      }
    };
    checkClipboard();
    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [value]);

  useEffect(() => {
    const handleBack = (e: any) => {
      if (showSimPicker) {
        setShowSimPicker(false);
        e.detail?.handled?.();
      } else if (isKeypadCollapsed) {
        setIsKeypadCollapsed(false);
        e.detail?.handled?.();
      } else if (value.trim().length > 0) {
        setValue('');
        e.detail?.handled?.();
      }
    };
    window.addEventListener('callshield_back_request', handleBack);
    return () => window.removeEventListener('callshield_back_request', handleBack);
  }, [showSimPicker, isKeypadCollapsed, value]);

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
        return n === digits || (digits.length >= 10 && n.length >= 10 && digits.endsWith(n.slice(-10)));
      }) || null
    );
  }, [digits, contacts]);

  const isEmergencyOrShortCode = useMemo(() => {
    const trimmed = value.trim();
    return Boolean(PUBLIC_DIRECTORY_DATABASE[trimmed] || (digits && PUBLIC_DIRECTORY_DATABASE[digits]));
  }, [value, digits]);

  // Strictly require at least 10 digits before looking up public directory profiles,
  // preventing premature names from flashing or displaying while user is still dialing
  const profile = useMemo(() => {
    if (!digits) return null;
    if (digits.length >= 10 || isEmergencyOrShortCode) {
      return lookupProfile(value);
    }
    return null;
  }, [digits, isEmergencyOrShortCode, value, lookupProfile]);

  const hapticIntensityMs = useMemo(() => {
    if (settings?.keypadHapticFeedback === false) return 0;
    if (settings?.keypadHapticIntensity === 'SOFT') return 15;
    if (settings?.keypadHapticIntensity === 'STRONG') return 40;
    return 25; // STANDARD
  }, [settings?.keypadHapticFeedback, settings?.keypadHapticIntensity]);

  const fireKeypadHaptic = (ms = hapticIntensityMs) => {
    if (ms > 0) {
      triggerHapticFeedback(ms);
      telecomBridge.vibratePhone(ms);
    }
  };

  // Robust String Concatenation & Keypad Digit Appending
  const appendDigit = (char: string) => {
    const now = Date.now();
    // Cooldown window (70ms) to reject any synthetic duplicate events
    if (now - lastKeyPressTimeRef.current < 70) {
      return;
    }
    lastKeyPressTimeRef.current = now;

    setValue((prev) => {
      // Limit to 25 chars to prevent unbounded overflow
      if (prev.length >= 25) return prev;
      return prev + char;
    });

    if (settings?.keypadDtmfTones !== false) {
      playDtmfTone(char);
    }
    fireKeypadHaptic();
  };

  const handleKeyPointerDown = (digit: string) => {
    didTriggerLongPressRef.current = false;
    setActivePressedKey(digit);

    if (digit === '0') {
      longPressTimerRef.current = window.setTimeout(() => {
        didTriggerLongPressRef.current = true;
        if (settings?.keypadDtmfTones !== false) {
          playDtmfTone('0');
        }
        fireKeypadHaptic(45);
        setValue((prev) => (prev.endsWith('0') ? prev.slice(0, -1) + '+' : prev + '+'));
        longPressTimerRef.current = null;
      }, 450);
    } else if (digit === '1' && !value) {
      longPressTimerRef.current = window.setTimeout(() => {
        didTriggerLongPressRef.current = true;
        fireKeypadHaptic(45);
        onInitiateCall('*86', 'Voicemail', selectedSim);
        longPressTimerRef.current = null;
      }, 650);
    }
  };

  const handleKeyPointerUp = (digit: string) => {
    setActivePressedKey(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Only append if long-press (+ or voicemail) did NOT trigger
    if (!didTriggerLongPressRef.current) {
      appendDigit(digit);
    }
    didTriggerLongPressRef.current = false;
  };

  const handleKeyPointerCancel = () => {
    setActivePressedKey(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    didTriggerLongPressRef.current = false;
  };

  // --- PRECISE BACKSPACE ENGINE: Single tap deletes strictly 1 char; hold (>500ms) triggers continuous repeat ---
  const clearDeleteTimers = () => {
    if (deleteHoldTimeoutRef.current !== null) {
      clearTimeout(deleteHoldTimeoutRef.current);
      deleteHoldTimeoutRef.current = null;
    }
    if (deleteRepeatIntervalRef.current !== null) {
      clearInterval(deleteRepeatIntervalRef.current);
      deleteRepeatIntervalRef.current = null;
    }
  };

  const deleteSingleChar = () => {
    const now = Date.now();
    // 140ms cooldown window prevents any accidental synthetic double deletion
    if (now - lastDeleteTimeRef.current < 140) {
      return;
    }
    lastDeleteTimeRef.current = now;

    fireKeypadHaptic(18);
    setValue((prev) => {
      if (!prev || prev.length <= 1) return '';
      return prev.slice(0, -1);
    });
  };

  const handleDeletePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();
    clearDeleteTimers();

    // 1. Delete exactly 1 character immediately on touch down
    deleteSingleChar();

    // 2. Schedule continuous deletion ONLY after holding for 500ms
    deleteHoldTimeoutRef.current = window.setTimeout(() => {
      deleteRepeatIntervalRef.current = window.setInterval(() => {
        setValue((prev) => {
          if (!prev || prev.length <= 1) {
            clearDeleteTimers();
            return '';
          }
          fireKeypadHaptic(14);
          return prev.slice(0, -1);
        });
      }, 80);
    }, 500);
  };

  const handleDeletePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    clearDeleteTimers();
  };

  useEffect(() => {
    return () => {
      clearDeleteTimers();
    };
  }, []);

  const call = (customNumber?: string, customName?: string) => {
    const targetNumber = (customNumber || value).trim();
    if (targetNumber) {
      fireKeypadHaptic(35);
      onInitiateCall(
        targetNumber,
        customName || matchedContact?.name || profile?.name || undefined,
        selectedSim
      );
    } else if (recentCalls && recentCalls.length > 0) {
      // Native phone feature: recall last dialed/received number when dialer is blank
      const lastCall = recentCalls[0];
      if (lastCall?.number) {
        fireKeypadHaptic(25);
        setValue(lastCall.number);
      }
    }
  };

  const isSim1 = selectedSim.includes('SIM 1');

  // Favorites & Frequent Contacts for quick one-tap dial when empty
  const favoriteContacts = useMemo(() => {
    const favs = contacts.filter((c) => c.isFavorite);
    if (favs.length > 0) return favs.slice(0, 5);
    return contacts.slice(0, 5);
  }, [contacts]);

  // Scaled dynamic font size for dialed digits, with strict line-height to maintain fixed height
  const numberFontSizeClass = useMemo(() => {
    const len = value.length;
    if (len > 18) return 'text-xl sm:text-2xl leading-none';
    if (len > 13) return 'text-2xl sm:text-3xl leading-none';
    if (len > 9) return 'text-3xl sm:text-4xl leading-none';
    return 'text-4xl sm:text-[42px] leading-none';
  }, [value.length]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col select-none px-3 pb-3 pt-0.5 sm:px-4">
      {/* 1. Header Bar: strictly fixed height (36px) */}
      <div className="flex h-9 shrink-0 items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Phone className="h-3.5 w-3.5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">
              {t('dialer_keypad')}
            </h1>
          </div>
        </div>

        {/* Dual-SIM Active Line Badge Pill & Keypad Collapse Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSimPicker(true)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition active:scale-95 cursor-pointer shadow-sm ${
              isSim1
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
            }`}
            title={t('choose_line')}
            aria-label={t('choose_line')}
          >
            <Layers className="h-3 w-3" />
            <span className="text-[11px]">{isSim1 ? 'SIM 1' : 'SIM 2'}</span>
          </button>

          {/* Toggle Keypad Collapse Button */}
          <button
            type="button"
            onClick={() => setIsKeypadCollapsed((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 transition active:scale-95"
            title={isKeypadCollapsed ? 'Show Keypad' : 'Hide Keypad'}
            aria-label={isKeypadCollapsed ? 'Show Keypad' : 'Hide Keypad'}
          >
            {isKeypadCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. Upper Suggestions Area: STRICTLY FIXED HEIGHT (78px) to prevent vertical layout jumping */}
      <div
        className={`w-full shrink-0 overflow-hidden mb-1 flex flex-col justify-center transition-all ${
          isKeypadCollapsed ? 'flex-1 min-h-[360px]' : 'h-[78px]'
        }`}
      >
        {value.trim().length > 0 ? (
          /* Live T9 & Number Search Results List inside fixed container */
          <div className="h-[78px] flex flex-col justify-center space-y-1 overflow-hidden pr-0.5">
            {results.matchingContacts.length > 0 ? (
              results.matchingContacts.slice(0, 2).map((c) => (
                <div
                  key={c.id}
                  className="flex h-[36px] items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2.5 py-1 transition group"
                >
                  <button
                    type="button"
                    onClick={() => setValue(c.number)}
                    className="flex flex-1 items-center gap-2 text-left cursor-pointer min-w-0"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-1 truncate">
                        <span className="truncate text-xs font-semibold text-white group-hover:text-emerald-300">
                          {c.name}
                        </span>
                        {c.isFavorite && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" />}
                      </div>
                    </div>
                    <span className="truncate text-[11px] text-slate-400 font-mono pr-2">
                      {formatPhoneNumber(c.number)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => call(c.number, c.name)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition active:scale-90"
                    title={`Call ${c.name}`}
                  >
                    <Phone className="h-3 w-3 fill-current" />
                  </button>
                </div>
              ))
            ) : results.matchingRecents.length > 0 ? (
              results.matchingRecents.slice(0, 2).map((r) => (
                <div
                  key={r.id}
                  className="flex h-[36px] items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2.5 py-1 transition group"
                >
                  <button
                    type="button"
                    onClick={() => setValue(r.number)}
                    className="flex flex-1 items-center gap-2 text-left cursor-pointer min-w-0"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 font-semibold text-[10px] border border-white/10">
                      {r.type === 'INCOMING' ? (
                        <ArrowDownLeft className="h-3 w-3 text-blue-400" />
                      ) : r.type === 'OUTGOING' ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <PhoneMissed className="h-3 w-3 text-rose-400" />
                      )}
                    </div>
                    <span className="truncate text-xs font-semibold text-white flex-1">
                      {r.callerName || formatPhoneNumber(r.number)}
                    </span>
                    <span className="truncate text-[11px] text-slate-400 font-mono pr-2">
                      {formatPhoneNumber(r.number)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => call(r.number, r.callerName)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition active:scale-90"
                    title={`Call ${r.callerName || r.number}`}
                  >
                    <Phone className="h-3 w-3 fill-current" />
                  </button>
                </div>
              ))
            ) : (
              <div className="h-[78px]" />
            )}
          </div>
        ) : (
          /* Blank State inside the exact same fixed 78px height */
          <div className="h-[78px] flex flex-col justify-center space-y-1.5">
            {/* Speed Dial Favorites Row (34px) */}
            <div className="flex h-[34px] items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pl-1 shrink-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>{t('cat_favorites')}</span>
              </span>
              {favoriteContacts.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setValue(c.number)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] px-2.5 py-1 text-xs text-slate-200 transition active:scale-95 cursor-pointer"
                >
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[85px] text-[11px] font-medium">{c.name}</span>
                </button>
              ))}
            </div>

            {/* Clipboard Detected Helper (34px) */}
            {clipboardSnippet ? (
              <button
                type="button"
                onClick={() => {
                  setValue(clipboardSnippet);
                  setClipboardSnippet(null);
                  fireKeypadHaptic(20);
                }}
                className="flex h-[32px] w-full items-center justify-between rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 px-3 text-xs text-emerald-300 transition active:scale-98"
              >
                <div className="flex items-center gap-2 truncate">
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    Paste from clipboard: <strong className="font-mono text-white">{clipboardSnippet}</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">Paste</span>
              </button>
            ) : (
              <div className="h-[32px]" />
            )}
          </div>
        )}
      </div>

      {/* 3. Pristine Dialed Number & Caller Info: STRICTLY FIXED HEIGHT (76px) */}
      <div
        id="dialer-display-area"
        onClick={() => inputRef.current?.focus()}
        onPaste={handlePaste}
        className="h-[76px] shrink-0 flex flex-col items-center justify-center overflow-hidden mb-1 px-2"
      >
        {/* Main Number Row: strictly fixed height (48px) */}
        <div className="relative flex h-[48px] w-full items-center justify-center">
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
            className={`w-full bg-transparent text-center font-semibold text-white outline-none selection:bg-emerald-500/30 transition-all ${numberFontSizeClass} placeholder:text-slate-600 placeholder:font-light`}
          />

          {/* Quick Clear 'X' Button */}
          {value ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fireKeypadHaptic(20);
                setValue('');
                inputRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition active:scale-90"
              aria-label={t('clear_input')}
              title={t('clear_input')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Dynamic Caller Identification or Contact Quick Add: strictly fixed height (24px) */}
        <div className="flex h-[24px] w-full items-center justify-center overflow-hidden transition-all text-xs">
          {matchedContact ? (
            <div className="flex items-center justify-center gap-1.5 font-semibold text-emerald-400 truncate text-xs">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold">
                <User className="h-2.5 w-2.5" />
              </div>
              <span className="truncate">{matchedContact.name}</span>
              <span className="text-[10px] text-emerald-500/80 font-normal">· Contact</span>
            </div>
          ) : (digits.length >= 10 || isEmergencyOrShortCode) && profile?.name && !isGenericOrPhoneNumber(profile.name, value) ? (
            <div className="flex items-center justify-center gap-1.5 truncate text-xs">
              <span className={`font-semibold truncate max-w-[180px] ${profile.isSpam ? 'text-rose-400' : 'text-slate-200'}`}>
                {profile.name}
              </span>
              <span className="text-slate-600">·</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  profile.isSpam
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : profile.isVerified
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 text-slate-300'
                }`}
              >
                {profile.isSpam ? t('spam_badge') : profile.isVerified ? t('safe_badge') : 'Verified'}
              </span>
            </div>
          ) : digits.length >= 3 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSaveContact(value);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 transition active:scale-95"
            >
              <UserPlus className="h-3 w-3" />
              <span>{t('add_to_contacts')}</span>
            </button>
          ) : (
            <div className="h-[24px]" />
          )}
        </div>
      </div>

      {/* 4. Flagship Smartphone Keypad Grid & Action Controls: STRICTLY FIXED HEIGHT */}
      {!isKeypadCollapsed && (
        <div className="mx-auto w-full max-w-[310px] sm:max-w-[330px] shrink-0 mt-0.5 animate-in fade-in duration-150">
          {/* Keypad Grid (4 rows * 64px + 3 gaps = strictly 296px) */}
          <div className="h-[296px] shrink-0 grid grid-cols-3 gap-x-6 sm:gap-x-7 gap-y-2.5 sm:gap-y-3 place-items-center">
            {KEYPAD_KEYS.map((k) => {
              const isPressed = activePressedKey === k.digit;
              return (
                <button
                  type="button"
                  key={k.digit}
                  onPointerDown={() => handleKeyPointerDown(k.digit)}
                  onPointerUp={() => handleKeyPointerUp(k.digit)}
                  onPointerLeave={handleKeyPointerCancel}
                  onPointerCancel={handleKeyPointerCancel}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{ touchAction: 'none' }}
                  className={`group relative flex h-16 w-16 sm:h-[66px] sm:w-[66px] flex-col items-center justify-center rounded-full transition-all duration-75 focus:outline-none shrink-0 select-none shadow-[0_2px_8px_rgba(0,0,0,0.28)] border ${
                    isPressed
                      ? 'scale-92 bg-emerald-500/25 border-emerald-500/50 ring-2 ring-emerald-400/30'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] active:scale-92 active:bg-white/[0.18] border-white/[0.08] hover:border-white/20'
                  }`}
                  aria-label={k.digit === '1' ? '1 (Voicemail)' : k.digit === '0' ? '0 (+)' : k.digit}
                >
                  <span className="font-semibold text-2xl sm:text-[27px] tracking-tight text-white leading-none">
                    {k.digit}
                  </span>

                  {/* Sub-label / Sub-letters */}
                  {k.digit === '1' ? (
                    <span className="flex items-center gap-0.5 text-[8px] font-bold text-slate-400 mt-1 tracking-wider uppercase leading-none group-hover:text-slate-300">
                      <Voicemail className="h-2.5 w-2.5 opacity-80" />
                    </span>
                  ) : k.digit === '0' ? (
                    <span className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-tight leading-none group-hover:text-slate-300">
                      +
                    </span>
                  ) : k.sub ? (
                    <span className="text-[9px] font-bold text-slate-400 mt-1 tracking-[0.18em] uppercase leading-none group-hover:text-slate-300">
                      {k.sub}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Action Controls Row (SIM Switcher, Hero Call Button, Precise Backspace): strictly fixed height (72px) */}
          <div className="h-[72px] shrink-0 grid grid-cols-3 items-center mt-3 gap-x-6 sm:gap-x-7 place-items-center">
            {/* Left Slot: SIM Switcher Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  fireKeypadHaptic(20);
                  onChangeSim(isSim1 ? 'SIM 2 (Work)' : 'SIM 1 (Personal)');
                }}
                className={`flex flex-col items-center justify-center rounded-full border transition-all active:scale-90 h-12 w-12 shrink-0 shadow-sm ${
                  !isSim1
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                    : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                }`}
                title={isSim1 ? 'Switch to SIM 2' : 'Switch to SIM 1'}
                aria-label={isSim1 ? 'Switch to SIM 2' : 'Switch to SIM 1'}
              >
                <Layers className="h-4 w-4" />
                <span className="mt-0.5 text-[8px] font-bold uppercase leading-none">
                  {isSim1 ? 'SIM 1' : 'SIM 2'}
                </span>
              </button>
            </div>

            {/* Center Slot: Flagship Hero Call Button */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => call()}
                className={`group relative flex h-16 w-16 sm:h-[66px] sm:w-[66px] items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-92 shrink-0 ${
                  isSim1
                    ? 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-green-400 hover:brightness-110 shadow-emerald-500/35 ring-4 ring-emerald-500/20'
                    : 'bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-400 hover:brightness-110 shadow-blue-500/35 ring-4 ring-blue-500/20'
                }`}
                aria-label={`${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})`}
                title={
                  value.trim()
                    ? `${t('call_action')} (${isSim1 ? t('sim_1') : t('sim_2')})`
                    : recentCalls.length > 0
                    ? `Redial ${recentCalls[0].callerName || recentCalls[0].number}`
                    : t('call_action')
                }
              >
                <Phone className="h-6 w-6 fill-current transition-transform duration-100 group-hover:scale-105" />
                {/* Active line mini-dot */}
                <span
                  className={`absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-slate-900 ${
                    isSim1 ? 'bg-emerald-400' : 'bg-blue-400'
                  }`}
                />
              </button>
            </div>

            {/* Right Slot: Precise Backspace Engine (1 tap = 1 char; hold = repeat) */}
            <div className="flex justify-center">
              {value ? (
                <button
                  type="button"
                  onPointerDown={handleDeletePointerDown}
                  onPointerUp={handleDeletePointerUp}
                  onPointerLeave={clearDeleteTimers}
                  onPointerCancel={clearDeleteTimers}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    clearDeleteTimers();
                    setValue('');
                  }}
                  style={{ touchAction: 'none' }}
                  className="grid h-12 w-12 place-items-center rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 active:bg-white/20 transition shrink-0 select-none cursor-pointer"
                  aria-label={t('delete')}
                  title="Backspace (Tap: delete 1, Hold: delete all)"
                >
                  <Delete className="h-5 w-5" />
                </button>
              ) : (
                <div className="h-12 w-12 shrink-0" />
              )}
            </div>
          </div>

          {/* CallShield Security Verification Footer: strictly fixed height (20px) */}
          <div className="h-5 shrink-0 flex items-center justify-center gap-1.5 text-slate-400 transition-all mt-2 text-[10px]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{t('protected_calls')}</span>
          </div>
        </div>
      )}

      {/* Floating Re-Open Keypad FAB if user collapsed it */}
      {isKeypadCollapsed && (
        <div className="fixed bottom-20 right-6 z-30 sm:right-10">
          <button
            type="button"
            onClick={() => setIsKeypadCollapsed(false)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/40 hover:bg-emerald-400 transition active:scale-95 cursor-pointer ring-4 ring-emerald-500/20"
            title="Open Dialpad"
            aria-label="Open Dialpad"
          >
            <Grid3x3 className="h-6 w-6" />
          </button>
        </div>
      )}

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
                className={`mb-2.5 flex w-full items-center justify-between rounded-2xl border p-3.5 text-left text-sm font-bold transition cursor-pointer ${
                  selectedSim === sim
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`grid h-8 w-8 place-items-center rounded-xl ${
                      sim.includes('SIM 1') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block font-bold">{sim.includes('SIM 1') ? t('sim_1') : t('sim_2')}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {sim.includes('SIM 1') ? 'Primary Line' : 'Business Line'}
                    </span>
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
