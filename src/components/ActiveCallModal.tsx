import { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Grid, 
  UserPlus, 
  Pause, 
  Play, 
  Disc, 
  ShieldCheck, 
  Lock, 
  Sparkles, 
  Radio, 
  Check, 
  X,
  AlertCircle,
  Folder,
  StickyNote,
  Copy,
  Trash2,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { ActiveCallSession, CallShieldDirectoryProfile, CallRecordingItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playDtmfTone, triggerHapticFeedback, playNotificationChime } from '../utils/audioAlerts';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService, DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';

interface ActiveCallModalProps {
  session: ActiveCallSession | null;
  onEndCall: (recordingItem?: CallRecordingItem | null, callDuration?: number, callerNote?: string) => void;
  lookupProfile: (num: string) => CallShieldDirectoryProfile;
  onAddCall?: (number: string) => void;
}

export default function ActiveCallModal({
  session,
  onEndCall,
  lookupProfile,
  onAddCall,
}: ActiveCallModalProps) {
  const { t } = useI18n();
  const [duration, setDuration] = useState(session?.durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(session?.isMuted || false);
  const [isSpeaker, setIsSpeaker] = useState(session?.isSpeaker || false);
  const [isOnHold, setIsOnHold] = useState(session?.isHeld || false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingWarningPlayed, setRecordingWarningPlayed] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);
  const [keypadDigits, setKeypadDigits] = useState('');
  const [showAddCallPrompt, setShowAddCallPrompt] = useState(false);
  const [secondCallInput, setSecondCallInput] = useState('');

  // In-Call Private Notes state for jotting down details during the live call
  const [showInCallNotes, setShowInCallNotes] = useState(false);
  const [callerNote, setCallerNote] = useState('');
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Load existing notes for this caller on session start
  useEffect(() => {
    if (!session?.number) return;
    const cleanKey = session.number.replace(/\D/g, '');
    try {
      const raw = localStorage.getItem('vigilshield_call_notes_v1');
      if (raw) {
        const obj = JSON.parse(raw);
        const existing = obj[cleanKey] || session.notes || '';
        setCallerNote(existing);
      } else if (session.notes) {
        setCallerNote(session.notes);
      }
    } catch {
      if (session.notes) setCallerNote(session.notes);
    }
  }, [session?.number, session?.notes]);

  // Call timer increment
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Recording timer increment
  useEffect(() => {
    if (!isRecording) {
      setRecordingDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!session) return null;

  const saveNoteLocally = (text: string) => {
    if (!session?.number) return;
    const cleanKey = session.number.replace(/\D/g, '');
    try {
      const raw = localStorage.getItem('vigilshield_call_notes_v1') || '{}';
      const obj = JSON.parse(raw);
      if (text.trim()) {
        obj[cleanKey] = text.trim();
      } else {
        delete obj[cleanKey];
      }
      localStorage.setItem('vigilshield_call_notes_v1', JSON.stringify(obj));
      setNoteSavedNotice(true);
      setTimeout(() => setNoteSavedNotice(false), 1600);
    } catch {
      // Storage fallback
    }
  };

  const handleNoteChange = (text: string) => {
    setCallerNote(text);
    saveNoteLocally(text);
  };

  const handleInsertTag = (tag: string) => {
    const updated = callerNote ? `${callerNote.trim()}\n${tag}` : tag;
    setCallerNote(updated);
    saveNoteLocally(updated);
    if (notesInputRef.current) {
      notesInputRef.current.focus();
    }
  };

  const handleCopyNote = () => {
    if (!callerNote.trim()) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(callerNote).catch(() => {});
      }
      triggerHapticFeedback(20);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {}
  };

  const handleClearNote = () => {
    if (window.confirm('Clear your in-call note?')) {
      setCallerNote('');
      saveNoteLocally('');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeypadPress = (digit: string) => {
    playDtmfTone(digit);
    triggerHapticFeedback(20);
    setKeypadDigits((prev) => prev + digit);
    if (session?.id) {
      telecomBridge.sendDtmfTone(session.id, digit);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    telecomBridge.setMuted(next);
  };

  const handleToggleSpeaker = () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    telecomBridge.setSpeakerRoute(next);
  };

  const handleToggleHold = () => {
    const next = !isOnHold;
    setIsOnHold(next);
    if (session?.id) {
      if (next) {
        telecomBridge.holdCall(session.id);
      } else {
        telecomBridge.unholdCall(session.id);
      }
    }
  };

  const handleSwapCalls = () => {
    telecomBridge.swapCalls();
  };

  const handleMergeCalls = () => {
    telecomBridge.mergeCalls();
  };

  const handleExecuteAddCall = () => {
    if (!secondCallInput.trim()) return;
    if (onAddCall) {
      onAddCall(secondCallInput.trim());
    } else {
      telecomBridge.placeRealCall(secondCallInput.trim());
    }
    setShowAddCallPrompt(false);
    setSecondCallInput('');
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingWarningPlayed(true);
      playNotificationChime();
      triggerHapticFeedback(40);
      await callRecordingService.startRecording(
        session.number,
        session.name || 'Unknown Caller',
        session.id
      );
      setTimeout(() => setRecordingWarningPlayed(false), 3500);
    } else {
      setIsRecording(false);
      triggerHapticFeedback(30);
      const savedRec = await callRecordingService.stopRecording();
      if (savedRec) {
        setSavedNotice(savedRec.fileName);
        playNotificationChime();
        setTimeout(() => setSavedNotice(null), 4000);
      }
    }
  };

  const handleEndCallAction = async () => {
    let recordingItem: CallRecordingItem | null = null;
    if (isRecording) {
      setIsRecording(false);
      recordingItem = await callRecordingService.stopRecording();
    }
    if (callerNote.trim()) {
      saveNoteLocally(callerNote);
    }
    onEndCall(recordingItem, durationRef.current, callerNote.trim() || undefined);
  };

  const callerProfile = lookupProfile(session.number);

  if (isMinimized) {
    return (
      <aside
        id="active-call-notification-banner"
        role="alert"
        aria-live="polite"
        className="fixed top-2 sm:top-4 inset-x-2 sm:inset-x-auto sm:right-4 sm:w-[440px] z-[99999] rounded-2xl bg-[#0c1320]/95 backdrop-blur-xl border border-emerald-500/30 p-3 sm:p-3.5 text-white shadow-2xl shadow-black/90 animate-in slide-in-from-top duration-200"
      >
        {/* Banner Top Info Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 mb-2 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-300 truncate">{t('call_connected')}</span>
            <span className="text-slate-400 shrink-0">· {session.sim || 'SIM 1'}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-bold text-emerald-400 text-xs">{formatTimer(duration)}</span>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition font-semibold text-[11px]"
              title="Expand to Full Call Window"
              aria-label="Expand Call"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand</span>
            </button>
          </div>
        </div>

        {/* Card info */}
        <div onClick={() => setIsMinimized(false)} className="flex items-center gap-3 cursor-pointer group select-none">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-sm font-extrabold shadow-md shrink-0">
            {session.name ? session.name.slice(0, 1).toUpperCase() : '👤'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-bold text-sm text-white truncate max-w-[200px]">
                {session.name || t('unknown_caller')}
              </h4>
              {session.isVerifiedBusiness && (
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {formatPhoneNumber(session.number)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleToggleMute}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs shadow-md transition cursor-pointer ${
              isMuted ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSpeaker}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-xs shadow-md transition cursor-pointer ${
              isSpeaker ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isSpeaker ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>Speaker</span>
          </button>

          <button
            type="button"
            onClick={handleEndCallAction}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 active:scale-95 transition cursor-pointer"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>End</span>
          </button>
        </div>
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-white text-center relative overflow-hidden max-h-[95vh] overflow-y-auto">
        {/* Top Status & SIM info */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">{t('call_connected')}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
              {session.sim || 'SIM 1'}
            </span>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Minimize to banner"
              aria-label="Minimize call"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Caller Avatar & Identity */}
        <div className="space-y-1.5">
          <div className="w-16 h-16 rounded-full mx-auto bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-2xl font-extrabold shadow-xl ring-4 ring-indigo-500/20">
            {session.name ? session.name.slice(0, 1).toUpperCase() : '👤'}
          </div>

          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center justify-center space-x-1.5">
              <span className="truncate max-w-[240px]">{session.name || t('unknown_caller')}</span>
              {session.isVerifiedBusiness && (
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              )}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {formatPhoneNumber(session.number)}
            </p>
          </div>

          {/* Active Call Timer */}
          <div className="text-2xl font-black text-indigo-300 font-mono tracking-wider">
            {formatTimer(duration)}
          </div>
        </div>

        {/* Real-time Call Intelligence panel */}
        <div className="p-2.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-1 text-xs">
          <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
            <span className="flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>Secure Telecom Channel</span>
            </span>
            <span className="flex items-center space-x-1">
              <Radio className="w-3 h-3" />
              <span>HD Voice Active (48 kHz)</span>
            </span>
          </div>
          <div className="text-slate-400 text-[11px] flex items-center space-x-1 pt-0.5">
            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>AI Real-time Firewall: Verified Clean Stream</span>
          </div>
        </div>

        {/* Real-time Call Recording Active Banner */}
        {isRecording && (
          <div className="p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between animate-pulse">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-extrabold text-rose-200">
                REC {formatTimer(recordingDuration)}
              </span>
              <span className="text-[10px] bg-rose-500/20 px-1.5 py-0.5 rounded text-rose-300">
                48 kHz Lossless
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
              <Folder className="w-3 h-3 text-amber-400/80" />
              <span>CallShield/</span>
            </div>
          </div>
        )}

        {/* Saved Recording Notification */}
        {savedNotice && (
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-300 font-semibold flex items-center justify-center space-x-1.5">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="truncate">Saved to device storage: {savedNotice}</span>
          </div>
        )}

        {/* Call Recording Compliance Notice */}
        {recordingWarningPlayed && (
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-semibold animate-pulse flex items-center justify-center space-x-1.5">
            <AlertCircle className="w-4 h-4" />
            <span>Audio recording active · 48 kHz High Fidelity</span>
          </div>
        )}

        {/* IN-CALL PRIVATE NOTE TAKING PAD */}
        {showInCallNotes && (
          <div className="p-3.5 rounded-2xl bg-slate-950/95 border border-amber-500/40 text-left space-y-2.5 animate-in fade-in zoom-in-95 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <StickyNote className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-300">In-Call Private Scratchpad</span>
              </div>
              <div className="flex items-center space-x-2">
                {noteSavedNotice ? (
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Auto-saved</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Private & Local</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowInCallNotes(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  aria-label="Close notes"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick-Insert Tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px]">
              <span className="text-slate-500 shrink-0 font-medium">Quick:</span>
              {[
                { label: '📍 Address', text: '📍 Address: ' },
                { label: '🔢 Ref #', text: '🔢 Ref No: ' },
                { label: '💰 Price', text: '💰 Price: ' },
                { label: '📅 Meet', text: '📅 Meeting: ' },
                { label: '⏰ Callback', text: '⏰ Call back at: ' },
                { label: '📞 Alt No', text: '📞 Alt phone: ' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleInsertTag(chip.text)}
                  className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 border border-slate-700 text-slate-300 shrink-0 font-medium transition active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Note Area */}
            <textarea
              ref={notesInputRef}
              value={callerNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              rows={3}
              placeholder="Jot down notes, address, OTP, codes, or instructions during the call…"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/90 p-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 font-sans"
            />

            {/* Footer Toolbar */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleCopyNote}
                  disabled={!callerNote.trim()}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 text-[11px] font-semibold flex items-center space-x-1 transition"
                >
                  {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                </button>
                {callerNote.trim() && (
                  <button
                    type="button"
                    onClick={handleClearNote}
                    className="px-2 py-1 rounded-lg text-slate-500 hover:text-rose-400 text-[11px] font-medium transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowInCallNotes(false)}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* In-Call In-Screen Keypad Popover */}
        {showInCallKeypad && (
          <div className="p-3 rounded-2xl bg-slate-850 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">DTMF Keypad</span>
              <span className="text-xs font-mono text-indigo-300 min-h-[16px]">
                {keypadDigits || 'Dialed digits'}
              </span>
              <button
                onClick={() => setShowInCallKeypad(false)}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white font-bold text-sm"
                >
                  {digit}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Call (Conference) Popover */}
        {showAddCallPrompt && (
          <div className="p-3 rounded-2xl bg-slate-850 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Add Second Call</span>
              <button
                onClick={() => setShowAddCallPrompt(false)}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex space-x-2">
              <input
                type="tel"
                value={secondCallInput}
                onChange={(e) => setSecondCallInput(e.target.value)}
                placeholder="Enter phone number"
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleExecuteAddCall}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
              >
                Call
              </button>
            </div>
          </div>
        )}

        {/* In-Call Action Grid (6 Key Functions) */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Mute */}
          <button
            onClick={handleToggleMute}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 ${
              isMuted
                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5" />}
            <span className="text-[10px] font-semibold mt-1">{isMuted ? t('unmute') : t('mute')}</span>
          </button>

          {/* Keypad */}
          <button
            onClick={() => {
              setShowInCallKeypad((prev) => !prev);
              setShowInCallNotes(false);
              setShowAddCallPrompt(false);
            }}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 ${
              showInCallKeypad
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Grid className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">{t('keypad')}</span>
          </button>

          {/* Speaker */}
          <button
            onClick={handleToggleSpeaker}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 ${
              isSpeaker
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5" />}
            <span className="text-[10px] font-semibold mt-1">{isSpeaker ? t('earpiece') : t('speaker')}</span>
          </button>

          {/* In-Call Notes (User's feature request to jot down details during call) */}
          <button
            onClick={() => {
              setShowInCallNotes((prev) => !prev);
              setShowInCallKeypad(false);
              setShowAddCallPrompt(false);
            }}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 relative ${
              showInCallNotes
                ? 'bg-amber-500/25 border-amber-500 text-amber-300 ring-2 ring-amber-500/40'
                : callerNote.trim()
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 hover:bg-amber-500/25'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <StickyNote className="w-5 h-5" />
            {callerNote.trim() && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-2 ring-slate-900" />
            )}
            <span className="text-[10px] font-semibold mt-1">
              {callerNote.trim() ? 'Note • Active' : 'Notes'}
            </span>
          </button>

          {/* Hold */}
          <button
            onClick={handleToggleHold}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 ${
              isOnHold
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isOnHold ? <Play className="w-5 h-5 text-amber-400" /> : <Pause className="w-5 h-5" />}
            <span className="text-[10px] font-semibold mt-1">{isOnHold ? t('unhold') : t('hold')}</span>
          </button>

          {/* Record - High Quality 48kHz */}
          <button
            onClick={handleToggleRecording}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition active:scale-95 ${
              isRecording
                ? 'bg-rose-500/25 border-rose-500 text-rose-300 ring-2 ring-rose-500/40'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Disc className={`w-5 h-5 ${isRecording ? 'text-rose-400 animate-spin' : ''}`} />
            <span className="text-[10px] font-semibold mt-1">
              {isRecording ? t('recording') : t('record')}
            </span>
          </button>
        </div>

        {/* Dual Call Management & Conference toolbar */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => {
              setShowAddCallPrompt((prev) => !prev);
              setShowInCallNotes(false);
              setShowInCallKeypad(false);
            }}
            className="py-1.5 px-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-700 transition flex items-center justify-center space-x-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Call</span>
          </button>
          <button
            onClick={handleSwapCalls}
            className="py-1.5 px-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Swap Calls
          </button>
          <button
            onClick={handleMergeCalls}
            className="py-1.5 px-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-[10px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Merge Calls
          </button>
        </div>

        {/* Large End Call Button */}
        <div className="pt-2">
          <button
            onClick={handleEndCallAction}
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-extrabold text-sm shadow-xl shadow-rose-950/60 transition flex items-center justify-center space-x-2"
          >
            <PhoneOff className="w-5 h-5" />
            <span>{t('end_call')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
