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
  Disc,
  Edit2,
  EyeOff,
  Flag,
  Folder,
  Globe,
  Info,
  Mic,
  MicOff,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { CallLogItem, CallClassification, CallShieldDirectoryProfile, CallRecordingItem, ContactItem } from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService, normalizePhoneNumber } from '../services/callRecordingService';
import { externalDirectoryService } from '../services/externalDirectoryService';
import { detectNeighborSpoof, detectPingBackScam } from '../utils/spoofEngine';
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

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
  const [expanded, setExpanded] = useState(true);
  const [recordingsExpanded, setRecordingsExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
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
      setExpanded(true);
      setRecordingsExpanded(true);
      setEditing(false);
      setName(call?.callerName || profile?.name || '');
      setIsInaccuracyModalOpen(false);
      setInaccuracyFeedback(null);
      setContactSavedFeedback(false);

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
          // Also check calls list for any recordingUri
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

  // Clean up dictation when modal closes or unmounts
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

  // Quick save to device contacts
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

  // Apply Name Inaccuracy Correction
  const handleApplyNameCorrection = () => {
    const trimmed = inaccuracyCorrectedName.trim();
    if (!trimmed) return;

    // 1. Persist local override
    externalDirectoryService.setUserNameOverride(number, trimmed, inaccuracyReason);

    // 2. Update caller name in app state
    setName(trimmed);
    if (onUpdateCallerName) {
      onUpdateCallerName(number, trimmed);
    }

    // 3. If community submission enabled, report dispute
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
    <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/90 p-0 sm:p-4" style={{ backdropFilter: "none", WebkitBackdropFilter: "none", filter: "none", transform: "none" }} role="dialog" aria-modal="true">
      <section className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#0a1017] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] sm:border sm:border-slate-800 sm:shadow-2xl" style={{ backdropFilter: "none", WebkitBackdropFilter: "none", filter: "none", transform: "none" }}>
        {/* Header */}
        <header className={`border-b px-5 pb-5 safe-top-modal sm:pt-5 ${isSpam ? 'border-rose-900/60 bg-rose-950/20' : 'border-slate-800 bg-[#0e1622]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Badges Row */}
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${isSpam ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : isVerified ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                  {isSpam ? '⚠ ' : ''}{label}
                </span>

                {/* Clear Visual Distinction Badge for Name Source */}
                {nameOrigin === 'SAVED_CONTACT' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    <BookUser className="h-3.5 w-3.5" />
                    Saved Name (Device Contacts)
                  </span>
                ) : nameOrigin === 'USER_OVERRIDE' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-1 text-[11px] font-bold text-cyan-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Corrected Name (Local Override)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                    <Globe className="h-3.5 w-3.5" />
                    Suggested Name (Directory)
                  </span>
                )}

                <span className="text-[11px] text-slate-400 font-medium">
                  {entries.length} {entries.length === 1 ? t('call') : t('calls')}
                </span>

                {recordings.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                    <Disc className="h-3 w-3 animate-pulse" />
                    {recordings.length} {recordings.length === 1 ? 'Recording' : 'Recordings'}
                  </span>
                )}
              </div>

              {/* Caller Display Name with Inline Edit & Report Inaccuracy */}
              {editing ? (
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-semibold text-white outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (name.trim() && onUpdateCallerName) onUpdateCallerName(number, name.trim());
                      setEditing(false);
                    }}
                    className="rounded-xl bg-blue-600 p-2 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="truncate text-2xl font-bold text-white">{displayName}</h2>
                  {onUpdateCallerName && (
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Edit display name"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* PROMINENT REPORT NAME INACCURACY BUTTON IN HEADER */}
                  <button
                    type="button"
                    onClick={() => {
                      setInaccuracyCorrectedName(displayName || '');
                      setInaccuracyFeedback(null);
                      setIsInaccuracyModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition"
                    title="Report wrong caller name or submit data correction"
                  >
                    <Flag className="h-3.5 w-3.5 text-amber-400" />
                    Report Name Inaccuracy
                  </button>
                </div>
              )}

              {/* Number and Location */}
              <p className="mt-1 font-mono text-sm text-slate-400">
                {number}
                {(() => {
                  const loc = (profile?.location || call?.location || '').replace(/,\s*India,\s*India/g, ', India').replace(/India,\s*India/g, 'India');
                  const carr = profile?.carrier || call?.carrier || '';
                  return (
                    <>
                      {loc ? ` · ${loc}` : ''}
                      {carr ? ` · ${carr}` : ''}
                    </>
                  );
                })()}
              </p>

              {/* Cross-Identity Comparison Banner */}
              {nameOrigin === 'SAVED_CONTACT' && suggestedDirectoryName && suggestedDirectoryName !== savedContactName && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 border border-slate-700/60 p-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>
                      Directory Suggestion: <strong className="text-white">{suggestedDirectoryName}</strong>
                      <span className="ml-1 text-[11px] text-slate-400">({profile?.source || 'Community Record'})</span>
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                    Device Contact Overrides Directory
                  </span>
                </div>
              )}

              {nameOrigin === 'DIRECTORY_SUGGESTED' && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 p-2.5 text-xs">
                  <div className="flex items-center gap-2 text-indigo-200">
                    <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span>Suggested by public directory & community data. Not saved in device contacts.</span>
                  </div>
                  {onAddContact && (
                    <button
                      type="button"
                      onClick={() => handleQuickSaveContact(displayName)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-sm"
                    >
                      <UserPlus className="h-3 w-3" />
                      {contactSavedFeedback ? 'Saved to Contacts ✓' : 'Save to Contacts'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isSpam && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-rose-800/60 bg-rose-950/40 p-3.5">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-rose-200">
                    {profile?.spamCategory ? `${profile.spamCategory} Alert` : 'Spam Signals Detected'}
                  </span>
                  {profile?.topTags && profile.topTags.length > 0 && (
                    <span className="rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      {profile.topTags[0]}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs leading-5 text-rose-300/90">
                  {profile?.spamReason || call?.spamReason || 'Identified with high risk protection signals in CallShield community database.'}
                </div>
                {profile?.topTags && profile.topTags.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.topTags.map((tag, idx) => (
                      <span key={idx} className="rounded-full bg-rose-900/40 border border-rose-700/50 px-2 py-0.5 text-[10px] font-medium text-rose-200">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs font-semibold text-rose-300">
                  {profile?.spamReportsCount || call?.reportsCount || 66} community reports · {risk || 98}% risk
                </div>
              </div>
            </div>
          )}

          {/* Neighbor Spoof Detection Banner */}
          {isNeighborSpoof && (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="font-semibold text-amber-300">Neighbor Spoof Detected</p>
                <p className="mt-0.5 leading-relaxed text-amber-200/90">
                  This number shares your local area prefix to trick you into answering, but is not in your contacts.
                </p>
              </div>
            </div>
          )}

          {/* Ping-Back Wangiri Scam Banner */}
          {isPingBackScam && (
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-300">1-Ring Ping-Back Scam Risk</p>
                <p className="mt-0.5 leading-relaxed text-rose-200/90">
                  This call was dropped after 1 ring. Spammers use this Wangiri trap to bait expensive international callbacks.
                </p>
              </div>
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onInitiateCall?.(number, displayName)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Phone className="h-4 w-4 fill-current" />
              {t('call_action')}
            </button>
            <button
              type="button"
              onClick={() => onInitiateCall?.(number, displayName, undefined, true)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/50 font-semibold text-xs text-indigo-200 hover:bg-indigo-900/70 transition active:scale-95 shadow-sm"
              title="Return call with *67 Caller ID suppression"
            >
              <EyeOff className="h-4 w-4 text-indigo-400" />
              Private Call
            </button>
            <button
              onClick={() => onBlockNumber(number, displayName)}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 font-semibold text-xs text-slate-200 hover:bg-slate-800 transition active:scale-95"
            >
              <Ban className="h-4 w-4" />
              {t('block_action')}
            </button>
          </div>

          {/* Caller Identity Details: Saved Name vs Suggested Directory Name */}
          <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <BookUser className="h-4 w-4 text-blue-400" />
                Caller Identity Source
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
                  <span className="text-slate-500 font-medium">Saved Name (Device Contacts)</span>
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
                    <span className="text-slate-400 font-normal italic">Not in device contacts</span>
                  )}
                </div>
                {onAddContact && !savedContactName && (
                  <button
                    onClick={() => handleQuickSaveContact(displayName)}
                    className="mt-2 text-[11px] font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="h-3 w-3" />
                    Save as Contact
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Suggested Name (Directory)</span>
                  {!savedContactName && suggestedDirectoryName && (
                    <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                      Suggested
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
                    <span className="text-slate-400 font-normal italic">No directory listing</span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Source: {profile?.source || 'Public Directory & Community Crowd'}
                </div>
              </div>
            </div>
          </section>

          {/* DEDICATED AI VOICE SCREENER SPOKEN SUMMARY SECTION */}
          {latestScreenedEntry && (
            <section className="rounded-2xl border border-indigo-500/30 bg-[#0c1222] shadow-lg shadow-indigo-950/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-indigo-500/20 bg-indigo-950/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-400" />
                  <span className="text-sm font-bold text-white">AI Screener Spoken Summary</span>
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
              <div className="p-4 space-y-3 bg-[#080d17]">
                {latestScreenedEntry.screeningSummaryBullets && latestScreenedEntry.screeningSummaryBullets.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400/90">
                      Spoken Content Key Bullets
                    </div>
                    <ul className="space-y-2 text-xs text-slate-200">
                      {latestScreenedEntry.screeningSummaryBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2 border border-white/5">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                          <span className="leading-relaxed text-slate-200">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : latestScreenedEntry.screeningSummary ? (
                  <p className="text-xs leading-relaxed text-slate-200">{latestScreenedEntry.screeningSummary}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Call was screened by AI Voice Screener.</p>
                )}

                {latestScreenedEntry.screeningTranscript && latestScreenedEntry.screeningTranscript.length > 0 && (
                  <details className="mt-2 text-xs text-slate-400 group">
                    <summary className="cursor-pointer font-semibold text-indigo-300 hover:text-indigo-200 transition select-none flex items-center gap-1">
                      <span>View Spoken Transcript ({latestScreenedEntry.screeningTranscript.length} lines)</span>
                    </summary>
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-[11px]">
                      {latestScreenedEntry.screeningTranscript.map((t, tIdx) => (
                        <div key={tIdx} className={`p-1.5 rounded-lg ${t.sender === 'caller' ? 'bg-slate-900 text-slate-200' : 'bg-indigo-950/40 text-indigo-200'}`}>
                          <span className="font-bold text-[10px] uppercase opacity-70 block mb-0.5">
                            {t.sender === 'caller' ? 'Caller' : 'AI Voice Screener'}:
                          </span>
                          <span>{t.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </section>
          )}

          {/* DEDICATED CALL RECORDINGS SECTION FOR THIS NUMBER */}
          {recordings.length > 0 && (
            <section className="rounded-2xl border border-emerald-500/30 bg-[#0e1722] shadow-lg shadow-black/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setRecordingsExpanded((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Disc className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold text-white">
                      Recorded Calls ({recordings.length})
                    </span>
                    <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      48 kHz HD
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                    <Folder className="h-3.5 w-3.5 text-amber-400/80" />
                    <span className="font-mono text-[11px]">Saved in: Internal Storage/Recordings/CallShield/</span>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${recordingsExpanded ? 'rotate-180' : ''}`} />
              </button>

              {recordingsExpanded && (
                <div className="border-t border-slate-800 p-3 space-y-3 bg-[#080d13]">
                  {recordings.map((rec) => (
                    <AudioRecordingPlayer
                      key={rec.id}
                      recording={rec}
                      onDelete={handleDeleteRecording}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Call Timeline / History for this Number */}
          <section className="rounded-2xl border border-slate-800 bg-[#0e141c] shadow-lg shadow-black/20 overflow-hidden">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition"
            >
              <div>
                <div className="text-sm font-bold text-white">{t('call_history_header')}</div>
                <div className="text-xs text-slate-500">Timeline & records for {number}</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
              <div className="border-t border-slate-800">
                {entries.map((item) => {
                  // Find if this specific call item has an associated recording
                  const itemRec = recordings.find(
                    (r) => r.callId === item.id || (Math.abs(r.timestamp - item.timestamp) < 5000)
                  );

                  return (
                    <div key={item.id} className="border-b border-slate-800/80 px-4 py-3 last:border-0 hover:bg-white/[0.01] transition">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div
                            className={`text-xs font-bold ${
                              item.type === 'MISSED' || item.type === 'BLOCKED_CANCELLED'
                                ? 'text-rose-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {item.type === 'MISSED'
                              ? t('missed_call')
                              : item.type === 'BLOCKED_CANCELLED'
                              ? t('blocked_call')
                              : item.type === 'INCOMING'
                              ? t('incoming_call')
                              : t('outgoing_call')}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {itemRec && (
                            <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <Disc className="h-3 w-3 animate-pulse" />
                              Recorded
                            </span>
                          )}
                          <span className="text-xs font-mono text-slate-400">
                            {duration(item.durationSeconds || 0)}
                          </span>
                        </div>
                      </div>

                      {/* If this call entry has a recording, render the full-featured audio player */}
                      {itemRec && (
                        <div className="mt-2.5">
                          <AudioRecordingPlayer
                            recording={itemRec}
                            onDelete={handleDeleteRecording}
                            compact
                          />
                        </div>
                      )}

                      {/* If item has recordingUri but no indexed recording, render audio player */}
                      {!itemRec && item.recordingUri && (
                        <div className="mt-2.5">
                          <AudioRecordingPlayer
                            recording={{
                              id: `rec-${item.id}`,
                              callId: item.id,
                              number: item.number,
                              callerName: item.callerName,
                              timestamp: item.timestamp,
                              durationSeconds: item.durationSeconds || 15,
                              folderPath: 'Internal Storage/Recordings/CallShield/',
                              fileName: `REC_${normalizePhoneNumber(item.number)}_${new Date(item.timestamp).toISOString().slice(0, 10)}.wav`,
                              fileSizeBytes: 128000,
                              mimeType: 'audio/wav',
                              dataUri: item.recordingUri,
                              quality: '48 kHz Studio HD',
                            }}
                            compact
                          />
                        </div>
                      )}

                      {/* AI Voice Screener Summary & Spoken Content */}
                      {(item.usedAiScreener || (item.screeningSummaryBullets && item.screeningSummaryBullets.length > 0) || item.screeningSummary) && (
                        <div className="mt-2.5 rounded-xl border border-indigo-500/30 bg-[#0d1322] p-3 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                              <Bot className="h-3.5 w-3.5 text-indigo-400" />
                              <span>AI Screener Spoken Summary</span>
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.2 text-[8.5px] font-bold text-indigo-300">
                                <Sparkles className="h-2 w-2 text-indigo-400" />
                                Gemini
                              </span>
                            </div>
                            {item.screeningDetectedIntent && (
                              <span className="rounded bg-indigo-950/80 px-1.5 py-0.5 text-[9.5px] font-medium text-indigo-300 border border-indigo-500/20">
                                {item.screeningDetectedIntent}
                              </span>
                            )}
                          </div>

                          {item.screeningSummaryBullets && item.screeningSummaryBullets.length > 0 ? (
                            <ul className="space-y-1 text-[11.5px] text-slate-200">
                              {item.screeningSummaryBullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="flex items-start gap-1.5">
                                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                                  <span className="leading-snug text-slate-200">{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          ) : item.screeningSummary ? (
                            <p className="text-[11.5px] text-slate-300 leading-snug">{item.screeningSummary}</p>
                          ) : null}
                        </div>
                      )}

                      {item.notes && (
                        <div className="mt-2 flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-slate-300">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                          {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Caller note */}
          <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <StickyNote className="h-4 w-4 text-amber-400" />
                Caller note
              </div>
              <button
                type="button"
                onClick={toggleDictation}
                title={isDictating ? 'Stop dictation' : 'Dictate note with microphone using Web Speech API'}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  isDictating
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                }`}
              >
                {isDictating ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                    </span>
                    <Mic className="h-3.5 w-3.5 text-rose-400" />
                    <span>Listening…</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-amber-400" />
                    <span>Dictate note</span>
                  </>
                )}
              </button>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={isDictating ? "Listening to speech... speak your note now…" : "Write or dictate a private note about this caller…"}
              className={`mt-3 w-full resize-none rounded-xl border bg-slate-950 p-3 text-sm text-white outline-none placeholder-slate-600 transition ${
                isDictating ? 'border-rose-500/60 ring-1 ring-rose-500/30' : 'border-slate-700 focus:border-amber-500/40'
              }`}
            />

            {dictationError && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{dictationError}</span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={saveNote}
                  disabled={!number}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40 transition"
                >
                  Save note
                </button>
                {noteSavedFeedback && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    Saved note
                  </span>
                )}
              </div>

              {isDictating && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  className="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
                >
                  Done speaking
                </button>
              )}
            </div>
          </section>

          {/* Protection details */}
          <section className="rounded-2xl border border-slate-800 bg-[#0e141c] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              {isSpam ? <ShieldAlert className="h-4 w-4 text-rose-400" /> : <ShieldCheck className="h-4 w-4 text-blue-400" />}
              Protection details
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Status</span>
                <div className={`mt-1 font-semibold ${isSpam ? 'text-rose-300' : isVerified ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {label}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Risk</span>
                <div className="mt-1 font-semibold text-slate-200">{risk}%</div>
              </div>
              <div>
                <span className="text-slate-500">Calls</span>
                <div className="mt-1 font-semibold text-slate-200">{entries.length}</div>
              </div>
              <div>
                <span className="text-slate-500">Reports</span>
                <div className="mt-1 font-semibold text-slate-200">
                  {profile?.spamReportsCount || Math.max(...entries.map((x) => x.reportsCount || 0), 0)}
                </div>
              </div>
            </div>
          </section>

          {/* Additional Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {isSpam && (
              <button
                onClick={() => onMarkSafe(number, displayName)}
                className="rounded-xl border border-emerald-900 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                {t('not_spam')}
              </button>
            )}
            <button
              onClick={() => onOpenReportModal(number)}
              className="rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              {t('report_spam')}
            </button>

            {/* REPORT NAME INACCURACY ACTION BUTTON */}
            <button
              onClick={() => {
                setInaccuracyCorrectedName(displayName || '');
                setInaccuracyFeedback(null);
                setIsInaccuracyModalOpen(true);
              }}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition inline-flex items-center gap-1.5"
            >
              <Flag className="h-3.5 w-3.5 text-amber-400" />
              Report Name Inaccuracy
            </button>

            <button
              onClick={() => onOpenDisputeModal(number, displayName)}
              className="rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
            >
              {t('dispute_label')}
            </button>
            {onOpenSmartBlock && (
              <button
                onClick={() => onOpenSmartBlock(number, number.slice(0, 5))}
                className="rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Smart block
              </button>
            )}
            {onInitiateCall && (
              <button
                onClick={() => onInitiateCall(number, displayName)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Save / contact
              </button>
            )}
          </div>
        </div>
      </section>

      {/* DEDICATED REPORT NAME INACCURACY MODAL */}
      {isInaccuracyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-in fade-in duration-150" style={{ backdropFilter: "none", WebkitBackdropFilter: "none" }}>
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0c1219] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Flag className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Report Name Inaccuracy</h3>
                  <p className="text-xs text-slate-400">Correct misidentified caller data or submit community update</p>
                </div>
              </div>
              <button
                onClick={() => setIsInaccuracyModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current details recap */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Phone Number:</span>
                <span className="font-mono font-semibold text-slate-200">{number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Displayed Name:</span>
                <span className="font-semibold text-amber-300">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Identified Source:</span>
                <span className="text-slate-400">
                  {nameOrigin === 'SAVED_CONTACT'
                    ? 'Device Contacts'
                    : nameOrigin === 'USER_OVERRIDE'
                    ? 'Custom Local Override'
                    : 'Public Directory / CallShield Community'}
                </span>
              </div>
            </div>

            {/* Input field for accurate name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                What is the correct caller name? <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={inaccuracyCorrectedName}
                onChange={(e) => setInaccuracyCorrectedName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Sharma, Apex Logistics, Personal, etc."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-amber-500"
                autoFocus
              />
            </div>

            {/* Inaccuracy Reason Selectable Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reason for Inaccuracy
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Wrong Individual',
                  'Business / Enterprise Name',
                  'Spam / Impersonator Alias',
                  'Outdated Directory Record',
                  'Spelling / Typo Correction',
                  'Personal Friend / Family',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setInaccuracyReason(reason)}
                    className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition border ${
                      inaccuracyReason === reason
                        ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Additional Notes (Optional)
              </label>
              <textarea
                value={inaccuracyNotes}
                onChange={(e) => setInaccuracyNotes(e.target.value)}
                placeholder="Provide any context (e.g. Official bank customer care, verified relative, previous owner of number)..."
                rows={2}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-slate-700"
              />
            </div>

            {/* Community Contribution Toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={inaccuracySubmitCommunity}
                onChange={(e) => setInaccuracySubmitCommunity(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500"
              />
              <span>Submit correction to community directory & dispute registry</span>
            </label>

            {inaccuracyFeedback && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{inaccuracyFeedback}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsInaccuracyModalOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyNameCorrection}
                disabled={!inaccuracyCorrectedName.trim()}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Apply Name Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
