import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  MessageSquare,
  MoreHorizontal,
  Ban,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Copy,
  Check,
  Share2,
  Clock,
  Mic,
  Disc,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  Bot,
  Building2,
  BookUser,
  AlertTriangle,
  X,
  Sparkles,
  Info,
  UserPlus,
} from 'lucide-react';
import {
  CallLogItem,
  CallClassification,
  CallShieldDirectoryProfile,
  CallRecordingItem,
  ContactItem,
} from '../types';
import { callRecordingService, normalizePhoneNumber } from '../services/callRecordingService';
import { telecomBridge } from '../services/telephony/telecomBridge';
import CallAudioPlayer from './CallAudioPlayer';
import ContactEditorSheet from './ContactEditorSheet';
import { useI18n } from '../i18n/LanguageContext';

interface CallerDetailModalProps {
  call: CallLogItem | null;
  calls?: CallLogItem[];
  contacts?: ContactItem[];
  profile?: CallShieldDirectoryProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onBlockNumber: (number: string, label: string) => void;
  onUnblockNumber?: (number: string) => void;
  onMarkSafe: (number: string, name: string) => void;
  onOpenReportModal?: (number: string) => void;
  onOpenDisputeModal?: (number: string, name: string) => void;
  onUpdateCallerName?: (number: string, newName: string) => void;
  onAddContact?: (contact: Omit<ContactItem, 'id'>) => void;
  onUpdateContact?: (id: string, updates: Partial<ContactItem>) => void;
  onDeleteContact?: (id: string) => void;
  onInitiateCall?: (
    number: string,
    name?: string,
    sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)',
    isPrivate?: boolean
  ) => void;
  onSaveNote?: (callId: string, note: string) => void;
  onSaveCallNote?: (callId: string, note: string) => void;
}

import { formatTimeAmPm } from '../utils/timeFormat';

const formatDuration = (s: number) => {
  if (!s || s <= 0) return '00:00';
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeOfDay = (ts: number) => {
  return formatTimeAmPm(ts);
};

// Group chronological calls by human-friendly day headings
function groupCallsByDay(calls: CallLogItem[], t?: (k: any) => string) {
  const groups: { label: string; items: CallLogItem[] }[] = [];
  const now = new Date();
  const todayStr = now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  calls.forEach((c) => {
    const d = new Date(c.timestamp);
    const dateStr = d.toDateString();
    let label = '';
    if (dateStr === todayStr) {
      label = t ? t('today') : 'Today';
    } else if (dateStr === yesterdayStr) {
      label = t ? t('yesterday') : 'Yesterday';
    } else {
      label = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(c);
    } else {
      groups.push({ label, items: [c] });
    }
  });

  return groups;
}

export default function CallerDetailModal({
  call,
  calls = [],
  contacts = [],
  profile,
  isOpen,
  onClose,
  onBlockNumber,
  onUnblockNumber,
  onMarkSafe,
  onOpenReportModal,
  onOpenDisputeModal,
  onUpdateCallerName,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onInitiateCall,
  onSaveNote,
}: CallerDetailModalProps) {
  const { t } = useI18n();
  // Navigation & View state
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'INCOMING' | 'OUTGOING' | 'MISSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Sheets & dialogs
  const [isContactEditorOpen, setIsContactEditorOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [editingNoteCallId, setEditingNoteCallId] = useState<string | null>(null);
  const [draftNoteText, setDraftNoteText] = useState('');

  // Call-specific notes state (keyed by call.id)
  const [callNotesMap, setCallNotesMap] = useState<Record<string, string>>({});
  const [recordings, setRecordings] = useState<CallRecordingItem[]>([]);

  // Feedbacks
  const [copyNumberFeedback, setCopyNumberFeedback] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const number = call?.number || profile?.number || '';
  const key = normalizePhoneNumber(number);

  // Reset all search, filter, and expanded states
  const resetModalState = useCallback(() => {
    setExpandedCallId(null);
    setFilterType('ALL');
    setSearchQuery('');
    setIsSearchActive(false);
    setEditingNoteCallId(null);
    setDraftNoteText('');
    setIsContactEditorOpen(false);
    setIsBlockConfirmOpen(false);
    setIsMoreMenuOpen(false);
    setToastMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [resetModalState, onClose]);

  // Reset when isOpen becomes false or when the caller number changes
  useEffect(() => {
    if (!isOpen) {
      resetModalState();
    }
  }, [isOpen, resetModalState]);

  useEffect(() => {
    resetModalState();
  }, [number, resetModalState]);

  // Load recordings and call-specific notes for this caller
  useEffect(() => {
    if (!isOpen || !number) return;

    // Load indexed recordings
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
          quality: '48 kHz Studio Lossless',
        }));

      const combined = [
        ...items,
        ...callsWithRecs.filter((c) => !items.some((it) => it.dataUri === c.dataUri)),
      ];
      setRecordings(combined);
    });

    // Load call-specific notes from localStorage
    try {
      const raw = localStorage.getItem('vigilshield_call_event_notes_v1');
      if (raw) {
        setCallNotesMap(JSON.parse(raw));
      }
    } catch {}
  }, [isOpen, number, key, calls]);

  // Identify saved contact
  const cleanDigits = number.replace(/\D/g, '');
  const clean10 = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;

  const savedContact = useMemo(() => {
    if (!cleanDigits) return null;
    return (
      contacts.find((c) => {
        const cClean = (c.number || '').replace(/\D/g, '');
        const c10 = cClean.length >= 10 ? cClean.slice(-10) : cClean;
        return cClean === cleanDigits || (clean10 && c10 === clean10);
      }) || null
    );
  }, [contacts, cleanDigits, clean10]);

  const isSaved = Boolean(savedContact || call?.isContact);
  const savedName = savedContact?.name || (call?.isContact ? call.callerName : null);

  // Directory intelligence name (if available)
  const directoryName = useMemo(() => {
    if (profile?.name && profile.name !== number && !profile.name.includes('+91') && profile.name !== cleanDigits) {
      return profile.name;
    }
    if (call?.callerName && call.callerName !== number && !call.isContact) {
      return call.callerName;
    }
    return null;
  }, [profile, call, number, cleanDigits]);

  // Name hierarchy
  const primaryDisplayName = savedName || directoryName || number;
  const hasDistinctDirectoryName = Boolean(
    directoryName && savedName && directoryName.toLowerCase().trim() !== savedName.toLowerCase().trim()
  );

  // Blocked status check
  const isBlocked = useMemo(() => {
    try {
      const raw = localStorage.getItem('callshield_rules');
      if (raw) {
        const rules = JSON.parse(raw);
        if (Array.isArray(rules)) {
          return rules.some((r: any) => normalizePhoneNumber(r.value || '') === key && r.enabled !== false);
        }
      }
    } catch {}
    return Boolean(call?.isSpam && call?.userAction === 'BLOCKED');
  }, [key, call]);

  // Safety Classification Badge
  const allCallerCalls = useMemo(() => {
    return calls.filter((c) => normalizePhoneNumber(c.number) === key).sort((a, b) => b.timestamp - a.timestamp);
  }, [calls, key]);

  const callerHistory = allCallerCalls.length > 0 ? allCallerCalls : call ? [call] : [];

  const classification: CallClassification = useMemo(() => {
    if (callerHistory.some((c) => c.classification === 'SCAM') || profile?.riskLevel === 'HIGH_RISK') return 'SCAM';
    if (callerHistory.some((c) => c.isSpam || c.classification === 'SPAM' || c.riskScore >= 60) || profile?.isSpam)
      return 'SPAM';
    if (callerHistory.some((c) => c.isVerifiedBusiness) || profile?.isVerified) return 'VERIFIED';
    if (isSaved) return 'SAFE';
    if (profile?.spamScore === 0 && profile?.name) return 'SAFE';
    return 'UNKNOWN';
  }, [callerHistory, profile, isSaved]);

  const spamReportsCount = profile?.spamReportsCount || Math.max(...callerHistory.map((c) => c.reportsCount || 0), 0);

  // Social / Communication Apps availability
  const messagingApps = useMemo(() => {
    if (!number || cleanDigits.length < 5) return [];

    let intl = cleanDigits;
    if (cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) {
      intl = `91${cleanDigits}`;
    } else if (number.startsWith('+')) {
      intl = cleanDigits;
    }

    return [
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        color: '#25D366',
        icon: (
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.05 7.42C8.87 7.42 8.57 7.49 8.32 7.76C8.07 8.04 7.35 8.71 7.35 10.07C7.35 11.43 8.34 12.74 8.48 12.93C8.62 13.12 10.42 15.91 13.18 17.1C15.47 18.09 15.94 17.89 16.43 17.85C16.92 17.8 18 17.21 18.23 16.56C18.46 15.91 18.46 15.35 18.39 15.24C18.32 15.13 18.14 15.06 17.86 14.92C17.58 14.78 16.21 14.11 15.96 14.02C15.71 13.93 15.53 13.88 15.35 14.16C15.17 14.44 14.65 15.05 14.49 15.24C14.33 15.42 14.17 15.45 13.89 15.31C13.61 15.17 12.71 14.88 11.65 13.93C10.82 13.19 10.26 12.28 10.1 12C9.94 11.72 10.08 11.58 10.22 11.44C10.35 11.31 10.51 11.1 10.65 10.94C10.79 10.78 10.84 10.66 10.93 10.48C11.02 10.3 10.97 10.14 10.9 10C10.83 9.86 10.28 8.52 10.05 7.97C9.83 7.44 9.61 7.51 9.44 7.5C9.28 7.49 9.09 7.42 9.05 7.42Z" />
          </svg>
        ),
        launch: () => {
          const appUrl = `whatsapp://send?phone=${intl}`;
          const webUrl = `https://api.whatsapp.com/send?phone=${intl}`;
          const opened = telecomBridge.openExternalApp(appUrl) || telecomBridge.openExternalApp(webUrl);
          if (!opened) window.open(webUrl, '_blank', 'noopener,noreferrer');
        },
      },
      {
        id: 'telegram',
        name: 'Telegram',
        color: '#229ED9',
        icon: (
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        ),
        launch: () => {
          const appUrl = `tg://resolve?phone=${intl}`;
          const webUrl = `https://t.me/+${intl}`;
          const opened = telecomBridge.openExternalApp(appUrl) || telecomBridge.openExternalApp(webUrl);
          if (!opened) window.open(webUrl, '_blank', 'noopener,noreferrer');
        },
      },
    ];
  }, [number, cleanDigits]);

  // Copy phone number
  const handleCopyNumber = () => {
    if (!number) return;
    navigator.clipboard?.writeText(number);
    setCopyNumberFeedback(true);
    setTimeout(() => setCopyNumberFeedback(false), 2000);
  };

  // Launch SMS
  const handleLaunchSMS = () => {
    const smsUrl = `sms:${number}`;
    const opened = telecomBridge.openExternalApp(smsUrl);
    if (!opened) window.open(smsUrl, '_blank');
  };

  // Call Back action
  const handleCall = (isPrivate = false) => {
    onInitiateCall?.(number, primaryDisplayName, undefined, isPrivate);
  };

  // Block / Unblock handler
  const handleToggleBlock = () => {
    if (isBlocked) {
      onMarkSafe(number, primaryDisplayName);
      setToastMessage('Number unblocked and marked safe');
      setTimeout(() => setToastMessage(null), 2500);
    } else {
      setIsBlockConfirmOpen(true);
    }
    setIsMoreMenuOpen(false);
  };

  const handleConfirmBlock = () => {
    onBlockNumber(number, primaryDisplayName);
    setIsBlockConfirmOpen(false);
    setToastMessage('Number blocked successfully');
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Note saving for a specific call ID
  const handleSaveCallNote = (callId: string) => {
    const trimmed = draftNoteText.trim();
    const updated = { ...callNotesMap };
    if (trimmed) {
      updated[callId] = trimmed;
    } else {
      delete updated[callId];
    }
    setCallNotesMap(updated);
    try {
      localStorage.setItem('vigilshield_call_event_notes_v1', JSON.stringify(updated));
    } catch {}

    onSaveNote?.(callId, trimmed);
    setEditingNoteCallId(null);
    setDraftNoteText('');
    setToastMessage(trimmed ? 'Note saved to this call' : 'Note removed');
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Delete recording
  const handleDeleteRecording = async (recId: string) => {
    await callRecordingService.deleteRecording(recId);
    setRecordings((prev) => prev.filter((r) => r.id !== recId));
    setToastMessage('Recording deleted');
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Filtered & Searched calls
  const filteredCalls = useMemo(() => {
    return callerHistory.filter((c) => {
      // Type filter
      if (filterType === 'INCOMING' && c.type !== 'INCOMING') return false;
      if (filterType === 'OUTGOING' && c.type !== 'OUTGOING') return false;
      if (filterType === 'MISSED' && c.type !== 'MISSED') return false;

      // Search filter (searches date, note, or type)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const callNote = (callNotesMap[c.id] || c.notes || '').toLowerCase();
        const typeStr = c.type.toLowerCase();
        const dateStr = new Date(c.timestamp).toLocaleDateString().toLowerCase();
        return callNote.includes(q) || typeStr.includes(q) || dateStr.includes(q);
      }

      return true;
    });
  }, [callerHistory, filterType, searchQuery, callNotesMap]);

  const groupedCalls = useMemo(() => groupCallsByDay(filteredCalls, t), [filteredCalls, t]);

  // Aggregate stats
  const totalCallsCount = callerHistory.length;
  const totalSeconds = callerHistory.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
  const incomingCount = callerHistory.filter((c) => c.type === 'INCOMING').length;
  const outgoingCount = callerHistory.filter((c) => c.type === 'OUTGOING').length;
  const missedCount = callerHistory.filter((c) => c.type === 'MISSED').length;
  const totalMinutes = Math.round(totalSeconds / 60);

  if (!isOpen || (!call && !profile)) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 select-none cursor-pointer"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#070b12] sm:h-auto sm:max-h-[92vh] sm:rounded-[32px] sm:border sm:border-slate-800/90 shadow-2xl relative cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Toast Notice */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-slate-800/95 border border-white/10 px-4 py-1.5 text-xs font-semibold text-white shadow-xl shadow-black/80 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* =========================================================================
            TOP CALLER HEADER (Compact, Modern, Native 2026 Mobile Look)
           ========================================================================= */}
        <header className="relative border-b border-slate-800/70 bg-gradient-to-b from-[#0f1726]/80 via-[#0a0f19] to-[#070b12] px-5 pt-4 pb-4">
          {/* Top navigation row: back/close & search toggle */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800/80 hover:text-white transition active:scale-95"
              aria-label="Back"
              title="Back to previous page"
            >
              <ArrowLeft className="h-5 w-5 text-slate-300" />
              <span className="text-xs font-semibold text-slate-300">Back</span>
            </button>

            {/* Quick search toggle */}
            <div className="flex items-center gap-1.5">
              {totalCallsCount > 3 && (
                <button
                  type="button"
                  onClick={() => setIsSearchActive((v) => !v)}
                  className={`rounded-full p-2 transition ${
                    isSearchActive ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                  }`}
                  title="Search calls & notes"
                  aria-label="Search calls and notes"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Caller Identity Container */}
          <div className="mt-2 flex flex-col items-center text-center">
            {/* Caller Avatar */}
            <div className="relative">
              <div
                className={`grid h-20 w-20 place-items-center rounded-full text-2xl font-black shadow-xl ring-4 ${
                  classification === 'SPAM' || classification === 'SCAM'
                    ? 'bg-rose-950/90 text-rose-200 ring-rose-500/30 border border-rose-500/40'
                    : classification === 'VERIFIED'
                    ? 'bg-blue-950/90 text-blue-200 ring-blue-500/30 border border-blue-500/40'
                    : isSaved
                    ? 'bg-indigo-950/90 text-indigo-200 ring-indigo-500/30 border border-indigo-500/40'
                    : 'bg-slate-900 text-slate-200 ring-slate-700/30 border border-slate-700/50'
                }`}
              >
                {profile?.isVerified ? (
                  <Building2 className="h-8 w-8 text-blue-400" />
                ) : (
                  (primaryDisplayName || number).trim()[0]?.toUpperCase() || '📞'
                )}
              </div>

              {classification === 'VERIFIED' && (
                <div className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-blue-500 text-white shadow-md">
                  <ShieldCheck className="h-3.5 w-3.5 fill-current" />
                </div>
              )}
              {classification === 'SPAM' && (
                <div className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white shadow-md">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
              )}
            </div>

            {/* Caller Name Hierarchy */}
            <div className="mt-3 max-w-full px-4">
              <h2 className="text-xl font-extrabold text-white tracking-tight truncate">
                {primaryDisplayName}
              </h2>

              {/* Source attribution & distinction */}
              {isSaved ? (
                <div className="mt-0.5 flex flex-col items-center">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <BookUser className="h-3 w-3" />
                    Saved Contact
                  </span>
                  {hasDistinctDirectoryName && (
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Directory name: <span className="text-slate-300 font-medium">{directoryName}</span>
                    </span>
                  )}
                </div>
              ) : directoryName ? (
                <div className="mt-0.5 flex items-center justify-center gap-1.5">
                  <span className="text-xs text-indigo-400 font-medium">Directory: {directoryName}</span>
                </div>
              ) : null}

              {/* Copyable Phone Number */}
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyNumber}
                  className="group inline-flex items-center gap-1.5 font-mono text-xs text-slate-300 hover:text-white transition rounded-full px-2 py-0.5 hover:bg-white/5 active:scale-95"
                  title="Copy number"
                >
                  <span>{number}</span>
                  {copyNumberFeedback ? (
                    <span className="text-emerald-400 font-sans text-[10px] font-bold">Copied!</span>
                  ) : (
                    <Copy className="h-3 w-3 text-slate-500 group-hover:text-slate-300" />
                  )}
                </button>
              </div>

              {/* Caller Safety Status Badge */}
              <div className="mt-2 flex items-center justify-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ${
                    classification === 'SPAM' || classification === 'SCAM'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : classification === 'VERIFIED'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : classification === 'SAFE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      classification === 'SPAM' || classification === 'SCAM'
                        ? 'bg-rose-400'
                        : classification === 'VERIFIED'
                        ? 'bg-blue-400'
                        : classification === 'SAFE'
                        ? 'bg-emerald-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>
                    {classification === 'SPAM'
                      ? 'Spam'
                      : classification === 'SCAM'
                      ? 'Potential Scam'
                      : classification === 'VERIFIED'
                      ? 'Verified Business'
                      : classification === 'SAFE'
                      ? 'Safe'
                      : 'Unknown'}
                  </span>
                </span>

                {spamReportsCount > 0 && (
                  <span className="text-[10px] text-slate-400">
                    {spamReportsCount} community {spamReportsCount === 1 ? 'report' : 'reports'}
                  </span>
                )}
              </div>
            </div>

            {/* =========================================================================
                PRIMARY ACTIONS ROW (☎ Call, 💬 Message, ⋯ More)
               ========================================================================= */}
            <div className="mt-4 flex items-center justify-center gap-2.5 w-full max-w-sm px-2">
              {/* Primary Call Button */}
              <button
                type="button"
                onClick={() => handleCall(false)}
                className="flex-1 min-w-[90px] flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 py-3 px-3 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 transition active:scale-95 cursor-pointer"
                title={t('call_action_label')}
              >
                <Phone className="h-4 w-4 fill-current shrink-0" />
                <span>{t('call_action_label')}</span>
              </button>

              {/* Message (SMS) Button */}
              <button
                type="button"
                onClick={handleLaunchSMS}
                className="flex-1 min-w-[90px] flex items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 py-3 px-3 text-slate-200 font-semibold text-xs transition active:scale-95 cursor-pointer"
                title={t('message_action_label')}
              >
                <MessageSquare className="h-4 w-4 text-purple-400 shrink-0" />
                <span>{t('message_action_label')}</span>
              </button>

              {/* Dynamic Messaging Apps (e.g. WhatsApp) */}
              {messagingApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={app.launch}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-900/90 hover:bg-slate-800 text-white transition active:scale-95 cursor-pointer"
                  title={`Open ${app.name} chat`}
                  aria-label={`Open ${app.name} chat`}
                >
                  <span style={{ color: app.color }}>{app.icon}</span>
                </button>
              ))}

              {/* More Options Menu Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((v) => !v)}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition active:scale-95 cursor-pointer ${
                    isMoreMenuOpen
                      ? 'border-indigo-500 bg-slate-800 text-white shadow-md'
                      : 'border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 text-slate-300'
                  }`}
                  title={t('more_options_label')}
                  aria-label={t('more_options_label')}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {/* More Popup Menu with backdrop click shield */}
                {isMoreMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setIsMoreMenuOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-slate-800 bg-[#0e1422] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleCall(true);
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition cursor-pointer text-left"
                      >
                        <Phone className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span>{t('call_private_label')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          setIsContactEditorOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition cursor-pointer text-left"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span>{isSaved ? t('edit_contact') : t('add_to_contacts')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleCopyNumber();
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition cursor-pointer text-left"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{t('copy_number_action')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          if (navigator.share) {
                            navigator.share({
                              title: primaryDisplayName,
                              text: `Phone: ${number}`,
                            }).catch(() => {});
                          } else {
                            handleCopyNumber();
                          }
                        }}
                        className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-800/80 transition cursor-pointer text-left"
                      >
                        <Share2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{t('share_contact_action')}</span>
                      </button>

                      <div className="my-1 border-t border-slate-800" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          handleToggleBlock();
                        }}
                        className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer text-left ${
                          isBlocked
                            ? 'text-emerald-400 hover:bg-emerald-950/40'
                            : 'text-rose-400 hover:bg-rose-950/40'
                        }`}
                      >
                        <Ban className="h-3.5 w-3.5 shrink-0" />
                        <span>{isBlocked ? t('unblock_number_action') : t('block_number_action')}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Secondary Strip (Add/Edit Contact & Block Button) */}
            <div className="mt-3.5 flex items-center justify-center gap-4 text-xs font-medium text-slate-400">
              <button
                type="button"
                onClick={() => setIsContactEditorOpen(true)}
                className="hover:text-white transition flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer"
              >
                {isSaved ? <Edit2 className="h-3.5 w-3.5 text-indigo-400" /> : <UserPlus className="h-3.5 w-3.5 text-blue-400" />}
                <span>{isSaved ? t('edit_contact') : t('add_contact')}</span>
              </button>

              <span className="text-slate-700">•</span>

              <button
                type="button"
                onClick={handleToggleBlock}
                className={`transition flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800/50 font-semibold cursor-pointer ${
                  isBlocked ? 'text-emerald-400 hover:text-emerald-300' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <Ban className="h-3.5 w-3.5" />
                <span>{isBlocked ? t('unblock_number_action') : t('block_number_action')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* =========================================================================
            CALL HISTORY & PROGRESSIVE DISCLOSURE BODY
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Subtle Call Statistics Strip */}
          {totalCallsCount > 0 && (
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 font-medium">
                <span className="font-bold text-white">{totalCallsCount} {t('calls_count_suffix')}</span>
                <span>•</span>
                <span>{incomingCount} {t('in_suffix')}</span>
                <span>•</span>
                <span>{outgoingCount} {t('out_suffix')}</span>
                {missedCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-rose-400 font-semibold">{missedCount} {t('missed_suffix')}</span>
                  </>
                )}
              </div>
              {totalMinutes > 0 && (
                <div className="text-slate-500 font-medium">{t('talk_time_label')}: {totalMinutes}m</div>
              )}
            </div>
          )}

          {/* Search Bar (Revealed if toggled) */}
          {isSearchActive && (
            <div className="relative animate-in fade-in duration-150">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search_date_notes_placeholder')}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Clean Segmented Filter Bar: All · Incoming · Outgoing · Missed */}
          {totalCallsCount > 1 && (
            <div className="flex items-center gap-1 rounded-xl bg-slate-950/70 p-1 border border-slate-800/80 text-xs">
              {(['ALL', 'INCOMING', 'OUTGOING', 'MISSED'] as const).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setFilterType(ft)}
                  className={`flex-1 rounded-lg py-1.5 text-center font-semibold text-[11px] transition cursor-pointer ${
                    filterType === ft
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ft === 'ALL'
                    ? t('filter_type_all')
                    : ft === 'INCOMING'
                    ? t('filter_type_incoming')
                    : ft === 'OUTGOING'
                    ? t('filter_type_outgoing')
                    : t('filter_type_missed')}
                </button>
              ))}
            </div>
          )}

          {/* Chronological Timeline Groups */}
          {filteredCalls.length === 0 ? (
            <div className="rounded-2xl border border-slate-800/80 bg-[#0a0f19] p-8 text-center text-slate-500 my-4">
              <Clock className="mx-auto h-7 w-7 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">
                {searchQuery ? t('no_calls_found') : t('no_calls_yet_title')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {searchQuery ? t('search_recents_placeholder') : t('no_calls_yet_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCalls.map((group) => (
                <div key={group.label} className="space-y-2">
                  {/* Day Divider Label */}
                  <div className="sticky top-0 z-10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-[#070b12]/95 backdrop-blur-sm">
                    {group.label}
                  </div>

                  {/* Individual Call Cards */}
                  <div className="space-y-2">
                    {group.items.map((c) => {
                      const isExpanded = expandedCallId === c.id;

                      // Exact recording for THIS specific call
                      const callRec = recordings.find(
                        (r) => r.callId === c.id || Math.abs(r.timestamp - c.timestamp) < 5000
                      );

                      // Exact note for THIS specific call
                      const callNote = callNotesMap[c.id] || c.notes || '';
                      const isEditingThisNote = editingNoteCallId === c.id;

                      return (
                        <div
                          key={c.id}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            isExpanded
                              ? 'border-indigo-500/40 bg-[#0c1220] shadow-lg shadow-black/40'
                              : 'border-slate-800/80 bg-[#0a0f19] hover:border-slate-700/90'
                          }`}
                        >
                          {/* COLLAPSED ROW (Show important info first: time, direction, duration, indicators) */}
                          <div
                            className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                            onClick={() => setExpandedCallId(isExpanded ? null : c.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Call Direction Icon */}
                              <div
                                className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${
                                  c.type === 'INCOMING'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : c.type === 'OUTGOING'
                                    ? 'bg-sky-500/10 text-sky-400'
                                    : c.type === 'MISSED'
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}
                              >
                                {c.type === 'INCOMING' ? (
                                  <PhoneIncoming className="h-4 w-4" />
                                ) : c.type === 'OUTGOING' ? (
                                  <PhoneOutgoing className="h-4 w-4" />
                                ) : c.type === 'MISSED' ? (
                                  <PhoneMissed className="h-4 w-4" />
                                ) : (
                                  <PhoneOff className="h-4 w-4" />
                                )}
                              </div>

                              {/* Direction & Time */}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-white">
                                    {formatTimeOfDay(c.timestamp)}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {c.type === 'INCOMING'
                                      ? 'Incoming'
                                      : c.type === 'OUTGOING'
                                      ? 'Outgoing'
                                      : c.type === 'MISSED'
                                      ? 'Missed'
                                      : 'Blocked'}
                                  </span>
                                  {c.type !== 'MISSED' && (
                                    <span className="text-slate-600 text-[10px]">•</span>
                                  )}
                                  {c.type !== 'MISSED' && (
                                    <span className="text-[11px] font-mono text-slate-300">
                                      {formatDuration(c.durationSeconds || 0)}
                                    </span>
                                  )}
                                </div>

                                {/* Compact Indicators for Recording & Note (Belonging to this exact call) */}
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  {callRec && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-300">
                                      <Disc className="h-2.5 w-2.5 animate-pulse text-emerald-400" />
                                      Recording
                                    </span>
                                  )}
                                  {callNote && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-300 truncate max-w-[180px]">
                                      <span>📝</span>
                                      <span className="truncate">{callNote}</span>
                                    </span>
                                  )}
                                  {c.usedAiScreener && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-300">
                                      <Bot className="h-2.5 w-2.5" />
                                      AI Screened
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* View details progressive disclosure toggle */}
                            <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
                              <span className="text-[11px] font-semibold text-slate-400 hover:text-white transition">
                                {isExpanded ? 'Hide' : 'View details'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </div>

                          {/* =================================================================
                              EXPANDED STATE (Revealed only when user taps "View details")
                             ================================================================= */}
                          {isExpanded && (
                            <div className="border-t border-slate-800/80 bg-[#080d17] p-4 space-y-3.5 animate-in fade-in duration-150">
                              {/* Exact Metadata Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
                                  <div className="text-[10px] text-slate-500 font-medium">Status</div>
                                  <div className="mt-0.5 font-bold text-white">
                                    {c.type === 'MISSED' ? 'Missed' : 'Answered'}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
                                  <div className="text-[10px] text-slate-500 font-medium">Duration</div>
                                  <div className="mt-0.5 font-mono font-bold text-slate-200">
                                    {formatDuration(c.durationSeconds || 0)}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
                                  <div className="text-[10px] text-slate-500 font-medium">Time</div>
                                  <div className="mt-0.5 font-bold text-slate-200">
                                    {formatTimeOfDay(c.timestamp)}
                                  </div>
                                </div>

                                <div className="rounded-xl bg-slate-900/80 border border-slate-800/80 p-2">
                                  <div className="text-[10px] text-slate-500 font-medium">Network</div>
                                  <div className="mt-0.5 font-bold text-slate-200 truncate">
                                    {c.sim || 'Cellular'}
                                  </div>
                                </div>
                              </div>

                              {/* AI Voice Screening Transcript/Summary (if call was screened) */}
                              {(c.screeningSummary || (c.screeningSummaryBullets && c.screeningSummaryBullets.length > 0)) && (
                                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 text-xs">
                                  <div className="flex items-center gap-1.5 font-bold text-indigo-300 mb-1">
                                    <Bot className="h-3.5 w-3.5 text-indigo-400" />
                                    <span>AI Assistant Spoken Summary</span>
                                  </div>
                                  {c.screeningSummaryBullets && c.screeningSummaryBullets.length > 0 ? (
                                    <ul className="space-y-1 text-slate-300">
                                      {c.screeningSummaryBullets.map((b, idx) => (
                                        <li key={idx} className="flex items-start gap-1.5">
                                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                                          <span>{b}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-slate-300">{c.screeningSummary}</p>
                                  )}
                                </div>
                              )}

                              {/* Individual Call Recording Audio Player (Belongs strictly to THIS call) */}
                              {callRec && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                                      <Disc className="h-3.5 w-3.5 text-emerald-400" />
                                      <span>Recording</span>
                                      <span className="text-[10px] text-slate-400 font-normal">
                                        • {formatDuration(callRec.durationSeconds)}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      {callRec.quality || '48 kHz HD'}
                                    </span>
                                  </div>

                                  <CallAudioPlayer
                                    recording={callRec}
                                    onDelete={handleDeleteRecording}
                                  />
                                </div>
                              )}

                              {/* Individual Call Note (Belongs strictly to THIS call) */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                                    <span>📝</span>
                                    <span>Call Note</span>
                                  </span>

                                  {!isEditingThisNote && !callNote && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNoteCallId(c.id);
                                        setDraftNoteText('');
                                      }}
                                      className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span>Add note</span>
                                    </button>
                                  )}
                                </div>

                                {isEditingThisNote ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={draftNoteText}
                                      onChange={(e) => setDraftNoteText(e.target.value)}
                                      placeholder="e.g. Customer requested a callback tomorrow at 10 AM..."
                                      rows={2}
                                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white outline-none focus:border-indigo-500 placeholder-slate-500"
                                      autoFocus
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNoteCallId(null);
                                          setDraftNoteText('');
                                        }}
                                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveCallNote(c.id)}
                                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md cursor-pointer"
                                      >
                                        Save Note
                                      </button>
                                    </div>
                                  </div>
                                ) : callNote ? (
                                  <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                                    <p className="text-slate-200 leading-relaxed italic">
                                      "{callNote}"
                                    </p>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNoteCallId(c.id);
                                          setDraftNoteText(callNote);
                                        }}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                                        title="Edit note"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDraftNoteText('');
                                          handleSaveCallNote(c.id);
                                        }}
                                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-950/40 hover:text-rose-400 cursor-pointer"
                                        title="Delete note"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              {/* Per-Call Quick Actions Bar */}
                              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => handleCall(false)}
                                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-bold text-emerald-300 transition active:scale-95 cursor-pointer"
                                >
                                  <Phone className="h-3 w-3 fill-current" />
                                  <span>Call back</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleLaunchSMS}
                                  className="flex items-center gap-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 px-3.5 py-1.5 text-xs font-bold text-purple-300 transition active:scale-95 cursor-pointer"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <span>Message</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Caller Intelligence (Only rendered if authentic external directory data exists) */}
          {profile && (profile.businessCategory || profile.carrier || profile.isVerified) && (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0a0f19] p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Caller Information</span>
                </span>
                {onOpenReportModal && (
                  <button
                    type="button"
                    onClick={() => onOpenReportModal(number)}
                    className="text-[10px] font-semibold text-amber-400 hover:underline"
                  >
                    Report Incorrect Info
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                {profile.businessCategory && (
                  <div>
                    <span className="text-slate-500">Category:</span>
                    <div className="text-slate-200 font-semibold">{profile.businessCategory}</div>
                  </div>
                )}
                {profile.carrier && (
                  <div>
                    <span className="text-slate-500">Carrier:</span>
                    <div className="text-slate-200 font-semibold">{profile.carrier}</div>
                  </div>
                )}
                {profile.location && (
                  <div>
                    <span className="text-slate-500">Location:</span>
                    <div className="text-slate-200 font-semibold">{profile.location}</div>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">Directory Source:</span>
                  <div className="text-slate-200 font-semibold">Authorized Registry</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            CONFIRM BLOCK BOTTOM SHEET / DIALOG
           ========================================================================= */}
        {isBlockConfirmOpen && (
          <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0e1422] p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                  <Ban className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Block this number?</h4>
                  <p className="text-xs text-slate-400">{number}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Calls from this number will be blocked according to your current protection settings and firewall rules.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBlockConfirmOpen(false)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlock}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-950/50 transition active:scale-95 cursor-pointer"
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SAVED CONTACT EDITING SHEET
           ========================================================================= */}
        <ContactEditorSheet
          isOpen={isContactEditorOpen}
          onClose={() => setIsContactEditorOpen(false)}
          initialName={savedName || directoryName || ''}
          initialNumber={number}
          existingContact={savedContact}
          onSaveContact={(cData) => {
            if (cData.id && onUpdateContact) {
              onUpdateContact(cData.id, { name: cData.name, number: cData.number });
            } else if (onAddContact) {
              onAddContact({
                name: cData.name,
                number: cData.number,
                category: cData.category || 'GENERAL',
                trusted: true,
              });
            }
            if (onUpdateCallerName) {
              onUpdateCallerName(cData.number, cData.name);
            }
            setToastMessage('Contact saved to device');
            setTimeout(() => setToastMessage(null), 2500);
          }}
          onDeleteContact={onDeleteContact}
        />
      </div>
    </div>,
    document.body
  );
}
