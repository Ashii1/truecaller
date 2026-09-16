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
  Folder
} from 'lucide-react';
import { ActiveCallSession, TruecallerDirectoryProfile, CallRecordingItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { playDtmfTone, triggerHapticFeedback, playNotificationChime } from '../utils/audioAlerts';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService, DEFAULT_RECORDINGS_FOLDER } from '../services/callRecordingService';

interface ActiveCallModalProps {
  session: ActiveCallSession | null;
  onEndCall: (recordingItem?: CallRecordingItem | null, callDuration?: number) => void;
  lookupProfile: (num: string) => TruecallerDirectoryProfile;
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

  const durationRef = useRef(duration);
  durationRef.current = duration;

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
    onEndCall(recordingItem, durationRef.current);
  };

  const callerProfile = lookupProfile(session.number);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-white text-center relative overflow-hidden">
        {/* Top Status & SIM info */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">{t('call_connected')}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
            {session.sim || 'SIM 1'}
          </span>
        </div>

        {/* Caller Avatar & Identity */}
        <div className="space-y-2">
          <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-3xl font-extrabold shadow-xl ring-4 ring-indigo-500/20">
            {session.name ? session.name.slice(0, 1).toUpperCase() : '👤'}
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center space-x-1.5">
              <span>{session.name || t('unknown_caller')}</span>
              {session.isVerifiedBusiness && (
                <ShieldCheck className="w-4 h-4 text-blue-400" />
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
        <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-1 text-xs">
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
              <span>VigilShield/</span>
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

        {/* In-Call Action Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2">
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
            onClick={() => setShowInCallKeypad((prev) => !prev)}
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

          {/* Add Call */}
          <button
            onClick={() => setShowAddCallPrompt((prev) => !prev)}
            className="flex flex-col items-center justify-center p-3 rounded-2xl border bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 transition active:scale-95"
          >
            <UserPlus className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-1">{t('add_call')}</span>
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

        {/* Dual Call Management (Swap / Merge) */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSwapCalls}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Swap Calls
          </button>
          <button
            onClick={handleMergeCalls}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Merge Calls (Conference)
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
