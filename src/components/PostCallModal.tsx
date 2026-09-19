import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Check,
  X,
  UserPlus,
  ShieldBan,
  Phone,
  MessageSquare,
  Clock,
  CalendarClock,
  ShieldCheck,
  Flag,
  Copy,
  Bot,
  Sparkles,
  ChevronDown,
  Send,
  Briefcase,
  User,
  Package,
  HeartPulse,
  CreditCard,
  Wrench,
  Zap,
  CheckCircle2,
  UserCheck,
  FileText,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PostCallState, SpamCategory, ContactItem, CallLogItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import { useI18n } from '../i18n/LanguageContext';
import WaveformRippleVisualizer from './common/WaveformRippleVisualizer';

interface PostCallModalProps {
  postCall: PostCallState | null;
  onDismiss: () => void;
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onBlockNumber: (number: string, label: string) => void;
  onReportSpam: (number: string, category: SpamCategory, reason: string) => void;
  onSaveNote: (number: string, note: string) => void;
  onInitiateCall?: (number: string, name?: string) => void;
  onMarkSafe?: (number: string, name: string) => void;
  contacts?: ContactItem[];
  calls?: CallLogItem[];
  onRegenerateSummary?: (callId: string) => void;
}

const CONTEXT_TAGS = [
  { id: 'WORK', label: 'Work', icon: Briefcase, color: 'border-blue-500/30 text-blue-300 bg-blue-500/10' },
  { id: 'PERSONAL', label: 'Personal', icon: User, color: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' },
  { id: 'DELIVERY', label: 'Delivery', icon: Package, color: 'border-amber-500/30 text-amber-300 bg-amber-500/10' },
  { id: 'HEALTHCARE', label: 'Healthcare', icon: HeartPulse, color: 'border-rose-500/30 text-rose-300 bg-rose-500/10' },
  { id: 'FINANCE', label: 'Finance', icon: CreditCard, color: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10' },
  { id: 'SERVICE', label: 'Service', icon: Wrench, color: 'border-purple-500/30 text-purple-300 bg-purple-500/10' },
  { id: 'URGENT', label: 'Urgent', icon: Zap, color: 'border-yellow-500/30 text-yellow-300 bg-yellow-500/10' },
] as const;

const QUICK_SMS_TEMPLATES = [
  "I'll call you right back.",
  "Thanks for the call!",
  "Please text me the details.",
  "Can we discuss this tomorrow?",
];

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default function PostCallModal({
  postCall,
  onDismiss,
  onAddContact,
  onBlockNumber,
  onReportSpam,
  onSaveNote,
  onInitiateCall,
  onMarkSafe,
  contacts = [],
  calls = [],
}: PostCallModalProps) {
  const { t } = useI18n();

  // Active sub-panels
  const [activePanel, setActivePanel] = useState<'NONE' | 'SMS' | 'REMINDER' | 'REPORT' | 'ADD_CONTACT'>('NONE');

  // SMS state
  const [smsMessage, setSmsMessage] = useState('');

  // Reminder state
  const [reminderMinutes, setReminderMinutes] = useState(60);
  const [reminderLabel, setReminderLabel] = useState('');

  // Contact save state
  const [contactName, setContactName] = useState('');
  const [contactCategory, setContactCategory] = useState<'GENERAL' | 'FAMILY' | 'WORK' | 'SERVICES' | 'VIP'>('GENERAL');

  // Spam report state
  const [spamCategory, setSpamCategory] = useState<SpamCategory>('TELEMARKETING');
  const [spamNotes, setSpamNotes] = useState('');

  // Note and tag state
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [noteText, setNoteText] = useState('');
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);

  // Transcript and copy state
  const [showTranscript, setShowTranscript] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const cleanNumber = postCall ? normalizePhone(postCall.number) : '';

  // Check if contact already exists
  const matchedContact = useMemo(() => {
    if (!cleanNumber) return null;
    return contacts.find(c => normalizePhone(c.number) === cleanNumber) || null;
  }, [cleanNumber, contacts]);

  // Caller history stats
  const historyStats = useMemo(() => {
    if (!cleanNumber) return { count: 1, totalMinutes: 0, missed: 0 };
    const matching = calls.filter(c => normalizePhone(c.number) === cleanNumber);
    const count = matching.length > 0 ? matching.length : 1;
    const totalSec = matching.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const missed = matching.filter(c => (c.type || '').toUpperCase().includes('MISSED')).length;
    return { count, totalMinutes: Math.max(1, Math.round(totalSec / 60)), missed };
  }, [cleanNumber, calls]);

  // Load existing notes and tags on mount
  useEffect(() => {
    if (!postCall) return;
    setContactName(postCall.name || '');

    // Load tag
    try {
      const tagMap = JSON.parse(localStorage.getItem('vigilshield_call_context_v1') || '{}');
      if (tagMap[cleanNumber]) {
        setSelectedTag(tagMap[cleanNumber]);
      }
    } catch {}

    // Load note
    let existingNote = postCall.notes || '';
    if (!existingNote) {
      try {
        const notesMap = JSON.parse(localStorage.getItem('vigilshield_call_notes_v1') || '{}');
        existingNote = notesMap[cleanNumber] || '';
      } catch {}
    }
    setNoteText(existingNote);
  }, [postCall, cleanNumber]);

  if (!postCall) return null;

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 2500);
  };

  // Handle Redial / Callback
  const handleCallback = () => {
    if (onInitiateCall) {
      onInitiateCall(postCall.number, postCall.name);
      onDismiss();
    } else {
      window.location.href = `tel:${postCall.number}`;
    }
  };

  // Handle Quick SMS
  const handleSendSms = (textToSend: string) => {
    const finalMsg = textToSend.trim();
    if (!finalMsg) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(finalMsg);
    }

    // Trigger device SMS intent
    window.location.href = `sms:${postCall.number}?body=${encodeURIComponent(finalMsg)}`;
    showFeedback('SMS app opened & message copied to clipboard');
    setActivePanel('NONE');
  };

  // Handle Adding Callback Reminder
  const handleSaveReminder = () => {
    const PREF_KEY = 'vigilshield_permission_center_v1';
    try {
      const raw = localStorage.getItem(PREF_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const existing = Array.isArray(data.reminders) ? data.reminders : [];
      const dueAt = Date.now() + reminderMinutes * 60 * 1000;
      const label = reminderLabel.trim() || `Call back ${postCall.name || formatPhoneNumber(postCall.number)}`;

      const newReminder = {
        id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        number: postCall.number,
        label,
        dueAt,
        done: false,
      };

      data.reminders = [newReminder, ...existing].slice(0, 50);
      localStorage.setItem(PREF_KEY, JSON.stringify(data));

      const timeStr = new Date(dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      showFeedback(`Follow-up reminder set for ${timeStr}`);
      setActivePanel('NONE');
    } catch {
      showFeedback('Reminder saved');
      setActivePanel('NONE');
    }
  };

  // Handle Tag Selection
  const handleSelectTag = (tagId: string) => {
    const nextTag = selectedTag === tagId ? '' : tagId;
    setSelectedTag(nextTag);
    try {
      const tagMap = JSON.parse(localStorage.getItem('vigilshield_call_context_v1') || '{}');
      if (nextTag) {
        tagMap[cleanNumber] = nextTag;
      } else {
        delete tagMap[cleanNumber];
      }
      localStorage.setItem('vigilshield_call_context_v1', JSON.stringify(tagMap));
    } catch {}
  };

  // Handle Note Save
  const handleSaveNoteChange = (text: string) => {
    setNoteText(text);
    onSaveNote(postCall.number, text);
    try {
      const notesMap = JSON.parse(localStorage.getItem('vigilshield_call_notes_v1') || '{}');
      if (text.trim()) {
        notesMap[cleanNumber] = text.trim();
      } else {
        delete notesMap[cleanNumber];
      }
      localStorage.setItem('vigilshield_call_notes_v1', JSON.stringify(notesMap));
    } catch {}
    setNoteSavedNotice(true);
    setTimeout(() => setNoteSavedNotice(false), 1800);
  };

  // Handle Save Contact
  const handleSaveNewContact = (e: FormEvent) => {
    e.preventDefault();
    const nm = contactName.trim() || postCall.name || 'Caller';
    onAddContact({
      name: nm,
      number: postCall.number,
      category: contactCategory,
      trusted: true,
      isFavorite: false,
      notes: noteText || selectedTag || '',
    });
    showFeedback(`Saved ${nm} to contacts`);
    setActivePanel('NONE');
  };

  // Handle Block
  const handleBlock = () => {
    onBlockNumber(postCall.number, postCall.name || 'Blocked from Call Ended');
    showFeedback('Number blocked and added to firewall');
    setTimeout(onDismiss, 1000);
  };

  // Handle Mark as Trusted / Safe
  const handleTrustCaller = () => {
    if (onMarkSafe) {
      onMarkSafe(postCall.number, postCall.name || 'Trusted Caller');
      showFeedback('Number whitelisted & verified safe');
    }
  };

  // Handle Spam Report
  const handleSubmitSpamReport = (e: FormEvent) => {
    e.preventDefault();
    onReportSpam(postCall.number, spamCategory, spamNotes);
    showFeedback('Spam threat report submitted to community');
    setTimeout(onDismiss, 1200);
  };

  // Copy Summary
  const handleCopySummary = () => {
    const bulletsText = (postCall.screeningSummaryBullets || []).map(b => `• ${b}`).join('\n');
    const fullText = bulletsText || postCall.screeningSummary || '';
    if (fullText && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const [isPlayingSummaryAudio, setIsPlayingSummaryAudio] = useState(false);

  // Play audio aloud for AI summary
  const handleTogglePlaySummaryAudio = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isPlayingSummaryAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingSummaryAudio(false);
      return;
    }
    const textToRead = (postCall.screeningSummaryBullets && postCall.screeningSummaryBullets.length > 0)
      ? postCall.screeningSummaryBullets.join('. ')
      : postCall.screeningSummary || '';
    if (!textToRead) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsPlayingSummaryAudio(true);
    utterance.onend = () => setIsPlayingSummaryAudio(false);
    utterance.onerror = () => setIsPlayingSummaryAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const hasScreeningInfo = Boolean(
    postCall.usedAiScreener ||
    (postCall.screeningSummaryBullets && postCall.screeningSummaryBullets.length > 0) ||
    postCall.screeningSummary ||
    (postCall.screeningTranscript && postCall.screeningTranscript.length > 0)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto bg-[#0c121d] border border-slate-800/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 text-white">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white">{t('post_call_title')}</h3>
              <p className="text-[11px] text-slate-400">
                Duration: <strong className="text-slate-200">{postCall.durationStr || `${postCall.durationSeconds || 0}s`}</strong>
                {postCall.sim && <span> • {postCall.sim}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Caller Identity Card */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border font-black text-base shadow-inner ${
              postCall.isSpam
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : matchedContact
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                : 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
            }`}>
              {(postCall.name || 'Caller').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white truncate">
                {postCall.name || formatPhoneNumber(postCall.number)}
              </div>
              <div className="text-xs font-medium text-slate-400 font-mono mt-0.5">
                {formatPhoneNumber(postCall.number)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {matchedContact ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <UserCheck className="w-3 h-3" />
                    Saved Contact
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Unsaved Number
                  </span>
                )}
                {postCall.isSpam && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Suspicious / Threat
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* History Count Pill */}
          <div className="text-right shrink-0">
            <div className="text-xs font-extrabold text-slate-200">
              {historyStats.count} {historyStats.count === 1 ? 'call' : 'calls'}
            </div>
            <div className="text-[10.5px] text-slate-500">
              {historyStats.totalMinutes}m talk time
            </div>
          </div>
        </div>

        {/* PRIMARY PURPOSEFUL ACTION BAR (4 Essential Actions) */}
        <div className="grid grid-cols-4 gap-2">
          {/* 1. Call Back */}
          <button
            id="post-call-redial-btn"
            type="button"
            onClick={handleCallback}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 active:scale-98 transition group"
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white shadow-sm mb-1 group-hover:scale-105 transition">
              <Phone className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold">Call Back</span>
          </button>

          {/* 2. Quick SMS */}
          <button
            id="post-call-sms-btn"
            type="button"
            onClick={() => setActivePanel(activePanel === 'SMS' ? 'NONE' : 'SMS')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border active:scale-98 transition group ${
              activePanel === 'SMS'
                ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                : 'bg-blue-600/15 border-blue-500/30 text-blue-300 hover:bg-blue-600/25'
            }`}
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500 text-white shadow-sm mb-1 group-hover:scale-105 transition">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold">Message</span>
          </button>

          {/* 3. Add to Contacts / View Contact */}
          {matchedContact ? (
            <button
              id="post-call-contact-saved-btn"
              type="button"
              onClick={() => showFeedback(`Already in contacts as ${matchedContact.name}`)}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-slate-850 border border-slate-700/80 text-slate-300 hover:bg-slate-800 active:scale-98 transition group"
            >
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-slate-700 text-slate-200 shadow-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[11px] font-bold">In Contacts</span>
            </button>
          ) : (
            <button
              id="post-call-add-contact-btn"
              type="button"
              onClick={() => setActivePanel(activePanel === 'ADD_CONTACT' ? 'NONE' : 'ADD_CONTACT')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border active:scale-98 transition group ${
                activePanel === 'ADD_CONTACT'
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-indigo-600/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25'
              }`}
            >
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500 text-white shadow-sm mb-1 group-hover:scale-105 transition">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold">Add Contact</span>
            </button>
          )}

          {/* 4. Follow-up Reminder */}
          <button
            id="post-call-reminder-btn"
            type="button"
            onClick={() => setActivePanel(activePanel === 'REMINDER' ? 'NONE' : 'REMINDER')}
            className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border active:scale-98 transition group ${
              activePanel === 'REMINDER'
                ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                : 'bg-amber-600/15 border-amber-500/30 text-amber-300 hover:bg-amber-600/25'
            }`}
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500 text-white shadow-sm mb-1 group-hover:scale-105 transition">
              <CalendarClock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold">Remind Me</span>
          </button>
        </div>

        {/* SUB-PANEL 1: Quick SMS Drawer */}
        {activePanel === 'SMS' && (
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span>Quick SMS to {postCall.name || postCall.number}</span>
              </div>
              <button onClick={() => setActivePanel('NONE')} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Template Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SMS_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSmsMessage(tmpl)}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-blue-500/20 text-[11px] text-blue-200 hover:border-blue-400 transition text-left"
                >
                  {tmpl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={smsMessage}
                onChange={e => setSmsMessage(e.target.value)}
                placeholder="Type custom text message..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleSendSms(smsMessage)}
                disabled={!smsMessage.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 disabled:opacity-40 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {/* SUB-PANEL 2: Follow-up Reminder Drawer */}
        {activePanel === 'REMINDER' && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Schedule Follow-up Reminder</span>
              </div>
              <button onClick={() => setActivePanel('NONE')} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Timing Quick Chips */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { min: 15, label: 'In 15 mins' },
                { min: 60, label: 'In 1 hour' },
                { min: 180, label: 'In 3 hours' },
                { min: 1440, label: 'Tomorrow 9 AM' },
                { min: 2880, label: 'In 2 days' },
                { min: 10080, label: 'Next week' },
              ].map(item => (
                <button
                  key={item.min}
                  type="button"
                  onClick={() => setReminderMinutes(item.min)}
                  className={`py-2 px-2 rounded-xl border font-semibold text-center transition ${
                    reminderMinutes === item.min
                      ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reminderLabel}
                onChange={e => setReminderLabel(e.target.value)}
                placeholder={`Reason e.g. "Send proposal to ${postCall.name || 'caller'}"`}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleSaveReminder}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
              >
                Set Reminder
              </button>
            </div>
          </div>
        )}

        {/* SUB-PANEL 3: Add Contact Inline */}
        {activePanel === 'ADD_CONTACT' && (
          <form onSubmit={handleSaveNewContact} className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>Save to Contacts</span>
              </div>
              <button type="button" onClick={() => setActivePanel('NONE')} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                required
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Full Contact Name"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">Category:</span>
                {(['GENERAL', 'FAMILY', 'WORK', 'SERVICES', 'VIP'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setContactCategory(cat)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                      contactCategory === cat
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActivePanel('NONE')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Save Contact
              </button>
            </div>
          </form>
        )}

        {/* SUB-PANEL 4: Report Spam Category */}
        {activePanel === 'REPORT' && (
          <form onSubmit={handleSubmitSpamReport} className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 flex items-center space-x-1.5">
                <Flag className="w-3.5 h-3.5 text-rose-400" />
                <span>Report Spam Category</span>
              </span>
              <button type="button" onClick={() => setActivePanel('NONE')} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(['TELEMARKETING', 'ROBOCALL', 'SCAM', 'DEBT_COLLECTOR', 'CUSTOM'] as SpamCategory[]).map(cat => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSpamCategory(cat)}
                  className={`p-2 rounded-xl border text-left font-semibold transition ${
                    spamCategory === cat
                      ? 'bg-rose-600/40 border-rose-500 text-rose-100'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={spamNotes}
              onChange={e => setSpamNotes(e.target.value)}
              placeholder="What was the caller offering or saying?"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActivePanel('NONE')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
              >
                Submit Threat Report
              </button>
            </div>
          </form>
        )}

        {/* AI Voice Screener Spoken Content & Action Items (When Available) */}
        {hasScreeningInfo && (
          <section className="rounded-2xl border border-indigo-500/30 bg-[#0e1627] p-4 shadow-lg shadow-black/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">AI Spoken Call Summary</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-300">
                      <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                      Gemini
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400">Caller intent and key takeaways</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {(postCall.screeningSummaryBullets?.length || postCall.screeningSummary) && (
                  <button
                    type="button"
                    onClick={handleTogglePlaySummaryAudio}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition ${
                      isPlayingSummaryAudio
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-indigo-500/30 bg-indigo-950/60 text-indigo-200 hover:bg-indigo-900/60'
                    }`}
                    title={isPlayingSummaryAudio ? 'Pause Spoken Summary' : 'Listen to Spoken Highlights'}
                  >
                    {isPlayingSummaryAudio ? (
                      <>
                        <VolumeX className="h-3 w-3 text-emerald-400" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3 text-indigo-300" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                )}

                {(postCall.screeningSummaryBullets?.length || postCall.screeningSummary) && (
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-950/60 px-2 py-1 text-[10.5px] font-semibold text-indigo-200 transition hover:bg-indigo-900/60"
                    title="Copy bulleted summary"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 text-indigo-300" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Real-Time Audio Waveform & Ripple Animation */}
            <div className="rounded-xl border border-indigo-500/25 bg-slate-950/70 px-3 py-1">
              <WaveformRippleVisualizer
                active={postCall.isGeneratingSummary || isPlayingSummaryAudio || true}
                variant="both"
                colorTheme={postCall.wasSpam || postCall.isSpam ? 'rose' : isPlayingSummaryAudio ? 'emerald' : 'indigo'}
                barCount={24}
                height={26}
                statusLabel={
                  postCall.isGeneratingSummary
                    ? 'Gemini AI generating spoken conversation summary…'
                    : isPlayingSummaryAudio
                    ? 'Playing verified spoken audio summary…'
                    : 'AI Screening Speech Analyzed'
                }
                subLabel={postCall.screeningDetectedIntent ? `Intent: ${postCall.screeningDetectedIntent}` : 'Voice Intel'}
                compact
              />
            </div>

            {postCall.isGeneratingSummary ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-950/40 p-3 text-xs text-indigo-300">
                <Sparkles className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Generating spoken content summary with Gemini AI…</span>
              </div>
            ) : postCall.screeningSummaryBullets && postCall.screeningSummaryBullets.length > 0 ? (
              <div className="space-y-2">
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {postCall.screeningSummaryBullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                      <span className="leading-relaxed text-slate-200">{bullet}</span>
                    </li>
                  ))}
                </ul>

                {postCall.screeningDetectedIntent && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-950/30 px-2.5 py-1 text-[11px] text-indigo-300">
                    <span className="text-slate-400 font-normal">Intent:</span>
                    <strong className="text-indigo-200 font-semibold">{postCall.screeningDetectedIntent}</strong>
                  </div>
                )}
              </div>
            ) : postCall.screeningSummary ? (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-2.5 text-xs text-slate-200 leading-relaxed">
                {postCall.screeningSummary}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 text-xs text-slate-400 italic">
                Screening completed. No spoken caller statements recorded.
              </div>
            )}

            {/* Collapsible Transcript Explorer */}
            {postCall.screeningTranscript && postCall.screeningTranscript.length > 0 && (
              <div className="pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowTranscript(v => !v)}
                  className="flex w-full items-center justify-between text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition py-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                    <span>
                      {showTranscript
                        ? 'Hide spoken transcript'
                        : `View spoken transcript (${postCall.screeningTranscript.length} lines)`}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-indigo-400 transition-transform ${showTranscript ? 'rotate-180' : ''}`}
                  />
                </button>

                {showTranscript && (
                  <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-xs">
                    {postCall.screeningTranscript.map(tItem => (
                      <div
                        key={tItem.id}
                        className={`rounded-lg p-2 ${
                          tItem.sender === 'caller'
                            ? 'border-l-2 border-amber-400 bg-slate-900/90 text-slate-200'
                            : 'border-l-2 border-indigo-400 bg-indigo-950/50 text-indigo-200'
                        }`}
                      >
                        <div className="mb-0.5 flex items-center justify-between text-[9.5px] text-slate-400">
                          <span className="font-bold uppercase tracking-wider">
                            {tItem.sender === 'caller' ? 'Caller' : tItem.sender === 'user' ? 'You' : 'AI Assistant'}
                          </span>
                          <span>
                            {new Date(tItem.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="leading-snug">{tItem.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* CALL CONTEXT & INTENT TAGS (Purposeful 1-Tap Tagging) */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Call Category Tag</span>
            </span>
            {selectedTag && (
              <span className="text-[10.5px] text-cyan-400 font-semibold">
                Tagged as {selectedTag}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CONTEXT_TAGS.map(tag => {
              const Icon = tag.icon;
              const isSelected = selectedTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleSelectTag(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition ${
                    isSelected
                      ? `${tag.color} ring-1 ring-white/20 font-bold scale-102`
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tag.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CALL NOTE (Unified, auto-saving note taking) */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Private Call Note</span>
            </span>
            <div className="flex items-center gap-2">
              {noteSavedNotice && (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              {noteText && (
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(noteText);
                      showFeedback('Note copied to clipboard');
                    }
                  }}
                  className="text-[10px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              )}
            </div>
          </div>
          <textarea
            rows={2}
            value={noteText}
            onChange={e => handleSaveNoteChange(e.target.value)}
            placeholder="Add follow-up notes, discussion summary, or key agreements..."
            className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500/80 transition"
          />
        </div>

        {/* SECURITY & PROTECTION CONTROLS */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Protection:</span>
            {!postCall.isSpam ? (
              <button
                type="button"
                onClick={handleTrustCaller}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mark as Trusted</span>
              </button>
            ) : (
              <span className="text-rose-400 font-bold text-xs flex items-center gap-1">
                <ShieldBan className="w-3.5 h-3.5" /> High Risk
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActivePanel('REPORT')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:text-amber-300 hover:border-amber-500/40 transition"
            >
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={handleBlock}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold hover:bg-rose-600/30 transition"
            >
              <ShieldBan className="w-3.5 h-3.5 text-rose-400" />
              <span>Block</span>
            </button>
          </div>
        </div>

        {/* Bottom Finish Button */}
        <button
          id="post-call-done-btn"
          type="button"
          onClick={onDismiss}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-750 hover:from-slate-750 hover:to-slate-700 border border-slate-700/80 text-white font-extrabold text-xs shadow-lg active:scale-99 transition"
        >
          {t('done')}
        </button>

      </div>
    </div>
  );
}
