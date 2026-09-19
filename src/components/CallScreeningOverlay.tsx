import { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Ban, 
  Send, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  AlertTriangle, 
  ShieldAlert, 
  Radio, 
  Loader2,
  Play
} from 'lucide-react';
import { IncomingCallState, ScreeningTranscriptEntry } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import WaveformRippleVisualizer from './common/WaveformRippleVisualizer';
import { getAiCallerDialogue } from '../services/aiScreenerService';

interface CallScreeningOverlayProps {
  call: IncomingCallState;
  onPickUp: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
  onHangUp: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
  onBlockSpam: (transcript: ScreeningTranscriptEntry[], intent: string | null) => void;
}

const CALLER_QUICK_TEST_SCENARIOS = [
  { label: '📦 Courier Delivery', text: "Hi, I have a package from FedEx that requires a signature at the door." },
  { label: '🏦 Bank Fraud Alert', text: "Hello, this is Chase Bank fraud prevention regarding an urgent $920 card charge." },
  { label: '🩺 Clinic Appointment', text: "Calling from Dr. Patel's medical clinic to confirm your 2:30 PM appointment tomorrow." },
  { label: '💸 Loan Telemarketer', text: "Good day, you are pre-approved for a zero percent interest personal debt consolidation loan." },
];

export default function CallScreeningOverlay({ call, onPickUp, onHangUp, onBlockSpam }: CallScreeningOverlayProps) {
  const [transcript, setTranscript] = useState<ScreeningTranscriptEntry[]>([]);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isListeningCallerMic, setIsListeningCallerMic] = useState(false);
  const [callerInputText, setCallerInputText] = useState('');
  const [customReply, setCustomReply] = useState('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [detectedIntent, setDetectedIntent] = useState<string | null>(null);
  const [dynamicSuggestedReplies, setDynamicSuggestedReplies] = useState<string[]>([
    'Can you please call back later?',
    'I am in an important meeting right now.',
    'Please send me a text message instead.',
    'Remove my phone number from your list.',
  ]);
  const [autoConverse, setAutoConverse] = useState(true);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isAiThinking]);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !isAudioMuted) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsAssistantSpeaking(true);
        utterance.onend = () => setIsAssistantSpeaking(false);
        utterance.onerror = () => setIsAssistantSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsAssistantSpeaking(false);
      }
    }
  };

  // Initial greeting
  useEffect(() => {
    const greeting = 'Hello, you have reached CallShield AI Screening. Who is calling and what is this regarding?';
    setTranscript([{
      id: 'screening-greeting',
      sender: 'assistant',
      text: greeting,
      timestamp: Date.now(),
    }]);
    speakText(greeting);

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [call.number]);

  // Handle incoming caller speech (either from mic, test buttons, or typed input)
  const handleReceiveCallerSpeech = async (spokenWords: string) => {
    const trimmed = spokenWords.trim();
    if (!trimmed) return;

    const callerEntry: ScreeningTranscriptEntry = {
      id: `caller-${Date.now()}`,
      sender: 'caller',
      text: trimmed,
      timestamp: Date.now(),
    };

    const newTranscript = [...transcript, callerEntry];
    setTranscript(newTranscript);
    setCallerInputText('');

    // If Auto-Converse is active, generate dynamic Gemini AI response
    setIsAiThinking(true);
    try {
      const dialogue = await getAiCallerDialogue({
        callerNumber: call.number,
        callerName: call.callerName,
        callerLatestSpeech: trimmed,
        transcript: newTranscript,
        riskScore: call.riskScore,
        spamCategory: call.spamCategory,
      });

      setIsAiThinking(false);

      if (dialogue.detectedIntent) {
        setDetectedIntent(dialogue.detectedIntent);
      }

      if (dialogue.suggestedUserReplies && dialogue.suggestedUserReplies.length > 0) {
        setDynamicSuggestedReplies(dialogue.suggestedUserReplies);
      }

      if (autoConverse && dialogue.aiAssistantSpeech) {
        const assistantEntry: ScreeningTranscriptEntry = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: dialogue.aiAssistantSpeech,
          timestamp: Date.now(),
        };
        setTranscript((prev) => [...prev, assistantEntry]);
        speakText(dialogue.aiAssistantSpeech);
      }
    } catch (e) {
      setIsAiThinking(false);
      console.error('Error generating AI caller dialogue:', e);
    }
  };

  // User manually chooses a suggested reply or types one for the AI to speak
  const handleSendAssistantReply = (replyText: string) => {
    const trimmed = replyText.trim();
    if (!trimmed) return;

    const entry: ScreeningTranscriptEntry = {
      id: `assistant-${Date.now()}`,
      sender: 'assistant',
      text: trimmed,
      timestamp: Date.now(),
    };
    setTranscript((prev) => [...prev, entry]);
    setCustomReply('');
    speakText(trimmed);
  };

  // Optional live microphone transcription for caller side
  const toggleCallerMic = () => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. You can type caller words or use the simulation chips below.');
      return;
    }

    if (isListeningCallerMic) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListeningCallerMic(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListeningCallerMic(true);
      };

      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript;
        if (text) {
          handleReceiveCallerSpeech(text);
        }
      };

      recognition.onerror = () => {
        setIsListeningCallerMic(false);
      };

      recognition.onend = () => {
        setIsListeningCallerMic(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Microphone start error:', err);
      setIsListeningCallerMic(false);
    }
  };

  const isWaveformActive = isAssistantSpeaking || isAiThinking || isListeningCallerMic;
  const waveformColor = call.isSpam ? 'rose' : isAssistantSpeaking ? 'indigo' : isAiThinking ? 'amber' : 'emerald';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md">
      <div className="flex h-full max-h-[720px] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-indigo-500/40 bg-[#0c121c] shadow-2xl shadow-indigo-950/60">
        
        {/* Header with Live AI Waveform & Caller Identity */}
        <header className="border-b border-slate-800 bg-[#080d14] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40">
                <Bot className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Live AI Caller Assistance</h2>
                  <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                    Two-Way Gemini
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isAssistantSpeaking ? 'Assistant speaking to caller...' : isAiThinking ? 'Gemini thinking & analyzing...' : 'Listening & conversing in real time'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoConverse(v => !v)}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-bold border transition ${
                  autoConverse 
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
                title="Toggle automated two-way AI dialog with caller"
              >
                <Radio className={`h-3 w-3 ${autoConverse ? 'animate-pulse text-indigo-400' : ''}`} />
                <span>{autoConverse ? 'Auto-Converse' : 'Manual'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAudioMuted((v) => !v)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800"
                title={isAudioMuted ? 'Unmute Assistant Voice' : 'Mute Assistant Voice'}
              >
                {isAudioMuted ? <VolumeX className="h-4 w-4 text-amber-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Caller Profile Card */}
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-900/90 border border-slate-800 p-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-white">{call.callerName || formatPhoneNumber(call.number)}</div>
              <div className="text-[11px] font-mono text-slate-400">
                {formatPhoneNumber(call.number)} {call.location ? `· ${call.location}` : ''}
              </div>
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

          {/* Real-Time Waveform and Ripple Graphic */}
          <div className="mt-2 rounded-xl bg-slate-950/80 border border-slate-800/80 px-3 py-1.5">
            <WaveformRippleVisualizer
              active={isWaveformActive}
              variant="both"
              colorTheme={waveformColor}
              barCount={24}
              height={26}
              statusLabel={
                isAssistantSpeaking 
                  ? 'Speaking to remote caller...' 
                  : isAiThinking 
                  ? 'Gemini processing caller statement...' 
                  : isListeningCallerMic
                  ? 'Microphone active: Listening for caller speech...'
                  : 'AI Screener Active: Ready for two-way dialogue'
              }
              subLabel={detectedIntent ? `Intent: ${detectedIntent}` : 'Channel Open'}
              compact
            />
          </div>
        </header>

        {/* Live Conversation Transcript */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4 select-text">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-500 uppercase px-1">
            <span>Two-Way Spoken Transcript</span>
            <span className="text-indigo-400 font-normal">Real-Time Dialogue</span>
          </div>

          {transcript.map((item) => (
            <div key={item.id} className={`flex flex-col ${item.sender === 'assistant' ? 'items-end' : 'items-start'}`}>
              <div className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
                {item.sender === 'assistant' ? (
                  <><span className="font-semibold text-indigo-400">CallShield Assistant</span><Bot className="h-3 w-3 text-indigo-400" /></>
                ) : (
                  <><Mic className="h-3 w-3 text-emerald-400" /><span className="font-semibold text-emerald-400">Caller</span></>
                )}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                item.sender === 'assistant' 
                  ? 'rounded-tr-sm bg-indigo-600 text-white shadow-md' 
                  : 'rounded-tl-sm border border-slate-700 bg-slate-850 text-slate-100'
              }`}>
                {item.text}
              </div>
            </div>
          ))}

          {isAiThinking && (
            <div className="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-2.5 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Assistant is generating dynamic contextual reply to caller...</span>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Caller Speech Testing & Input Bar (Allows true two-way communication) */}
        <div className="border-t border-slate-800 bg-[#090e18] px-3 pt-2 pb-1.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-300 flex items-center gap-1.5">
              <Mic className="h-3 w-3 text-emerald-400" />
              <span>Caller Speech Simulation & Mic:</span>
            </span>
            <span className="text-[10px] text-slate-400">Click scenario or speak</span>
          </div>

          {/* Quick Scenario Chips for testing caller communication */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CALLER_QUICK_TEST_SCENARIOS.map((scen, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleReceiveCallerSpeech(scen.text)}
                className="whitespace-nowrap rounded-lg border border-slate-750 bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-emerald-500 hover:bg-slate-750 active:scale-95 shrink-0 flex items-center gap-1"
              >
                <Play className="h-2.5 w-2.5 text-emerald-400" />
                <span>{scen.label}</span>
              </button>
            ))}
          </div>

          {/* Caller Input field & Mic */}
          <form 
            onSubmit={(e) => { 
              e.preventDefault(); 
              handleReceiveCallerSpeech(callerInputText); 
            }} 
            className="flex items-center gap-1.5"
          >
            <input
              type="text"
              value={callerInputText}
              onChange={(e) => setCallerInputText(e.target.value)}
              placeholder="Type what caller says (or tap scenarios above)..."
              className="flex-1 rounded-xl border border-slate-750 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={toggleCallerMic}
              className={`p-2 rounded-xl border transition ${
                isListeningCallerMic 
                  ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
              title={isListeningCallerMic ? 'Stop microphone' : 'Speak as caller using microphone'}
            >
              {isListeningCallerMic ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            <button
              type="submit"
              disabled={!callerInputText.trim() || isAiThinking}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold transition hover:bg-emerald-500 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>

        {/* Assistant Response & Dynamic Suggestions */}
        <div className="border-t border-slate-800 bg-[#070b12] px-3 pt-2 pb-1.5">
          <div className="mb-1 text-[10px] font-semibold text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-indigo-400" />
              <span>Dynamic AI Suggested Responses:</span>
            </div>
            <span className="text-[10px] text-indigo-300">Contextual to caller</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
            {dynamicSuggestedReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendAssistantReply(reply)}
                className="whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-indigo-500 hover:bg-slate-700 active:scale-95 shrink-0"
              >
                {reply}
              </button>
            ))}
          </div>

          <form 
            onSubmit={(e) => { 
              e.preventDefault(); 
              handleSendAssistantReply(customReply); 
            }} 
            className="mt-1 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={customReply}
              onChange={(e) => setCustomReply(e.target.value)}
              placeholder="Direct assistant custom speech..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customReply.trim()}
              className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        {/* Call Management Footer */}
        <footer className="grid grid-cols-3 gap-2 border-t border-slate-800 bg-[#05080e] p-3">
          <button
            type="button"
            onClick={() => onBlockSpam(transcript, detectedIntent)}
            className="flex h-11 flex-col items-center justify-center rounded-xl border border-rose-600/50 bg-rose-950/40 text-rose-300 transition hover:bg-rose-900/60 active:scale-95"
          >
            <Ban className="h-4 w-4" /><span className="mt-0.5 text-[10px] font-bold">Block Spam</span>
          </button>
          <button
            type="button"
            onClick={() => onHangUp(transcript, detectedIntent)}
            className="flex h-11 flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition hover:bg-slate-700 active:scale-95"
          >
            <PhoneOff className="h-4 w-4" /><span className="mt-0.5 text-[10px] font-bold">Hang Up</span>
          </button>
          <button
            type="button"
            onClick={() => onPickUp(transcript, detectedIntent)}
            className="flex h-11 flex-col items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
          >
            <Phone className="h-4 w-4 fill-current" /><span className="mt-0.5 text-[10px] font-extrabold">Pick Up</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
