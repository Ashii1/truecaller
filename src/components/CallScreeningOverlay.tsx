import { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Phone, PhoneOff, Ban, Send, Sparkles, Volume2, VolumeX, MessageSquare, AlertTriangle, ShieldAlert } from 'lucide-react';
import { IncomingCallState, ScreeningTranscriptEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';

interface CallScreeningOverlayProps {
  call: IncomingCallState;
  onPickUp: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
  onHangUp: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
  onBlockSpam: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
}

const PRESET_REPLIES = [
  'Can you call back later?',
  "I'm in a meeting right now.",
  'Please remove my number from your list.',
  'Send me a text message instead.',
  'Who is calling, please repeat clearly.',
];

export default function CallScreeningOverlay({ call, onPickUp, onHangUp, onBlockSpam }: CallScreeningOverlayProps) {
  const [transcript, setTranscript] = useState<ScreeningTranscriptEntry[]>([]);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [customReply, setCustomReply] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !isAudioMuted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onstart = () => setIsAssistantSpeaking(true);
        utterance.onend = () => setIsAssistantSpeaking(false);
        utterance.onerror = () => setIsAssistantSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsAssistantSpeaking(false);
      }
    }
  };

  useEffect(() => {
    // Do not fabricate caller speech. The previous implementation inserted
    // hard-coded courier/bank/contractor text, which made the AI appear to
    // understand the remote party even when no call audio had been transcribed.
    setTranscript([{
      id: 'screening-status',
      sender: 'assistant',
      text: 'Hi, who is calling and what is this regarding?',
      timestamp: Date.now(),
    }]);
    speakText('Hi, who is calling and what is this regarding?');

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [call.number]);

  const handleSendReply = (replyText: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const entry: ScreeningTranscriptEntry = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: trimmed,
      timestamp: Date.now(),
    };
    setTranscript((prev) => [...prev, entry]);
    setCustomReply('');
    speakText(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
      <div className="flex h-full max-h-[640px] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-indigo-500/40 bg-[#0c121c] shadow-2xl shadow-indigo-950/50">
        <header className="border-b border-slate-800 bg-[#080d14] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40">
                <Bot className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-white">Live AI Call Screener</h2>
                  <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.2 text-[10px] font-bold text-indigo-300">Active</span>
                </div>
                <p className="text-[11px] text-slate-400">Assistant is screening this call for you</p>
              </div>
            </div>
            <button
              onClick={() => setIsAudioMuted((v) => !v)}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800"
              title={isAudioMuted ? 'Unmute Assistant Voice' : 'Mute Assistant Voice'}
            >
              {isAudioMuted ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">{call.callerName || formatPhoneNumber(call.number)}</div>
              <div className="text-[11px] font-mono text-slate-400">{formatPhoneNumber(call.number)} {call.location ? `· ${call.location}` : ''}</div>
            </div>
            {call.isNeighborSpoof && (
              <span className="ml-2 flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Neighbor Spoof
              </span>
            )}
            {call.isSpam && !call.isNeighborSpoof && (
              <span className="ml-2 flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                <ShieldAlert className="h-3 w-3" /> Spam Risk
              </span>
            )}
          </div>

          {detectedIntent && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-indigo-300">
              <Sparkles className="h-3 w-3 text-indigo-400 shrink-0" />
              <span>Detected Intent: <strong className="text-white">{detectedIntent}</strong></span>
            </div>
          )}
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4 select-text">
          <div className="text-center text-[10px] font-medium uppercase tracking-wider text-slate-500">Real-Time Audio Transcription</div>

          {transcript.map((item) => (
            <div key={item.id} className={`flex flex-col ${item.sender === 'assistant' ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
                {item.sender === 'assistant' ? (
                  <><span className="font-semibold text-indigo-400">CallShield Assistant</span><Bot className="h-3 w-3 text-indigo-400" /></>
                ) : (
                  <><Mic className="h-3 w-3 text-emerald-400" /><span className="font-semibold text-emerald-400">Caller</span></>
                )}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${item.sender === 'assistant' ? 'rounded-tr-sm bg-indigo-600/90 text-white shadow-sm' : 'rounded-tl-sm border border-slate-700 bg-slate-800 text-slate-100'}`}>
                {item.text}
              </div>
            </div>
          ))}

          {transcript.length === 1 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-200">
              Listening for the remote caller's actual speech. No caller words will be invented.
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        <div className="border-t border-slate-800/80 bg-[#090e16] px-3 pt-2 pb-1">
          <div className="mb-1 text-[10px] font-semibold text-slate-400 flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-indigo-400" />
            <span>Assistant Quick Responses:</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {PRESET_REPLIES.map((reply, idx) => (
              <button key={idx} type="button" onClick={() => handleSendReply(reply)} className="whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-indigo-500 hover:bg-slate-700 active:scale-95 shrink-0">
                {reply}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSendReply(customReply); }} className="mt-1 flex items-center gap-1.5">
            <input type="text" value={customReply} onChange={(e) => setCustomReply(e.target.value)} placeholder="Type a custom reply for AI to speak..." className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
            <button type="submit" disabled={!customReply.trim()} className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40">
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        <footer className="grid grid-cols-3 gap-2 border-t border-slate-800 bg-[#060a10] p-3">
          <button type="button" onClick={() => onBlockSpam(transcript, detectedIntent)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-rose-600/50 bg-rose-950/40 text-rose-300 transition hover:bg-rose-900/60 active:scale-95">
            <Ban className="h-4 w-4" /><span className="mt-0.5 text-[10px] font-bold">Block Spam</span>
          </button>
          <button type="button" onClick={() => onHangUp(transcript, detectedIntent)} className="flex h-12 flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 active:scale-95">
            <PhoneOff className="h-4 w-4" /><span className="mt-0.5 text-[10px] font-bold">Hang Up</span>
          </button>
          <button type="button" onClick={() => onPickUp(transcript, detectedIntent)} className="flex h-12 flex-col items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95">
            <Phone className="h-4 w-4 fill-current" /><span className="mt-0.5 text-[10px] font-extrabold">Pick Up</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
