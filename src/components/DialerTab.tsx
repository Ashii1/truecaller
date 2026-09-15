import { useEffect, useMemo, useState } from 'react';
import { Check, Delete, Layers, Phone, Search, ShieldAlert, ShieldCheck, User, X } from 'lucide-react';
import { ContactItem, CallLogItem, TruecallerDirectoryProfile, ShieldSettings } from '../types';
import { smartDialerSearch } from '../utils/t9Search';
import { formatPhoneNumber } from '../utils/spamEngine';
import { triggerHapticFeedback } from '../utils/audioAlerts';

interface DialerTabProps {
  contacts: ContactItem[];
  recentCalls: CallLogItem[];
  settings: ShieldSettings;
  lookupProfile: (num: string) => TruecallerDirectoryProfile;
  onInitiateCall: (number: string, name?: string, sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  onOpenCallerDetail: (item: CallLogItem | TruecallerDirectoryProfile) => void;
  onSaveContact: (number: string, name?: string) => void;
  selectedSim: 'SIM 1 (Personal)' | 'SIM 2 (Work)';
  onChangeSim: (sim: 'SIM 1 (Personal)' | 'SIM 2 (Work)') => void;
  initialNumber?: string;
}

const KEYPAD = [['1',''],['2','ABC'],['3','DEF'],['4','GHI'],['5','JKL'],['6','MNO'],['7','PQRS'],['8','TUV'],['9','WXYZ'],['*',''],['0','+'],['#','']];

export default function DialerTab({ contacts, recentCalls, settings: _settings, lookupProfile, onInitiateCall, onOpenCallerDetail, onSaveContact: _onSaveContact, selectedSim, onChangeSim, initialNumber }: DialerTabProps) {
  const [value, setValue] = useState(initialNumber || '');
  const [showSimPicker, setShowSimPicker] = useState(false);

  useEffect(() => { if (initialNumber) setValue(initialNumber); }, [initialNumber]);

  const results = useMemo(() => value.trim()
    ? smartDialerSearch(value, contacts, recentCalls, lookupProfile)
    : { matchingContacts: [], matchingRecents: [], possibleCaller: null },
    [value, contacts, recentCalls, lookupProfile]);

  const digits = value.replace(/\D/g, '');
  const matchedContact = useMemo(() => {
    if (!digits) return null;
    return contacts.find(c => {
      const n = c.number.replace(/\D/g, '');
      return n === digits || (digits.length >= 7 && n.length >= 7 && digits.endsWith(n));
    }) || null;
  }, [digits, contacts]);

  const profile = useMemo(() => digits.length >= 4 ? lookupProfile(value) : null, [digits, value, lookupProfile]);
  const hasSuggestions = Boolean(value && (results.matchingContacts.length || results.matchingRecents.length || results.possibleCaller));

  const press = (digit: string) => {
    // Deliberately no DTMF/WebAudio sound: keypad typing is silent.
    triggerHapticFeedback(12);
    setValue(v => v + digit);
  };
  const backspace = () => {
    if (!value) return;
    triggerHapticFeedback(10);
    setValue(v => v.slice(0, -1));
  };
  const call = () => {
    if (!value.trim()) return;
    onInitiateCall(value.trim(), matchedContact?.name || (profile?.isVerified || profile?.isSpam ? profile.name : undefined), selectedSim);
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3 pb-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Phone</h1>
        <button onClick={() => setShowSimPicker(true)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200" aria-label="Choose SIM"><Layers className="h-3.5 w-3.5" />{selectedSim.includes('SIM 1') ? 'SIM 1' : 'SIM 2'}</button>
      </div>

      <div className="relative z-20 mb-2">
        <div className="flex h-12 items-center rounded-2xl border border-slate-700 bg-slate-900 px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
          <input id="dialer-search-input" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') call(); }} inputMode="tel" autoComplete="off" placeholder="Search contacts or enter number" className="min-w-0 flex-1 bg-transparent text-base text-white placeholder-slate-500 outline-none" />
          {value && <button onClick={() => setValue('')} className="rounded-full p-1 text-slate-400" aria-label="Clear"><X className="h-4 w-4" /></button>}
        </div>

        <div className="h-11 overflow-hidden" aria-live="polite">
          {hasSuggestions && (
            <div className="mt-1 flex h-10 items-center gap-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 px-2">
              {results.matchingContacts.slice(0, 2).map(c => (
                <button key={`c-${c.id}`} onClick={() => setValue(c.number)} className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-2 text-left">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-700 text-[10px] font-bold text-white">{c.name.slice(0,1).toUpperCase()}</span>
                  <span className="max-w-[120px] truncate text-xs font-semibold text-white">{c.name}</span>
                </button>
              ))}
              {results.matchingRecents.slice(0, 2).map(r => (
                <button key={`r-${r.id}`} onClick={() => setValue(r.number)} className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-2 text-left">
                  <span className="text-xs font-semibold text-slate-300">{r.callerName || formatPhoneNumber(r.number)}</span>
                </button>
              ))}
              {results.possibleCaller && (
                <button onClick={() => onOpenCallerDetail(results.possibleCaller!)} className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-slate-800 px-2 text-left">
                  {results.possibleCaller.isSpam ? <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> : <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />}
                  <span className="max-w-[130px] truncate text-xs font-semibold text-white">{results.possibleCaller.name}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex h-20 items-center justify-center text-center">
        <div className="min-w-0 px-2">
          {value ? <div className="break-all text-3xl font-medium tracking-tight text-white">{formatPhoneNumber(value)}</div> : <div className="text-sm text-slate-500">Enter a number</div>}
          {matchedContact && <div className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-emerald-400"><User className="h-3.5 w-3.5" />{matchedContact.name}</div>}
          {!matchedContact && profile?.name && profile.name !== value && <div className={`mt-1 text-xs font-medium ${profile.isSpam ? 'text-rose-400' : 'text-slate-400'}`}>{profile.name}</div>}
        </div>
        {value && <button onClick={backspace} className="ml-2 rounded-full p-3 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Backspace"><Delete className="h-5 w-5" /></button>}
      </div>

      <div className="grid grid-cols-3 gap-x-7 gap-y-3 px-4 py-2">
        {KEYPAD.map(([digit, letters]) => <button key={digit} onClick={() => press(digit)} className="mx-auto flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-slate-800 text-white shadow-sm ring-1 ring-slate-700 transition active:scale-95 active:bg-slate-700"><span className="text-2xl font-semibold leading-none">{digit}</span>{letters && <span className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-slate-400">{letters}</span>}</button>)}
      </div>

      <div className="flex justify-center pt-5"><button onClick={call} disabled={!value.trim()} className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition active:scale-95 disabled:bg-slate-700 disabled:text-slate-500" aria-label="Call"><Phone className="h-7 w-7 fill-current" /></button></div>

      {showSimPicker && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"><div className="w-full max-w-md rounded-t-3xl border border-slate-700 bg-slate-900 p-5 sm:rounded-3xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white">Call using</h2><button onClick={() => setShowSimPicker(false)} className="rounded-full p-2 text-slate-400"><X className="h-5 w-5" /></button></div>{(['SIM 1 (Personal)','SIM 2 (Work)'] as const).map(sim => <button key={sim} onClick={() => { onChangeSim(sim); setShowSimPicker(false); }} className="mb-2 flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 p-4 text-left text-white"><span className="font-semibold">{sim}</span>{selectedSim === sim && <Check className="h-5 w-5 text-blue-400" />}</button>)}</div></div>}
    </div>
  );
}
