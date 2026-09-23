import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Ban,
  BookUser,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Disc,
  Edit2,
  ExternalLink,
  EyeOff,
  Flag,
  Folder,
  Globe,
  Info,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { CallLogItem, CallClassification, CallShieldDirectoryProfile, CallRecordingItem, ContactItem } from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService, normalizePhoneNumber } from '../services/callRecordingService';
import { externalDirectoryService } from '../services/externalDirectoryService';
import { detectNeighborSpoof, detectPingBackScam } from '../utils/spoofEngine';
import { telecomBridge } from '../services/telephony/telecomBridge';
import AudioRecordingPlayer from './AudioRecordingPlayer';

interface CallerDetailModalProps {
  call: CallLogItem | null;
  calls?: CallLogItem[];
  contacts?: ContactItem[];
  profile?: CallShieldDirectoryProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onBlockNumber: (number: string, label: string) => void;
  onMarkSafe: (number: string, name: string) => void;
  onOpenReportModal: (number: string) => void;
  onOpenDisputeModal: (number: string, name: string) => void;
  onUpdateCallerName?: (number: string, newName: string) => void;
  onAddContact?: (contact: Omit<ContactItem, 'id'>) => void;
  onOpenSmartBlock?: (number: string, pattern: string) => void;
  onInitiateCall?: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)', isPrivate?: boolean) => void;
  onSaveNote?: (callId: string, note: string) => void;
}

const formatDuration = (s: number) => {
  if (!s || s <= 0) return '0s';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export default function CallerDetailModal({
  call,
  calls = [],
  contacts = [],
  profile,
  isOpen,
  onClose,
  onBlockNumber,
  onMarkSafe,
  onOpenReportModal,
  onOpenDisputeModal,
  onUpdateCallerName,
  onAddContact,
  onOpenSmartBlock,
  onInitiateCall,
  onSaveNote,
}: CallerDetailModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'SOCIAL' | 'RECORDINGS' | 'SECURITY'>('OVERVIEW');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
  const [copiedNumberFeedback, setCopiedNumberFeedback] = useState(false);
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const [recordings, setRecordings] = useState<CallRecordingItem[]>([]);

  // Inaccuracy Report Modal State
  const [isInaccuracyModalOpen, setIsInaccuracyModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [inaccuracyCorrectedName, setInaccuracyCorrectedName] = useState('');
  const [inaccuracyReason, setInaccuracyReason] = useState('Wrong Individual');
  const [inaccuracyNotes, setInaccuracyNotes] = useState('');
  const [inaccuracySubmitCommunity, setInaccuracySubmitCommunity] = useState(true);
  const [inaccuracyFeedback, setInaccuracyFeedback] = useState<string | null>(null);
  const [contactSavedFeedback, setContactSavedFeedback] = useState(false);

  const number = call?.number || profile?.number || '';
  const key = normalizePhoneNumber(number);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('OVERVIEW');
      setEditing(false);
      setName(call?.callerName || profile?.name || '');
      setIsInaccuracyModalOpen(false);
      setInaccuracyFeedback(null);
      setContactSavedFeedback(false);
      setCopiedNumberFeedback(false);

      let existingNote = call?.notes || '';
      if (!existingNote && number) {
        try {
          const raw = localStorage.getItem('vigilshield_call_notes_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            existingNote = parsed[key] || '';
          }
        } catch {}
      }
      setNote(existingNote);

      // Load all call recordings for this specific number from device storage
      if (number) {
        callRecordingService.getRecordingsForNumber(number).then((items) => {
          const callsWithRecs = calls
            .filter((c) => normalizePhoneNumber(c.number) === key && c.recordingUri)
            .map((c) => ({
              id: `rec-call-${c.id}`,
              callId: c.id,
              number: c.number,
              callerName: c.callerName,
              timestamp: c.timestamp,
              durationSeconds: c.durationSeconds || 15,
              folderPath: 'Internal Storage/Recordings/CallShield/',
              fileName: `REC_${normalizePhoneNumber(c.number)}_${new Date(c.timestamp).toISOString().slice(0, 10)}.wav`,
              fileSizeBytes: 128000,
              mimeType: 'audio/wav',
              dataUri: c.recordingUri || '',
              quality: '48 kHz Studio HD',
            }));

          const combined = [
            ...items,
            ...callsWithRecs.filter((c) => !items.some((it) => it.dataUri === c.dataUri)),
          ];
          setRecordings(combined);
        });
      }
    }
  }, [isOpen, call, profile, number, key, calls]);

  const history = useMemo(
    () => calls.filter((c) => normalizePhoneNumber(c.number) === key).sort((a, b) => b.timestamp - a.timestamp),
    [calls, key],
  );

  // Determine whether this number is a Saved Contact in Device Contacts
  const cleanDigits = number.replace(/\D/g, '');
  const clean10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

  const effectiveContacts = useMemo(() => {
    if (contacts && contacts.length > 0) return contacts;
    try {
      const raw = localStorage.getItem('vigilshield_contacts');
      if (raw) return JSON.parse(raw) as ContactItem[];
    } catch {}
    return [];
  }, [contacts]);

  const savedContact = useMemo(() => {
    if (!cleanDigits) return null;
    return (
      effectiveContacts.find((c) => {
        const cClean = (c.number || '').replace(/\D/g, '');
        const c10 = cClean.length >= 10 ? cClean.slice(-10) : cClean;
        return cClean === cleanDigits || (clean10 && c10 === clean10);
      }) || null
    );
  }, [effectiveContacts, cleanDigits, clean10]);

  const isSavedContact = !!savedContact || !!call?.isContact;
  const savedContactName = savedContact?.name || (call?.isContact ? call.callerName : null);

  // User override (from local accuracy corrections)
  const userOverrideName = useMemo(() => {
    return externalDirectoryService.getUserNameOverride(number);
  }, [number, name]);

  // Suggested Directory Name (from CallShield community registry or public directory)
  const suggestedDirectoryName = useMemo(() => {
    if (profile?.name && profile.name !== number && !profile.name.includes('+91') && profile.name !== cleanDigits) {
      return profile.name;
    }
    if (call?.callerName && call.callerName !== number && !call.isContact) {
      return call.callerName;
    }
    return null;
  }, [profile, call, number, cleanDigits]);

  // Identity origin & primary display name resolution
  let nameOrigin: 'SAVED_CONTACT' | 'USER_OVERRIDE' | 'DIRECTORY_SUGGESTED' = 'DIRECTORY_SUGGESTED';
  let displayName = name || t('unknown_caller');

  if (userOverrideName) {
    nameOrigin = 'USER_OVERRIDE';
    displayName = userOverrideName;
  } else if (isSavedContact && savedContactName) {
    nameOrigin = 'SAVED_CONTACT';
    displayName = savedContactName;
  } else if (suggestedDirectoryName) {
    nameOrigin = 'DIRECTORY_SUGGESTED';
    displayName = suggestedDirectoryName;
  }

  const shouldRender = isOpen && (!!call || !!profile);

  useEffect(() => {
    if (isOpen) setIsClosing(false);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(onClose, 180);
  }, [isClosing, onClose]);

  const entries = history.length ? history : call ? [call] : [];
  const spamEvidence = entries.filter((c) => c.isSpam || c.classification === 'SPAM' || c.classification === 'SCAM' || c.riskScore >= 60);
  const classification: CallClassification =
    spamEvidence.some((c) => c.classification === 'SCAM') || profile?.riskLevel === 'HIGH_RISK'
      ? 'SCAM'
      : spamEvidence.length
      ? 'SPAM'
      : call?.classification || (profile?.isVerified ? 'VERIFIED' : profile?.isSpam ? 'SPAM' : 'UNKNOWN');
  const risk = Math.max(call?.riskScore || 0, profile?.spamScore || 0, ...entries.map((c) => c.riskScore || 0));
  const isSpam = classification === 'SPAM' || classification === 'SCAM' || spamEvidence.length > 0 || !!profile?.isSpam;
  const isVerified = classification === 'VERIFIED' || entries.some((c) => c.isVerifiedBusiness) || !!profile?.isVerified;

  const isNeighborSpoof = Boolean(
    call?.isNeighborSpoof ||
      (number && contacts.length > 0 && detectNeighborSpoof(number, '', contacts).isNeighborSpoof)
  );

  const isPingBackScam = Boolean(
    call?.isPingBackScam ||
      (number && detectPingBackScam(number, call?.durationSeconds || 0, call?.type === 'MISSED' ? 1 : 0).isPingBackScam)
  );

  const latestScreenedEntry =
    entries.find(
      (e) =>
        e.usedAiScreener &&
        ((e.screeningSummaryBullets && e.screeningSummaryBullets.length > 0) || e.screeningSummary)
    ) ||
    entries.find((e) => e.usedAiScreener) ||
    (call?.usedAiScreener ? call : null);

  const label =
    classification === 'SCAM'
      ? t('high_scam_risk')
      : classification === 'SPAM'
      ? t('spam_caller')
      : classification === 'SUSPICIOUS'
      ? t('suspicious_caller')
      : isVerified
      ? t('verified_caller')
      : `${t('safe_badge')} · ${t('public_directory_verified')}`;

  // Call history statistics
  const callStats = useMemo(() => {
    let totalSeconds = 0;
    let incomingCount = 0;
    let outgoingCount = 0;
    let missedCount = 0;
    let blockedCount = 0;

    entries.forEach((e) => {
      totalSeconds += e.durationSeconds || 0;
      if (e.type === 'INCOMING') incomingCount++;
      else if (e.type === 'OUTGOING') outgoingCount++;
      else if (e.type === 'MISSED') missedCount++;
      else if (e.type === 'BLOCKED_CANCELLED') blockedCount++;
    });

    const avgDuration = entries.length > 0 ? Math.round(totalSeconds / entries.length) : 0;

    return {
      totalCalls: entries.length,
      incomingCount,
      outgoingCount,
      missedCount,
      blockedCount,
      totalDurationFormatted: formatDuration(totalSeconds),
      avgDurationFormatted: formatDuration(avgDuration),
      lastCallTimestamp: entries[0]?.timestamp || Date.now(),
    };
  }, [entries]);

  // Direct Social Media and Messaging Links (WhatsApp, Telegram, Signal, Viber, SMS)
  const socialAccounts = useMemo(() => {
    if (!number) return null;
    const digits = number.replace(/\D/g, '');
    if (!digits || digits.length < 5) return null;

    let intl = digits;
    // Format Indian mobile: 10 digits starting with 6-9
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      intl = `91${digits}`;
    } else if (number.startsWith('+')) {
      intl = digits;
    } else if (digits.length === 10) {
      intl = `1${digits}`;
    }

    return {
      intl,
      whatsapp: `https://api.whatsapp.com/send?phone=${intl}`,
      whatsappApp: `whatsapp://send?phone=${intl}`,
      sms: `sms:${number.startsWith('+') ? `+${intl}` : intl}`,
    };
  }, [number]);

  const handleOpenSocialChat = (platform: 'whatsapp' | 'sms') => {
    if (!socialAccounts) return;

    const names = {
      whatsapp: 'WhatsApp',
      sms: 'SMS Messages',
    };

    setSocialToast(`Opening ${names[platform]} chat with ${number}...`);
    setTimeout(() => setSocialToast(null), 3000);

    if (platform === 'whatsapp') {
      const opened = telecomBridge.openExternalApp(socialAccounts.whatsappApp) ||
                     telecomBridge.openExternalApp(socialAccounts.whatsapp);
      if (!opened) {
        window.open(socialAccounts.whatsapp, '_blank', 'noopener,noreferrer');
      }
    } else if (platform === 'sms') {
      const opened = telecomBridge.openExternalApp(socialAccounts.sms);
      if (!opened) {
        window.open(socialAccounts.sms, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleCopyNumber = () => {
    if (!number) return;
    navigator.clipboard?.writeText(number);
    setCopiedNumberFeedback(true);
    setTimeout(() => setCopiedNumberFeedback(false), 2000);
  };

  const saveNote = () => {
    try {
      const raw = localStorage.getItem('vigilshield_call_notes_v1') || '{}';
      const parsed = JSON.parse(raw);
      if (note.trim()) {
        parsed[key] = note.trim();
      } else {
        delete parsed[key];
      }
      localStorage.setItem('vigilshield_call_notes_v1', JSON.stringify(parsed));
      setNoteSavedFeedback(true);
      setTimeout(() => setNoteSavedFeedback(false), 2000);
    } catch {}
    if (call && onSaveNote) onSaveNote(call.id, note.trim());
  };

  const toggleDictation = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setDictationError('Voice dictation is not supported in this browser. Please type or use Chrome, Edge, or Safari.');
      setTimeout(() => setDictationError(null), 4000);
      return;
    }

    if (isDictating) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsDictating(false);
      return;
    }

    try {
      setDictationError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      const baseText = note ? note.trim() : '';

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const updated = baseText ? `${baseText} ${transcript.trim()}` : transcript.trim();
        setNote(updated);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setDictationError('Microphone permission was denied. Please allow microphone access to dictate notes.');
        } else if (event.error !== 'no-speech') {
          setDictationError(`Dictation error: ${event.error}`);
        }
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('Speech recognition initialization error:', err);
      setDictationError('Could not start voice dictation.');
      setIsDictating(false);
    }
  }, [isDictating, note]);

  useEffect(() => {
    if (!isOpen && isDictating) {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsDictating(false);
    }
  }, [isOpen, isDictating]);

  const handleDeleteRecording = async (id: string) => {
    await callRecordingService.deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleQuickSaveContact = (contactName: string) => {
    if (!number.trim()) return;
    if (onAddContact) {
      onAddContact({
        name: contactName.trim() || number,
        number: number.trim(),
        category: 'GENERAL',
        trusted: true,
      });
    }
    setContactSavedFeedback(true);
    setTimeout(() => setContactSavedFeedback(false), 2500);
  };

  const handleApplyNameCorrection = () => {
    const trimmed = inaccuracyCorrectedName.trim();
    if (!trimmed) return;

    externalDirectoryService.setUserNameOverride(number, trimmed, inaccuracyReason);
    setName(trimmed);
    if (onUpdateCallerName) {
      onUpdateCallerName(number, trimmed);
    }
    if (inaccuracySubmitCommunity && onOpenDisputeModal) {
      onOpenDisputeModal(number, trimmed);
    }

    setInaccuracyFeedback(`Caller name updated to "${trimmed}". Inaccuracy correction saved.`);
    setTimeout(() => {
      setIsInaccuracyModalOpen(false);
      setInaccuracyFeedback(null);
    }, 1200);
  };

  if (!shouldRender) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', transform: 'none' }}
      role="dialog"
      aria-modal="true"
    >
      <section
        className={`flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#090d14] sm:h-auto sm:max-h-[92vh] sm:rounded-[30px] sm:border ${
          isSpam ? 'sm:border-rose-900/60' : isVerified ? 'sm:border-blue-900/50' : 'sm:border-slate-800'
        } sm:shadow-2xl transition-all`}
        style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', transform: 'none' }}
      >
        {/* Floating Social Toast */}
        {socialToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-black/50 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 animate-pulse" />
            <span>{socialToast}</span>
          </div>
        )}

        {/* HERO CALLER PROFILE HEADER */}
        <header
          className={`relative border-b px-5 pt-5 pb-4 safe-top-modal transition-colors ${
            isSpam
              ? 'border-rose-900/50 bg-gradient-to-b from-rose-950/40 via-[#0e131d] to-[#090d14]'
              : isVerified
              ? 'border-blue-900/40 bg-gradient-to-b from-blue-950/30 via-[#0e1422] to-[#090d14]'
              : 'border-slate-800 bg-gradient-to-b from-slate-900/50 via-[#0d121c] to-[#090d14]'
          }`}
        >
          {/* Top Bar with Dismiss and Badges */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isSpam
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : isVerified
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isSpam ? <ShieldAlert className="h-3 w-3" /> : isVerified ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {label}
              </span>

              {call?.sim && (
                <span className="rounded-full bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {call.sim}
                </span>
              )}
            </div>

            <button
              onClick={handleClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition active:scale-95 shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Hero Profile Info */}
          <div className="mt-3 flex items-start gap-4">
            {/* Avatar with Dynamic Aura Ring */}
            <div className="relative shrink-0">
              <div
                className={`grid h-16 w-16 place-items-center rounded-2xl font-black text-2xl shadow-xl transition-transform ${
                  isSpam
                    ? 'bg-gradient-to-br from-rose-600 to-rose-900 text-white ring-2 ring-rose-500/40'
                    : isVerified
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-700 text-white ring-2 ring-blue-400/40'
                    : 'bg-gradient-to-br from-emerald-600 to-teal-800 text-white ring-2 ring-emerald-500/30'
                }`}
              >
                {profile?.isVerified ? (
                  <Building2 className="h-8 w-8" />
                ) : (
                  (displayName || number).slice(0, 1).toUpperCase()
                )}
              </div>
              {isVerified && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-blue-500 p-1 text-white shadow-md">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              )}
              {isSpam && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-rose-600 p-1 text-white shadow-md">
                  <ShieldAlert className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Caller Identification and Origin */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {editing ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter contact name"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-sm font-semibold text-white outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setEditing(false);
                        if (onUpdateCallerName && name.trim()) {
                          onUpdateCallerName(number, name.trim());
                        }
                      }}
                      className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-500 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setName(call?.callerName || profile?.name || '');
                      }}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="truncate text-xl font-black text-white tracking-tight">
                      {displayName}
                    </h2>
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                      title="Edit display name"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Identity Origin Chip */}
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {nameOrigin === 'SAVED_CONTACT' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <BookUser className="h-3.5 w-3.5" />
                    Saved in Device Contacts
                  </span>
                ) : nameOrigin === 'USER_OVERRIDE' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Custom Override Saved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400">
                    <Globe className="h-3.5 w-3.5" />
                    Directory / Truecaller Registry
                  </span>
                )}

                <span className="text-slate-600 text-xs">·</span>

                {/* Copyable Phone Number */}
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="group inline-flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-white transition rounded px-1.5 py-0.5 hover:bg-white/5"
                  title="Click to copy phone number"
                >
                  <span>{number}</span>
                  {copiedNumberFeedback ? (
                    <span className="text-emerald-400 font-sans text-[10px] font-bold animate-in fade-in">Copied!</span>
                  ) : (
                    <Copy className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
                  )}
                </button>
              </div>

              {/* Carrier & Location Info */}
              <div className="mt-1 text-[11px] text-slate-400">
                {profile?.carrier ? `${profile.carrier} · ` : ''}
                {profile?.circle || profile?.country || 'India'}
                {profile?.businessCategory ? ` · ${profile.businessCategory}` : ''}
              </div>
            </div>
          </div>

          {/* Spam / Scam Warning or Safety Indicator */}
          {isSpam ? (
            <div className="mt-3 rounded-xl border border-rose-800/60 bg-rose-950/30 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                  <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{profile?.spamCategory ? `${profile.spamCategory} Alert` : 'High Spam Risk'}</span>
                </div>
                <span className="rounded bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                  {risk || 95}% Risk Score
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-rose-300/90">
                {profile?.spamReason || call?.spamReason || 'Identified with high risk spam signals in CallShield community database.'}
              </p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-rose-400/80 font-medium">
                <span>{profile?.spamReportsCount || call?.reportsCount || 64} community reports</span>
                {onMarkSafe && (
                  <button
                    onClick={() => onMarkSafe(number, displayName)}
                    className="text-emerald-400 hover:underline font-bold"
                  >
                    Mark as Safe
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Risk meter strip */
            <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>CallShield Reputation:</span>
                <span className="font-semibold text-emerald-400">Clean (0% Risk)</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {callStats.totalCalls} total {callStats.totalCalls === 1 ? 'call' : 'calls'} recorded
              </div>
            </div>
          )}

          {/* Neighbor Spoof & Ping-back Scam Banners */}
          {isNeighborSpoof && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <span className="font-bold text-amber-300">Neighbor Spoof Detected: </span>
                <span className="text-[11px] text-amber-200/90">Matches your phone's area prefix to trick you into picking up.</span>
              </div>
            </div>
          )}

          {isPingBackScam && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <span className="font-bold text-rose-300">1-Ring Wangiri Trap: </span>
                <span className="text-[11px] text-rose-200/90">Call was disconnected after 1 ring to bait costly international callbacks.</span>
              </div>
            </div>
          )}

          {/* PRIMARY QUICK ACTIONS DOCK */}
          <div className="mt-3.5 grid grid-cols-5 gap-2">
            <button
              onClick={() => onInitiateCall?.(number, displayName)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-white font-bold text-[11px] shadow-lg shadow-emerald-600/20 transition active:scale-95"
            >
              <Phone className="h-4 w-4 fill-current" />
              <span>Call</span>
            </button>

            <button
              type="button"
              onClick={() => onInitiateCall?.(number, displayName, undefined, true)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-950/60 py-2.5 text-indigo-200 hover:bg-indigo-900/60 font-semibold text-[11px] transition active:scale-95"
              title="Return call with *67 Caller ID suppression"
            >
              <EyeOff className="h-4 w-4 text-indigo-400" />
              <span>Private</span>
            </button>

            <button
              onClick={() => handleOpenSocialChat('sms')}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-purple-500/40 bg-purple-950/50 py-2.5 text-purple-200 hover:bg-purple-900/60 font-semibold text-[11px] transition active:scale-95"
              title="Send native SMS/RCS message"
            >
              <MessageSquare className="h-4 w-4 text-purple-400" />
              <span>SMS</span>
            </button>

            <button
              onClick={() => onBlockNumber(number, displayName)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 font-semibold text-[11px] transition active:scale-95 ${
                isSpam
                  ? 'border-rose-700 bg-rose-950/70 text-rose-200 hover:bg-rose-900/70'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Ban className="h-4 w-4" />
              <span>Block</span>
            </button>

            {!savedContact ? (
              <button
                onClick={() => handleQuickSaveContact(displayName)}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/40 bg-blue-950/50 py-2.5 text-blue-200 hover:bg-blue-900/60 font-semibold text-[11px] transition active:scale-95"
              >
                {contactSavedFeedback ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">Saved</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 text-blue-400" />
                    <span>Save</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  setInaccuracyCorrectedName(displayName || '');
                  setIsInaccuracyModalOpen(true);
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-slate-200 hover:bg-slate-800 font-semibold text-[11px] transition active:scale-95"
              >
                <UserCheck className="h-4 w-4 text-emerald-400" />
                <span>Contact</span>
              </button>
            )}
          </div>

          {/* NAVIGATION TABS */}
          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800/80 pt-2.5 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('OVERVIEW')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'OVERVIEW'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'HISTORY'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Call History</span>
              <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px]">{entries.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SOCIAL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'SOCIAL'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span>Social & Chat</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 text-[9px] font-bold">WhatsApp</span>
            </button>
            {recordings.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('RECORDINGS')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'RECORDINGS'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Disc className="h-3.5 w-3.5 text-emerald-400" />
                <span>Recordings ({recordings.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('SECURITY')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'SECURITY'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>Notes & Identity</span>
            </button>
          </div>
        </header>

        {/* MODAL BODY CONTENT */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-800">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4">
              {/* SOCIAL MEDIA & MESSAGING CHAT SHORTCUTS (WhatsApp, Telegram, etc.) */}
              <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#0c141d] to-[#0a1017] p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Social & Instant Messaging</h3>
                      <p className="text-[11px] text-slate-400">Tap to open 1-on-1 direct chat with {number}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('SOCIAL')}
                    className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {/* WhatsApp Direct Chat Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenSocialChat('whatsapp')}
                    className="group relative flex items-center gap-3 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 p-3 hover:bg-[#25D366]/20 transition text-left active:scale-98 shadow-sm"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white shadow-md shadow-[#25D366]/30 group-hover:scale-105 transition-transform">
                      {/* Official WhatsApp SVG Icon */}
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.05 7.42C8.87 7.42 8.57 7.49 8.32 7.76C8.07 8.04 7.35 8.71 7.35 10.07C7.35 11.43 8.34 12.74 8.48 12.93C8.62 13.12 10.42 15.91 13.18 17.1C15.47 18.09 15.94 17.89 16.43 17.85C16.92 17.8 18 17.21 18.23 16.56C18.46 15.91 18.46 15.35 18.39 15.24C18.32 15.13 18.14 15.06 17.86 14.92C17.58 14.78 16.21 14.11 15.96 14.02C15.71 13.93 15.53 13.88 15.35 14.16C15.17 14.44 14.65 15.05 14.49 15.24C14.33 15.42 14.17 15.45 13.89 15.31C13.61 15.17 12.71 14.88 11.65 13.93C10.82 13.19 10.26 12.28 10.1 12C9.94 11.72 10.08 11.58 10.22 11.44C10.35 11.31 10.51 11.1 10.65 10.94C10.79 10.78 10.84 10.66 10.93 10.48C11.02 10.3 10.97 10.14 10.9 10C10.83 9.86 10.28 8.52 10.05 7.97C9.83 7.44 9.61 7.51 9.44 7.5C9.28 7.49 9.09 7.42 9.05 7.42Z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white group-hover:text-[#25D366] transition">WhatsApp</div>
                      <div className="text-[10.5px] text-slate-400 truncate">Direct Chat</div>
                    </div>
                  </button>

                  {/* Native SMS Chat Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenSocialChat('sms')}
                    className="group relative flex items-center gap-3 rounded-xl border border-purple-500/40 bg-purple-500/10 p-3 hover:bg-purple-500/20 transition text-left active:scale-98 shadow-sm"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/30 group-hover:scale-105 transition-transform">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white group-hover:text-purple-300 transition">SMS / Messages</div>
                      <div className="text-[10.5px] text-slate-400 truncate">Carrier Messaging</div>
                    </div>
                  </button>
                </div>
              </section>

              {/* CALL HISTORY SUMMARY STRIP */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-bold text-white">Call Summary & Activity</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('HISTORY')}
                    className="text-xs font-semibold text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <span>Full Timeline</span>
                    <ChevronDown className="h-3 w-3 -rotate-90" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] text-slate-500 font-medium">Total Calls</div>
                    <div className="mt-1 text-base font-black text-white">{callStats.totalCalls}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] text-emerald-400 font-medium">Incoming</div>
                    <div className="mt-1 text-base font-black text-emerald-300">{callStats.incomingCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] text-sky-400 font-medium">Outgoing</div>
                    <div className="mt-1 text-base font-black text-sky-300">{callStats.outgoingCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <div className="text-[10px] text-rose-400 font-medium">Missed</div>
                    <div className="mt-1 text-base font-black text-rose-300">{callStats.missedCount}</div>
                  </div>
                </div>

                {/* Last 2 recent calls preview */}
                <div className="mt-3 divide-y divide-slate-800/60 border-t border-slate-800/80 pt-2">
                  {entries.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        {item.type === 'INCOMING' ? (
                          <PhoneIncoming className="h-3.5 w-3.5 text-emerald-400" />
                        ) : item.type === 'OUTGOING' ? (
                          <PhoneOutgoing className="h-3.5 w-3.5 text-sky-400" />
                        ) : item.type === 'MISSED' ? (
                          <PhoneMissed className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <PhoneOff className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span className="font-semibold text-slate-200">
                          {item.type === 'INCOMING' ? 'Incoming Call' : item.type === 'OUTGOING' ? 'Outgoing Call' : item.type === 'MISSED' ? 'Missed Call' : 'Blocked Call'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.recordingUri && (
                          <span className="rounded bg-emerald-500/15 text-emerald-400 px-1.5 py-0.2 text-[9px] font-bold flex items-center gap-0.5">
                            <Disc className="h-2.5 w-2.5" />
                            REC
                          </span>
                        )}
                        <span className="font-mono text-slate-400 text-[11px]">
                          {formatDuration(item.durationSeconds || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* DEDICATED AI VOICE SCREENER SUMMARY (If available) */}
              {latestScreenedEntry && (
                <section className="rounded-2xl border border-indigo-500/30 bg-[#0c1222] shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-indigo-500/20 bg-indigo-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white">AI Voice Screener Spoken Summary</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                        <Sparkles className="h-2.5 w-2.5 text-indigo-400" />
                        Gemini AI
                      </span>
                    </div>
                    {latestScreenedEntry.screeningDetectedIntent && (
                      <span className="rounded-lg bg-indigo-900/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-200 border border-indigo-500/30">
                        {latestScreenedEntry.screeningDetectedIntent}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2.5 bg-[#080d17]">
                    {latestScreenedEntry.screeningSummaryBullets && latestScreenedEntry.screeningSummaryBullets.length > 0 ? (
                      <ul className="space-y-1.5 text-xs text-slate-200">
                        {latestScreenedEntry.screeningSummaryBullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2 border border-white/5">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                            <span className="leading-relaxed text-slate-200">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed">{latestScreenedEntry.screeningSummary}</p>
                    )}
                  </div>
                </section>
              )}

              {/* IDENTITY ATTRIBUTION CARD */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <BookUser className="h-4 w-4 text-blue-400" />
                    Caller Identity Records
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInaccuracyCorrectedName(displayName || '');
                      setInaccuracyFeedback(null);
                      setIsInaccuracyModalOpen(true);
                    }}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1"
                  >
                    <Flag className="h-3 w-3" />
                    Report Inaccuracy
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Device Contacts Name</span>
                      {savedContactName && (
                        <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-semibold text-white flex items-center gap-1.5">
                      {savedContactName ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{savedContactName}</span>
                        </>
                      ) : (
                        <span className="text-slate-500 font-normal italic">Not in device contacts</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Directory & Truecaller Name</span>
                      {suggestedDirectoryName && (
                        <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-semibold text-white flex items-center gap-1.5">
                      {suggestedDirectoryName ? (
                        <>
                          <Globe className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="truncate">{suggestedDirectoryName}</span>
                        </>
                      ) : (
                        <span className="text-slate-500 font-normal italic">No public directory match</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* QUICK PRIVATE CALLER NOTE */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <StickyNote className="h-4 w-4 text-amber-400" />
                    <span>Caller Note</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      isDictating
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5 text-amber-400" />
                    <span>{isDictating ? 'Listening…' : 'Dictate note'}</span>
                  </button>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Add a private note about this caller (auto-saved locally)..."
                  className="mt-2.5 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-500/50"
                />

                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={saveNote}
                    className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition"
                  >
                    Save Note
                  </button>
                  {noteSavedFeedback && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Note Saved
                    </span>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: CALL HISTORY & TIMELINE */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              {/* Analytics Header Card */}
              <div className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Call History & Talk Time</div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="text-[10px] text-slate-500 font-medium">Total Calls</div>
                    <div className="mt-1 text-lg font-black text-white">{callStats.totalCalls}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="text-[10px] text-slate-500 font-medium">Total Talk Time</div>
                    <div className="mt-1 text-lg font-black text-emerald-400">{callStats.totalDurationFormatted}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                    <div className="text-[10px] text-slate-500 font-medium">Avg Call Length</div>
                    <div className="mt-1 text-lg font-black text-blue-400">{callStats.avgDurationFormatted}</div>
                  </div>
                </div>
              </div>

              {/* Chronological Timeline */}
              {entries.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0e141c] p-8 text-center text-slate-500">
                  <Clock className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No previous call history with this number</p>
                  <p className="text-xs text-slate-500 mt-0.5">Calls made to or received from {number} will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {entries.map((item) => {
                    const itemRec = recordings.find(
                      (r) => r.callId === item.id || Math.abs(r.timestamp - item.timestamp) < 5000
                    );

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-800 bg-[#0e141d] p-4 shadow-sm hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                                item.type === 'INCOMING'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : item.type === 'OUTGOING'
                                  ? 'bg-sky-500/10 text-sky-400'
                                  : item.type === 'MISSED'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {item.type === 'INCOMING' ? (
                                <PhoneIncoming className="h-4 w-4" />
                              ) : item.type === 'OUTGOING' ? (
                                <PhoneOutgoing className="h-4 w-4" />
                              ) : item.type === 'MISSED' ? (
                                <PhoneMissed className="h-4 w-4" />
                              ) : (
                                <PhoneOff className="h-4 w-4" />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white">
                                  {item.type === 'INCOMING'
                                    ? 'Incoming Call'
                                    : item.type === 'OUTGOING'
                                    ? 'Outgoing Call'
                                    : item.type === 'MISSED'
                                    ? 'Missed Call'
                                    : 'Blocked / Cancelled'}
                                </span>
                                {item.sim && (
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-400">
                                    {item.sim}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-400">
                                {new Date(item.timestamp).toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}{' '}
                                at{' '}
                                {new Date(item.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-mono text-xs font-semibold text-slate-300">
                              {item.type === 'MISSED' ? '0s' : formatDuration(item.durationSeconds || 0)}
                            </div>
                            {itemRec && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
                                <Disc className="h-3 w-3 animate-pulse" />
                                Recorded
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline Audio Player if recording exists */}
                        {itemRec && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80">
                            <AudioRecordingPlayer recording={itemRec} onDelete={handleDeleteRecording} compact />
                          </div>
                        )}

                        {/* AI Screener summary note if screened */}
                        {(item.usedAiScreener || item.screeningSummaryBullets) && (
                          <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-2.5 text-xs text-slate-300">
                            <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                              <Bot className="h-3.5 w-3.5 text-indigo-400" />
                              <span>AI Voice Screener Summary</span>
                            </div>
                            {item.screeningSummaryBullets && item.screeningSummaryBullets.length > 0 ? (
                              <ul className="space-y-1 text-[11px] text-slate-300">
                                {item.screeningSummaryBullets.map((b, bIdx) => (
                                  <li key={bIdx} className="flex items-start gap-1.5">
                                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] text-slate-300">{item.screeningSummary}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SOCIAL MEDIA & CHAT ACCOUNTS */}
          {activeTab === 'SOCIAL' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <MessageSquare className="h-5 w-5" />
                  <h3 className="text-sm font-bold text-white">Direct Social & Chat Accounts</h3>
                </div>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  Click any platform below to immediately start a direct message or chat with{' '}
                  <span className="font-mono text-emerald-400">{number}</span>.
                </p>
              </div>

              <div className="space-y-3">
                {/* WHATSAPP CARD */}
                <div className="rounded-2xl border border-[#25D366]/40 bg-[#0e1713] p-4 hover:border-[#25D366] transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#25D366] text-white shadow-lg shadow-[#25D366]/30">
                        <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.05 7.42C8.87 7.42 8.57 7.49 8.32 7.76C8.07 8.04 7.35 8.71 7.35 10.07C7.35 11.43 8.34 12.74 8.48 12.93C8.62 13.12 10.42 15.91 13.18 17.1C15.47 18.09 15.94 17.89 16.43 17.85C16.92 17.8 18 17.21 18.23 16.56C18.46 15.91 18.46 15.35 18.39 15.24C18.32 15.13 18.14 15.06 17.86 14.92C17.58 14.78 16.21 14.11 15.96 14.02C15.71 13.93 15.53 13.88 15.35 14.16C15.17 14.44 14.65 15.05 14.49 15.24C14.33 15.42 14.17 15.45 13.89 15.31C13.61 15.17 12.71 14.88 11.65 13.93C10.82 13.19 10.26 12.28 10.1 12C9.94 11.72 10.08 11.58 10.22 11.44C10.35 11.31 10.51 11.1 10.65 10.94C10.79 10.78 10.84 10.66 10.93 10.48C11.02 10.3 10.97 10.14 10.9 10C10.83 9.86 10.28 8.52 10.05 7.97C9.83 7.44 9.61 7.51 9.44 7.5C9.28 7.49 9.09 7.42 9.05 7.42Z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">WhatsApp</h4>
                          <span className="rounded-full bg-[#25D366]/20 border border-[#25D366]/30 px-2 py-0.5 text-[10px] font-bold text-[#25D366]">
                            Available
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Open WhatsApp mobile app directly
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSocialChat('whatsapp')}
                      className="rounded-xl bg-[#25D366] hover:bg-[#20ba5a] px-4 py-2 text-xs font-bold text-black shadow-md shadow-[#25D366]/20 transition active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                      <span>Open Chat</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* NATIVE SMS / RCS MESSAGING */}
                <div className="rounded-2xl border border-purple-500/40 bg-[#120e1c] p-4 hover:border-purple-500 transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-600/30">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">SMS / Messages</h4>
                          <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            Carrier
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Carrier text messaging on this device
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSocialChat('sms')}
                      className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 transition active:scale-95 flex items-center gap-1.5 shrink-0"
                    >
                      <span>Send SMS</span>
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CALL RECORDINGS */}
          {activeTab === 'RECORDINGS' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Disc className="h-5 w-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-white">Recorded Calls ({recordings.length})</h3>
                  </div>
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    48 kHz Studio HD
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Folder className="h-3.5 w-3.5 text-amber-400" />
                  <span>Saved in: Internal Storage/Recordings/CallShield/</span>
                </div>
              </div>

              {recordings.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0e141c] p-8 text-center text-slate-500">
                  <Disc className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No recorded calls for this number</p>
                  <p className="text-xs text-slate-500 mt-0.5">Automatic call recording can be toggled in Protection Settings.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recordings.map((rec) => (
                    <AudioRecordingPlayer key={rec.id} recording={rec} onDelete={handleDeleteRecording} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: NOTES & IDENTITY */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-4">
              {/* Private Dictated Note */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <StickyNote className="h-4 w-4 text-amber-400" />
                    <span>Private Caller Note</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isDictating
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5 text-amber-400" />
                    <span>{isDictating ? 'Listening…' : 'Dictate with Voice'}</span>
                  </button>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder={isDictating ? 'Listening to speech... speak your note now...' : 'Write or dictate a private note about this caller...'}
                  className={`mt-3 w-full resize-none rounded-xl border bg-slate-950 p-3 text-sm text-white outline-none placeholder-slate-600 transition ${
                    isDictating ? 'border-rose-500/60 ring-1 ring-rose-500/30' : 'border-slate-800 focus:border-amber-500/40'
                  }`}
                />

                {dictationError && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>{dictationError}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={saveNote}
                    disabled={!number}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40 transition"
                  >
                    Save Note
                  </button>
                  {noteSavedFeedback && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Saved Successfully
                    </span>
                  )}
                </div>
              </section>

              {/* Name Inaccuracy Correction Card */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Flag className="h-4 w-4 text-amber-400" />
                    <span>Name Inaccuracy & Community Dispute</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInaccuracyCorrectedName(displayName || '');
                      setIsInaccuracyModalOpen(true);
                    }}
                    className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition"
                  >
                    Correct Name
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  If the caller's name is wrong, misspelled, or outdated in the directory, you can submit an official dispute and save your own corrected name locally.
                </p>
              </section>

              {/* Community Spam Reports */}
              <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                    <span>Community Safety & Spam Reporting</span>
                  </div>
                  <button
                    onClick={() => onOpenReportModal(number)}
                    className="rounded-lg bg-rose-500/15 border border-rose-500/30 px-3 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/25 transition"
                  >
                    Report Number
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <span className="text-slate-500">Risk Score</span>
                    <div className="mt-1 font-bold text-slate-200">{risk}%</div>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
                    <span className="text-slate-500">Community Reports</span>
                    <div className="mt-1 font-bold text-slate-200">
                      {profile?.spamReportsCount || Math.max(...entries.map((x) => x.reportsCount || 0), 0)}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      {/* NAME INACCURACY REPORTING MODAL */}
      {isInaccuracyModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#101722] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Report Inaccurate Name</h3>
              </div>
              <button
                onClick={() => setIsInaccuracyModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-400 mb-1">Phone Number</label>
                <div className="font-mono text-sm text-slate-200 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  {number}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-400 mb-1">Current Display Name</label>
                <div className="text-sm text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                  {displayName}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Correct Caller Name *</label>
                <input
                  type="text"
                  value={inaccuracyCorrectedName}
                  onChange={(e) => setInaccuracyCorrectedName(e.target.value)}
                  placeholder="e.g. John Doe / City Hospital / FastCourier"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Reason for Inaccuracy</label>
                <select
                  value={inaccuracyReason}
                  onChange={(e) => setInaccuracyReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-400"
                >
                  <option value="Wrong Individual">Wrong Individual</option>
                  <option value="Wrong Business">Wrong Business / Company</option>
                  <option value="Typo / Spelling Error">Typo or Spelling Error</option>
                  <option value="Outdated / Number Reassigned">Outdated or Number Reassigned</option>
                  <option value="Privacy / Defamation Concern">Privacy Concern</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={inaccuracyNotes}
                  onChange={(e) => setInaccuracyNotes(e.target.value)}
                  rows={2}
                  placeholder="Provide any additional context or reference..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={inaccuracySubmitCommunity}
                  onChange={(e) => setInaccuracySubmitCommunity(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px]">Submit dispute to CallShield community directory for review</span>
              </label>

              {inaccuracyFeedback && (
                <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2 text-center text-xs text-emerald-300 font-semibold">
                  {inaccuracyFeedback}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setIsInaccuracyModalOpen(false)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyNameCorrection}
                disabled={!inaccuracyCorrectedName.trim()}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-40"
              >
                Apply Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
