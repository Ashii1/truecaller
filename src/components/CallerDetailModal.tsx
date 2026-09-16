import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  Disc,
  Edit2,
  Folder,
  Phone,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  UserPlus,
  X,
} from 'lucide-react';
import { CallLogItem, CallClassification, TruecallerDirectoryProfile, CallRecordingItem } from '../types';
import { useI18n } from '../i18n/LanguageContext';
import { callRecordingService, normalizePhoneNumber } from '../services/callRecordingService';
import AudioRecordingPlayer from './AudioRecordingPlayer';

interface CallerDetailModalProps {
  call: CallLogItem | null;
  calls?: CallLogItem[];
  profile?: TruecallerDirectoryProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onBlockNumber: (number: string, label: string) => void;
  onMarkSafe: (number: string, name: string) => void;
  onOpenReportModal: (number: string) => void;
  onOpenDisputeModal: (number: string, name: string) => void;
  onUpdateCallerName?: (number: string, newName: string) => void;
  onOpenSmartBlock?: (number: string, pattern: string) => void;
  onInitiateCall?: (number: string, name?: string) => void;
  onSaveNote?: (callId: string, note: string) => void;
}

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CallerDetailModal({
  call,
  calls = [],
  profile,
  isOpen,
  onClose,
  onBlockNumber,
  onMarkSafe,
  onOpenReportModal,
  onOpenDisputeModal,
  onUpdateCallerName,
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
  const [recordings, setRecordings] = useState<CallRecordingItem[]>([]);

  const number = call?.number || profile?.number || '';
  const key = normalizePhoneNumber(number);

  useEffect(() => {
    if (isOpen) {
      setExpanded(true);
      setRecordingsExpanded(true);
      setEditing(false);
      setName(call?.callerName || profile?.name || '');
      setNote(call?.notes || '');

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
              folderPath: 'Internal Storage/Recordings/VigilShield/',
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

  if (!isOpen || (!call && !profile)) return null;

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
    if (call && onSaveNote) onSaveNote(call.id, note.trim());
  };

  const handleDeleteRecording = async (id: string) => {
    await callRecordingService.deleteRecording(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
      <section className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-[#0a1017] sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] sm:border sm:border-slate-800 sm:shadow-2xl">
        {/* Header */}
        <header className={`border-b px-5 py-5 ${isSpam ? 'border-rose-900/60 bg-rose-950/20' : 'border-slate-800 bg-[#0e1622]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${isSpam ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : isVerified ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                  {isSpam ? '⚠ ' : ''}{label}
                </span>
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
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-2xl font-bold text-white">{name || t('unknown_caller')}</h2>
                  {onUpdateCallerName && (
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-lg p-1 text-slate-500 hover:text-white transition"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <p className="mt-1 font-mono text-sm text-slate-400">
                {number}
                {profile?.location ? ` · ${profile.location}` : ''}
                {profile?.carrier ? ` · ${profile.carrier}` : ''}
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isSpam && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-rose-800/60 bg-rose-950/40 p-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div>
                <div className="text-sm font-semibold text-rose-200">Spam signals detected</div>
                <div className="mt-1 text-xs leading-5 text-rose-300/80">
                  {call?.spamReason || profile?.spamReason || 'This caller has protection signals. Unknown callers are not treated as safe.'}
                </div>
                <div className="mt-1 text-xs text-rose-300">
                  {profile?.spamReportsCount || call?.reportsCount || 0} reports · {risk}% risk
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onInitiateCall?.(number, name)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-600/20 transition"
            >
              <Phone className="h-4 w-4 fill-current" />
              {t('call_action')}
            </button>
            <button
              onClick={() => onBlockNumber(number, name)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              <Ban className="h-4 w-4" />
              {t('block_action')}
            </button>
          </div>

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
                    <span className="font-mono text-[11px]">Saved in: Internal Storage/Recordings/VigilShield/</span>
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
                              folderPath: 'Internal Storage/Recordings/VigilShield/',
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
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <StickyNote className="h-4 w-4 text-amber-400" />
              Caller note
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Write a private note about this caller…"
              className="mt-3 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none placeholder-slate-600 focus:border-amber-500/40"
            />
            <button
              onClick={saveNote}
              disabled={!call || !onSaveNote}
              className="mt-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40 transition"
            >
              Save note
            </button>
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
                onClick={() => onMarkSafe(number, name)}
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
            <button
              onClick={() => onOpenDisputeModal(number, name)}
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
                onClick={() => onInitiateCall(number, name)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Save / contact
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
