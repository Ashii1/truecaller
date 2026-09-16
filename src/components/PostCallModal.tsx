import { useState, type FormEvent } from 'react';
import { Check, X, UserPlus, ShieldBan, AlertTriangle, FileText, Clock, Phone, Star, ShieldCheck, HelpCircle, Flag } from 'lucide-react';
import { PostCallState, SpamCategory, ContactItem } from '../types';
import { formatPhoneNumber } from '../utils/spamEngine';
import CallContextCard from './CallContextCard';

interface PostCallModalProps {
  postCall: PostCallState | null;
  onDismiss: () => void;
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onBlockNumber: (number: string, label: string) => void;
  onReportSpam: (number: string, category: SpamCategory, reason: string) => void;
  onSaveNote: (number: string, note: string) => void;
}

export default function PostCallModal({ postCall, onDismiss, onAddContact, onBlockNumber, onReportSpam, onSaveNote }: PostCallModalProps) {
  const [showSpamReport, setShowSpamReport] = useState(false);
  const [spamCategory, setSpamCategory] = useState<SpamCategory>('TELEMARKETING');
  const [spamNotes, setSpamNotes] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  if (!postCall) return null;

  const handleBlock = () => {
    onBlockNumber(postCall.number, postCall.name || 'Post-call Block');
    setSavedSuccessMessage('Number blocked and added to firewall');
    setTimeout(onDismiss, 1200);
  };

  const handleReport = (e: FormEvent) => {
    e.preventDefault();
    onReportSpam(postCall.number, spamCategory, spamNotes);
    setSavedSuccessMessage('Report submitted to threat community');
    setTimeout(onDismiss, 1200);
  };

  const handleSaveCallNote = (e: FormEvent) => {
    e.preventDefault();
    onSaveNote(postCall.number, noteText);
    setSavedSuccessMessage('Call note saved to contact history');
    setTimeout(() => { setShowNoteEditor(false); setSavedSuccessMessage(null); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 text-white">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center space-x-2"><span className="w-2 h-2 rounded-full bg-indigo-400" /><h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Post-Call Intelligence</h3></div>
          <button onClick={onDismiss} className="p-1 rounded-full text-slate-400 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-base font-extrabold text-white">{postCall.name || 'Unidentified Caller'}</div>
            <div className="text-xs text-slate-400 mt-0.5">{formatPhoneNumber(postCall.number)}</div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1"><span>Duration: <strong className="text-slate-200">{postCall.durationStr}</strong></span><span>•</span><span className="text-indigo-300">{postCall.sim || 'SIM 1'}</span></div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${postCall.isSpam ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>{postCall.isSpam ? 'Suspicious' : 'Standard'}</span>
        </div>

        <CallContextCard number={postCall.number} name={postCall.name} />

        {savedSuccessMessage && <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center space-x-2"><Check className="w-4 h-4" /><span>{savedSuccessMessage}</span></div>}

        {showSpamReport ? (
          <form onSubmit={handleReport} className="p-4 rounded-2xl bg-slate-850 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-rose-300 flex items-center space-x-1.5"><Flag className="w-3.5 h-3.5" /><span>Report Spam Category</span></span><button type="button" onClick={() => setShowSpamReport(false)} className="text-slate-400"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">{(['TELEMARKETING', 'ROBOCALL', 'SCAM', 'DEBT_COLLECTOR', 'CUSTOM'] as SpamCategory[]).map(cat => <button type="button" key={cat} onClick={() => setSpamCategory(cat)} className={`p-2 rounded-xl border text-left font-semibold ${spamCategory === cat ? 'bg-rose-600/30 border-rose-500 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{cat.replace('_', ' ')}</button>)}</div>
            <input type="text" value={spamNotes} onChange={e => setSpamNotes(e.target.value)} placeholder="What was the caller offering or saying?" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500" />
            <div className="flex justify-end space-x-2"><button type="button" onClick={() => setShowSpamReport(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs">Cancel</button><button type="submit" className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs">Submit Report</button></div>
          </form>
        ) : showNoteEditor ? (
          <form onSubmit={handleSaveCallNote} className="p-4 rounded-2xl bg-slate-850 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5"><FileText className="w-3.5 h-3.5 text-indigo-400" /><span>Add Call Note</span></span><button type="button" onClick={() => setShowNoteEditor(false)} className="text-slate-400"><X className="w-4 h-4" /></button></div>
            <textarea rows={2} required value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="e.g. Discussed proposal delivery; agreed on Friday follow-up" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500" />
            <div className="flex justify-end space-x-2"><button type="button" onClick={() => setShowNoteEditor(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs">Cancel</button><button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs">Save Note</button></div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => { onAddContact({name: postCall.name || '', number: postCall.number, category: 'GENERAL', trusted: true, isFavorite: false, notes: ''}); onDismiss(); }} className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center space-x-2.5 font-semibold text-slate-200"><UserPlus className="w-4 h-4 text-indigo-400" /><span>Add to Contacts</span></button>
            <button onClick={handleBlock} className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center space-x-2.5 font-semibold text-rose-300"><ShieldBan className="w-4 h-4 text-rose-400" /><span>Block Caller</span></button>
            <button onClick={() => setShowSpamReport(true)} className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center space-x-2.5 font-semibold text-amber-300"><Flag className="w-4 h-4 text-amber-400" /><span>Report as Spam</span></button>
            <button onClick={() => setShowNoteEditor(true)} className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center space-x-2.5 font-semibold text-slate-200"><FileText className="w-4 h-4 text-slate-400" /><span>Add Note</span></button>
          </div>
        )}
        <button onClick={onDismiss} className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs">Done</button>
      </div>
    </div>
  );
}
