import { useEffect, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Edit2, Phone, ShieldCheck, UserPlus, X } from 'lucide-react';
import { CallLogItem, CallClassification, TruecallerDirectoryProfile } from '../types';

interface CallerDetailModalProps {
  call: CallLogItem | null;
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
}

export default function CallerDetailModal({ call, profile, isOpen, onClose, onBlockNumber, onMarkSafe, onOpenReportModal, onOpenDisputeModal, onUpdateCallerName, onOpenSmartBlock, onInitiateCall }: CallerDetailModalProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setExpanded(false);
    setEditing(false);
    setName(call?.callerName || profile?.name || '');
    document.body.classList.remove('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [isOpen, call, profile]);

  if (!isOpen || (!call && !profile)) return null;

  const number = call?.number || profile?.number || '';
  const callerName = call?.callerName || profile?.name || 'Unknown caller';
  const classification: CallClassification = call?.classification || (profile?.isVerified ? 'VERIFIED' : profile?.isSpam ? 'SPAM' : 'UNKNOWN');
  const risk = call?.riskScore ?? profile?.spamScore ?? 0;
  const isSpam = classification === 'SPAM' || classification === 'SCAM' || !!profile?.isSpam;
  const isVerified = classification === 'VERIFIED' || !!call?.isVerifiedBusiness || !!profile?.isVerified;
  const label = classification === 'SCAM' ? 'High scam risk' : classification === 'SPAM' ? 'Spam' : isVerified ? 'Verified caller' : 'Unknown caller';

  const saveName = () => {
    const next = name.trim();
    if (next && onUpdateCallerName) onUpdateCallerName(number, next);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Caller details">
      <section className="w-full max-w-lg overflow-hidden rounded-[26px] border border-slate-700 bg-[#11161d] shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isSpam ? 'bg-rose-500/10 text-rose-300' : isVerified ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{label}</span>
              {risk > 0 && <span className="text-[11px] text-slate-500">{risk}% risk</span>}
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input value={name} onChange={event => setName(event.target.value)} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base font-semibold text-white outline-none" autoFocus />
                <button onClick={saveName} className="rounded-xl bg-blue-600 p-2 text-white"><CheckCircle2 className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <h2 className="truncate text-xl font-bold text-white">{callerName}</h2>
                {onUpdateCallerName && <button onClick={() => setEditing(true)} className="rounded-lg p-1 text-slate-500 hover:text-white" aria-label="Edit caller name"><Edit2 className="h-4 w-4" /></button>}
              </div>
            )}
            <p className="mt-1 font-mono text-sm text-slate-400">{number}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onInitiateCall?.(number, callerName)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500"><Phone className="h-4 w-4" /> Call</button>
            <button onClick={() => onBlockNumber(number, callerName)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 font-semibold text-slate-200 hover:bg-slate-800"><Ban className="h-4 w-4" /> Block</button>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200"><ShieldCheck className="h-4 w-4 text-blue-400" /> Caller insight</div>
              <span className="text-[10px] text-slate-500">Device + local protection</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {isSpam ? (call?.explainReason || 'This number is marked as unwanted by VigilShield protection rules or available caller signals.') : isVerified ? 'This caller is marked as verified by the information available to VigilShield.' : 'No verified identity is available yet. Save the number if you know the caller.'}
            </p>
          </div>

          <button onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-slate-200">
            <span>{expanded ? 'Hide details' : 'More details'}</span><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
              <div className="flex justify-between"><span>Last call</span><span className="text-slate-200">{call ? new Date(call.timestamp).toLocaleString() : '—'}</span></div>
              <div className="flex justify-between"><span>Duration</span><span className="text-slate-200">{call?.durationSeconds || 0}s</span></div>
              <div className="flex justify-between"><span>Reports</span><span className="text-slate-200">{call?.reportsCount || profile?.spamReportsCount || 0}</span></div>
              {profile?.carrier && <div className="flex justify-between"><span>Carrier</span><span className="text-slate-200">{profile.carrier}</span></div>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {isSpam && <button onClick={() => onMarkSafe(number, callerName)} className="rounded-xl border border-emerald-900 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">Not spam</button>}
            <button onClick={() => onOpenReportModal(number)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">Report</button>
            <button onClick={() => onOpenDisputeModal(number, callerName)} className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">Dispute</button>
            {onOpenSmartBlock && <button onClick={() => onOpenSmartBlock(number, number.slice(0, 5))} className="rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">Smart block</button>}
            {onInitiateCall && <button onClick={() => onInitiateCall(number, callerName)} className="inline-flex items-center gap-1 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300"><UserPlus className="h-3.5 w-3.5" /> Save / contact</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
