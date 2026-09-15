import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Phone, 
  Delete, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  User, 
  Building2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Sparkles, 
  Volume2, 
  Vibrate, 
  Layers, 
  Check, 
  X,
  ArrowRight,
  HelpCircle,
  Copy,
  ClipboardCheck
} from 'lucide-react';
import { 
  ContactItem, 
  CallLogItem, 
  TruecallerDirectoryProfile, 
  ShieldSettings, 
  RiskLevel 
} from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playDtmfTone, triggerHapticFeedback } from '../utils/audioAlerts';

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

const KEYPAD_BUTTONS = [
  { digit: '1', sub: 'Voicemail', key: '1' },
  { digit: '2', sub: 'ABC', key: '2' },
  { digit: '3', sub: 'DEF', key: '3' },
  { digit: '4', sub: 'GHI', key: '4' },
  { digit: '5', sub: 'JKL', key: '5' },
  { digit: '6', sub: 'MNO', key: '6' },
  { digit: '7', sub: 'PQRS', key: '7' },
  { digit: '8', sub: 'TUV', key: '8' },
  { digit: '9', sub: 'WXYZ', key: '9' },
  { digit: '*', sub: '(P)', key: '*' },
  { digit: '0', sub: '+', key: '0' },
  { digit: '#', sub: '(W)', key: '#' },
];

export default function DialerTab({
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
}: DialerTabProps) {
  const [inputNumber, setInputNumber] = useState(initialNumber || '');
  const [showSimPicker, setShowSimPicker] = useState(false);

  useEffect(() => {
    if (initialNumber) {
      setInputNumber(initialNumber);
    }
  }, [initialNumber]);
  const [rememberSimChoice, setRememberSimChoice] = useState(false);
  const [safetyWarningNumber, setSafetyWarningNumber] = useState<{
    number: string;
    profile: TruecallerDirectoryProfile;
  } | null>(null);
  const [detectedClipboard, setDetectedClipboard] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // Check clipboard on mount or user interaction safely
  const checkClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const cleaned = text.trim();
        const digits = cleaned.replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15 && cleaned !== inputNumber) {
          setDetectedClipboard(cleaned);
        }
      }
    } catch {
      // Permission not granted or clipboard empty
    }
  };

  useEffect(() => {
    // Check once on dialer view
    checkClipboard();
  }, []);

  // Handle keypad digit press
  const handlePressDigit = (digit: string) => {
    if (soundEnabled) {
      playDtmfTone(digit);
    }
    if (hapticEnabled) {
      triggerHapticFeedback(20);
    }
    setInputNumber((prev) => prev + digit);
  };

  // Long press '0' for '+'
  const zeroTimerRef = useRef<number | null>(null);
  const handleZeroPointerDown = () => {
    zeroTimerRef.current = window.setTimeout(() => {
      if (soundEnabled) playDtmfTone('0');
      if (hapticEnabled) triggerHapticFeedback(35);
      setInputNumber((prev) => prev.slice(0, -1) + '+');
      zeroTimerRef.current = null;
    }, 450);
  };
  const handleZeroPointerUp = () => {
    if (zeroTimerRef.current) {
      clearTimeout(zeroTimerRef.current);
      zeroTimerRef.current = null;
    }
  };

  // Backspace
  const handleBackspace = () => {
    if (soundEnabled) playDtmfTone('*', 60);
    if (hapticEnabled) triggerHapticFeedback(15);
    setInputNumber((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    if (hapticEnabled) triggerHapticFeedback([20, 50, 20]);
    setInputNumber('');
  };

  // Smart search while dialing (T9 + direct number + recent logs)
  const searchResults = useMemo(() => {
    return smartDialerSearch(inputNumber, contacts, recentCalls, lookupProfile);
  }, [inputNumber, contacts, recentCalls, lookupProfile]);

  // Lookup current input caller profile if 4+ digits
  const currentInputProfile = useMemo(() => {
    if (inputNumber.trim().replace(/\D/g, '').length >= 4) {
      return lookupProfile(inputNumber);
    }
    return null;
  }, [inputNumber, lookupProfile]);

  // Check if current input matches a saved contact
  const matchedSavedContact = useMemo(() => {
    const digits = inputNumber.replace(/\D/g, '');
    if (!digits) return null;
    return contacts.find((c) => c.number.replace(/\D/g, '') === digits);
  }, [inputNumber, contacts]);

  // Call Button Intelligence Check
  const handleCallButtonPress = () => {
    const rawNumber = inputNumber.trim();
    if (!rawNumber) return;

    if (soundEnabled) playDtmfTone('#', 100);
    if (hapticEnabled) triggerHapticFeedback(40);

    // If known contact or safe verified business, call directly
    if (matchedSavedContact || (currentInputProfile && currentInputProfile.isVerified)) {
      onInitiateCall(rawNumber, matchedSavedContact?.name || currentInputProfile?.name, selectedSim);
      return;
    }

    // If unknown number with high risk / suspicious reputation, show brief caller safety preview
    if (currentInputProfile && (currentInputProfile.isSpam || currentInputProfile.spamScore >= 50 || currentInputProfile.riskLevel === 'HIGH_RISK')) {
      setSafetyWarningNumber({
        number: rawNumber,
        profile: currentInputProfile,
      });
      return;
    }

    // Normal call
    onInitiateCall(rawNumber, undefined, selectedSim);
  };

  return (
    <div className="max-w-md mx-auto px-3 sm:px-4 py-2 sm:py-4 flex flex-col justify-between min-h-[calc(100vh-140px)]">
      {/* Top Header & Search / SIM Selector Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Smart Dialer
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              AI T9 Ready
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* SIM Switcher Pill */}
            <button
              id="dialer-sim-selector"
              onClick={() => setShowSimPicker(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-200 transition"
              title="Change active SIM card"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>{selectedSim.includes('SIM 1') ? 'SIM 1' : 'SIM 2'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg border transition ${
                soundEnabled 
                  ? 'bg-slate-800 border-slate-700 text-slate-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}
              title={soundEnabled ? 'Keypad tones active' : 'Keypad tones muted'}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>

            {/* Haptic Toggle */}
            <button
              onClick={() => setHapticEnabled(!hapticEnabled)}
              className={`p-1.5 rounded-lg border transition ${
                hapticEnabled 
                  ? 'bg-slate-800 border-slate-700 text-slate-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-600'
              }`}
              title={hapticEnabled ? 'Haptic feedback on' : 'Haptic feedback off'}
            >
              <Vibrate className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Universal Search Bar while dialing */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="dialer-search-input"
            type="text"
            value={inputNumber}
            onChange={(e) => setInputNumber(e.target.value)}
            placeholder="Dial a number or search by name..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          {inputNumber && (
            <button
              onClick={handleClearAll}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Clipboard detection banner */}
        {detectedClipboard && !inputNumber && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
            <div className="flex items-center space-x-2 truncate">
              <ClipboardCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400">Number detected: </span>
                <span className="font-semibold text-white">{detectedClipboard}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0 ml-2">
              <button
                onClick={() => {
                  setInputNumber(detectedClipboard);
                  setDetectedClipboard(null);
                }}
                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px]"
              >
                Insert
              </button>
              <button
                onClick={() => setDetectedClipboard(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Live Search Suggestions (Contacts & Caller ID) */}
        {inputNumber && (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {/* Matching Contacts */}
            {searchResults.matchingContacts.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setInputNumber(c.number);
                  onInitiateCall(c.number, c.name, selectedSim);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>{c.name}</span>
                      <span className="text-[10px] text-emerald-400 font-normal">🟢 Saved</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{formatPhoneNumber(c.number)}</div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInitiateCall(c.number, c.name, selectedSim);
                  }}
                  className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Possible Caller (Community or Directory) */}
            {searchResults.possibleCaller && !searchResults.matchingContacts.some(c => c.name === searchResults.possibleCaller?.name) && (
              <div
                onClick={() => onOpenCallerDetail(searchResults.possibleCaller!)}
                className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition ${
                  searchResults.possibleCaller.isSpam
                    ? 'bg-rose-950/30 border-rose-500/30 hover:bg-rose-950/50'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    searchResults.possibleCaller.isSpam
                      ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                      : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {searchResults.possibleCaller.isVerified ? (
                      <Building2 className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>{searchResults.possibleCaller.name}</span>
                      {searchResults.possibleCaller.isSpam ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-semibold">
                          🟠 {searchResults.possibleCaller.spamCategory || 'Spam'}
                        </span>
                      ) : searchResults.possibleCaller.isVerified ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Directory</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {searchResults.possibleCaller.location || searchResults.possibleCaller.carrier}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400">Tap for info</span>
                </div>
              </div>
            )}

            {/* Matching Recent Calls */}
            {searchResults.matchingRecents.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  setInputNumber(r.number);
                  onInitiateCall(r.number, r.callerName, selectedSim);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 cursor-pointer transition text-xs"
              >
                <div className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <div>
                    <span className="text-slate-200 font-medium mr-1.5">
                      {r.callerName || formatPhoneNumber(r.number)}
                    </span>
                    <span className="text-[10px] text-slate-400">Recent</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(r.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Entered Number Display Section */}
      <div className="my-3 text-center px-2">
        <div className="min-h-[52px] flex items-center justify-center relative">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white select-all break-all">
            {inputNumber ? formatPhoneNumber(inputNumber) : (
              <span className="text-slate-600 text-lg font-medium">Enter number...</span>
            )}
          </span>

          {inputNumber && (
            <button
              id="dialer-backspace"
              onClick={handleBackspace}
              className="absolute right-1 p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 transition"
              title="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Live Identification Badge below entered number */}
        {inputNumber && (
          <div className="flex items-center justify-center space-x-2 mt-1">
            {matchedSavedContact ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Check className="w-3 h-3" />
                <span>Saved Contact: {matchedSavedContact.name}</span>
              </span>
            ) : currentInputProfile ? (
              <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                currentInputProfile.isSpam
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : currentInputProfile.isVerified
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {currentInputProfile.isSpam ? (
                  <ShieldAlert className="w-3 h-3" />
                ) : currentInputProfile.isVerified ? (
                  <ShieldCheck className="w-3 h-3" />
                ) : (
                  <HelpCircle className="w-3 h-3" />
                )}
                <span>
                  {currentInputProfile.name} • {currentInputProfile.isSpam ? 'Suspicious' : currentInputProfile.isVerified ? 'Verified' : 'Directory'}
                </span>
              </span>
            ) : null}

            {!matchedSavedContact && inputNumber.replace(/\D/g, '').length >= 7 && (
              <button
                onClick={() => onSaveContact(inputNumber)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-0.5 underline decoration-indigo-500/40 ml-1"
              >
                <Plus className="w-3 h-3" />
                <span>Save</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Numeric Keypad (Circular, Soft Touch, Authentic T9 Labels) */}
      <div className="grid grid-cols-3 gap-y-2 sm:gap-y-3 gap-x-4 sm:gap-x-6 max-w-[310px] mx-auto mb-2">
        {KEYPAD_BUTTONS.map((btn) => (
          <button
            key={btn.digit}
            id={`keypad-button-${btn.digit === '*' ? 'star' : btn.digit === '#' ? 'hash' : btn.digit}`}
            onClick={() => handlePressDigit(btn.digit)}
            onPointerDown={btn.digit === '0' ? handleZeroPointerDown : undefined}
            onPointerUp={btn.digit === '0' ? handleZeroPointerUp : undefined}
            onPointerLeave={btn.digit === '0' ? handleZeroPointerUp : undefined}
            className="w-16 sm:w-18 h-16 sm:h-18 rounded-full bg-slate-800/90 hover:bg-slate-700/90 active:bg-indigo-600/30 active:scale-95 border border-slate-700/80 shadow-md flex flex-col items-center justify-center transition-all cursor-pointer group"
          >
            <span className="text-xl sm:text-2xl font-bold text-white group-hover:text-indigo-300 leading-none">
              {btn.digit}
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 group-hover:text-slate-200 tracking-wider mt-0.5">
              {btn.sub}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom Calling Controls (Large Call Button) */}
      <div className="flex items-center justify-center pt-1 pb-2">
        <button
          id="dialer-main-call-btn"
          onClick={handleCallButtonPress}
          disabled={!inputNumber}
          className={`w-48 sm:w-56 py-3.5 rounded-2xl flex items-center justify-center space-x-3 font-bold text-base transition-all shadow-xl ${
            inputNumber
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 cursor-pointer active:scale-98 ring-2 ring-emerald-400/40'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Phone className="w-4 h-4 text-white fill-current" />
          </div>
          <span>Call ({selectedSim.includes('SIM 1') ? 'SIM 1' : 'SIM 2'})</span>
        </button>
      </div>

      {/* DUAL-SIM SELECTION BOTTOM SHEET */}
      {showSimPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Call using</h3>
              </div>
              <button
                onClick={() => setShowSimPicker(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <button
                id="sim-choice-1"
                onClick={() => {
                  onChangeSim('SIM 1 (Personal)');
                  setShowSimPicker(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition ${
                  selectedSim === 'SIM 1 (Personal)'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                    1
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">SIM 1 — Personal</div>
                    <div className="text-xs text-slate-400">Default carrier line • Active 5G</div>
                  </div>
                </div>
                {selectedSim === 'SIM 1 (Personal)' && (
                  <Check className="w-5 h-5 text-indigo-400" />
                )}
              </button>

              <button
                id="sim-choice-2"
                onClick={() => {
                  onChangeSim('SIM 2 (Work)');
                  setShowSimPicker(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition ${
                  selectedSim === 'SIM 2 (Work)'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-violet-600/30 text-violet-400 flex items-center justify-center font-bold text-xs border border-violet-500/30">
                    2
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">SIM 2 — Work</div>
                    <div className="text-xs text-slate-400">Enterprise line • Active LTE</div>
                  </div>
                </div>
                {selectedSim === 'SIM 2 (Work)' && (
                  <Check className="w-5 h-5 text-indigo-400" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberSimChoice}
                  onChange={(e) => setRememberSimChoice(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Remember my choice for future calls</span>
              </label>

              <button
                onClick={() => setShowSimPicker(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALL BUTTON INTELLIGENCE WARNING MODAL */}
      {safetyWarningNumber && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Caller Risk Warning</h3>
                <p className="text-xs text-rose-300">
                  Suspicious or high-risk caller identified
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-1.5">
              <div className="text-sm font-extrabold text-white">
                {safetyWarningNumber.profile.name}
              </div>
              <div className="text-xs text-slate-400">
                {formatPhoneNumber(safetyWarningNumber.number)}
              </div>
              <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                <span>🟠 {safetyWarningNumber.profile.spamCategory || 'Telemarketing'}</span>
                <span>• {safetyWarningNumber.profile.spamReportsCount} reports</span>
              </div>
              <p className="text-xs text-slate-300 pt-1">
                Multiple users have reported unsolicited promotional or suspicious robocall activity from this line.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setSafetyWarningNumber(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const num = safetyWarningNumber.number;
                  const name = safetyWarningNumber.profile.name;
                  setSafetyWarningNumber(null);
                  onInitiateCall(num, name, selectedSim);
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-950/50"
              >
                Call Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
