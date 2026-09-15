import { FormEvent, useMemo, useState } from 'react';
import { Building2, Edit2, Phone, Plus, Search, ShieldCheck, Star, Trash2, UserRound, X } from 'lucide-react';
import { ContactItem, CallLogItem } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface ContactsTabProps {
  contacts: ContactItem[];
  onInitiateCall: (number: string, name?: string) => void;
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onUpdateContact: (id: string, updates: Partial<ContactItem>) => void;
  onDeleteContact: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  recentCalls: CallLogItem[];
}

type CategoryFilter = 'ALL' | 'FAVORITES' | 'FAMILY' | 'WORK' | 'BUSINESSES' | 'RECENT';

const cleanDigits = (value: string) => value.replace(/\D/g, '');

export default function ContactsTab({ contacts, onInitiateCall, onAddContact, onUpdateContact, onDeleteContact, onToggleFavorite, recentCalls }: ContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [selected, setSelected] = useState<ContactItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<ContactItem['category']>('GENERAL');

  const filtered = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    const digits = cleanDigits(searchQuery);
    return contacts.filter(contact => {
      if (activeCategory === 'FAVORITES' && !contact.isFavorite) return false;
      if (activeCategory === 'FAMILY' && contact.category !== 'FAMILY') return false;
      if (activeCategory === 'WORK' && contact.category !== 'WORK') return false;
      if (activeCategory === 'BUSINESSES' && contact.category !== 'BUSINESS') return false;
      if (activeCategory === 'RECENT' && (!contact.lastCallTimestamp || contact.lastCallTimestamp < Date.now() - 7 * 86400000)) return false;
      if (!raw) return true;
      const nameMatch = contact.name.toLowerCase().includes(raw);
      const businessMatch = Boolean(contact.businessCategory?.toLowerCase().includes(raw));
      const numberDigits = cleanDigits(contact.number);
      const numberMatch = digits.length > 0 && numberDigits.includes(digits);
      return nameMatch || numberMatch || businessMatch;
    }).sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite)) || a.name.localeCompare(b.name));
  }, [contacts, searchQuery, activeCategory]);

  const importDeviceContacts = () => {
    if (!telecomBridge.isAndroidEnvironment()) return;
    const deviceContacts = telecomBridge.fetchDeviceContacts(1000);
    deviceContacts.forEach(contact => onAddContact({ name: contact.name, number: contact.number, category: 'GENERAL', trusted: true, isFavorite: contact.isFavorite, notes: 'Android Contacts' }));
  };

  const openEdit = (contact: ContactItem) => {
    setSelected(contact); setName(contact.name); setNumber(contact.number); setCategory(contact.category); setEditing(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !number.trim()) return;
    if (editing && selected) onUpdateContact(selected.id, { name: name.trim(), number: number.trim(), category });
    else onAddContact({ name: name.trim(), number: number.trim(), category, trusted: true, isFavorite: category === 'FAVORITE', notes: '' });
    setName(''); setNumber(''); setCategory('GENERAL'); setEditing(false); setShowAdd(false); setSelected(null);
  };

  return <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4">
    <header className="mb-4 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Contacts</h1><p className="mt-1 text-sm text-slate-400">Search names, full numbers, or the last digits of a number.</p></div><div className="flex gap-2"><button onClick={importDeviceContacts} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200">Import device</button><button onClick={() => { setName(''); setNumber(''); setCategory('GENERAL'); setShowAdd(true); }} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white"><Plus className="h-4 w-4" />Add</button></div></header>

    <div className="relative mb-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search contacts or number" className="h-11 w-full rounded-2xl border border-slate-700 bg-slate-900 pl-10 pr-10 text-sm text-white outline-none placeholder-slate-500" />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-4 w-4" /></button>}</div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{(['ALL','FAVORITES','FAMILY','WORK','BUSINESSES','RECENT'] as CategoryFilter[]).map(value => <button key={value} onClick={() => setActiveCategory(value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${activeCategory === value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{value === 'ALL' ? 'All' : value === 'FAVORITES' ? 'Favorites' : value === 'BUSINESSES' ? 'Businesses' : value.charAt(0) + value.slice(1).toLowerCase()}</button>)}</div>

    {filtered.length === 0 ? <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center"><UserRound className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">{contacts.length ? 'No matching contacts' : 'No contacts yet'}</p><p className="mt-1 text-xs text-slate-500">Try a name or at least 3 digits of the phone number.</p></div> : <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">{filtered.map(contact => <div key={contact.id} className="flex items-center gap-3 border-b border-slate-800 px-3 py-3 last:border-0"><button onClick={() => setSelected(contact)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-bold text-white">{contact.isVerifiedBusiness ? <Building2 className="h-5 w-5" /> : contact.name.slice(0,1).toUpperCase()}</button><button onClick={() => setSelected(contact)} className="min-w-0 flex-1 text-left"><div className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold text-white">{contact.name}</span>{contact.isVerifiedBusiness && <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />}</div><div className="truncate text-xs text-slate-400">{contact.number}{contact.businessCategory ? ` · ${contact.businessCategory}` : ''}</div></button><button onClick={() => onToggleFavorite(contact.id)} className="rounded-full p-2 text-slate-500 hover:bg-slate-800" aria-label="Favorite"><Star className={`h-4 w-4 ${contact.isFavorite ? 'fill-current text-amber-400' : ''}`} /></button><button onClick={() => onInitiateCall(contact.number, contact.name)} className="rounded-full p-2 text-emerald-400 hover:bg-slate-800" aria-label="Call"><Phone className="h-5 w-5" /></button></div>)}</div>}

    {selected && !editing && !showAdd && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"><div className="w-full max-w-md rounded-t-3xl border border-slate-700 bg-slate-900 p-5 sm:rounded-3xl"><div className="flex items-start justify-between"><div><div className="text-xl font-bold text-white">{selected.name}</div><div className="mt-1 text-sm text-slate-400">{selected.number}</div></div><button onClick={() => setSelected(null)} className="rounded-full p-2 text-slate-400"><X /></button></div><div className="mt-5 grid grid-cols-3 gap-2"><button onClick={() => onInitiateCall(selected.number, selected.name)} className="flex flex-col items-center gap-1 rounded-2xl bg-slate-800 p-3 text-emerald-400"><Phone className="h-5 w-5" /><span className="text-xs">Call</span></button><button onClick={() => onToggleFavorite(selected.id)} className="flex flex-col items-center gap-1 rounded-2xl bg-slate-800 p-3 text-amber-400"><Star className="h-5 w-5" /><span className="text-xs">Favorite</span></button><button onClick={() => openEdit(selected)} className="flex flex-col items-center gap-1 rounded-2xl bg-slate-800 p-3 text-blue-400"><Edit2 className="h-5 w-5" /><span className="text-xs">Edit</span></button></div><button onClick={() => { onDeleteContact(selected.id); setSelected(null); }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm font-semibold text-rose-400"><Trash2 className="h-4 w-4" />Delete contact</button></div></div>}

    {(showAdd || editing) && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"><form onSubmit={submit} className="w-full max-w-md rounded-t-3xl border border-slate-700 bg-slate-900 p-5 sm:rounded-3xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-white">{editing ? 'Edit contact' : 'New contact'}</h2><button type="button" onClick={() => { setShowAdd(false); setEditing(false); setSelected(null); }} className="rounded-full p-2 text-slate-400"><X /></button></div><label className="mb-3 block text-xs font-semibold text-slate-400">Name<input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none" /></label><label className="mb-3 block text-xs font-semibold text-slate-400">Phone number<input value={number} onChange={e => setNumber(e.target.value)} inputMode="tel" className="mt-1 h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none" /></label><label className="mb-4 block text-xs font-semibold text-slate-400">Category<select value={category} onChange={e => setCategory(e.target.value as ContactItem['category'])} className="mt-1 h-11 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm text-white outline-none"><option value="GENERAL">General</option><option value="FAVORITE">Favorite</option><option value="FAMILY">Family</option><option value="WORK">Work</option><option value="BUSINESS">Business</option><option value="PERSONAL">Personal</option></select></label><button type="submit" className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">{editing ? 'Save changes' : 'Create contact'}</button></form></div>}
  </div>;
}