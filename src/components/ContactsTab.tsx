import { FormEvent, memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Briefcase,
  Building2,
  Clock,
  Edit2,
  EyeOff,
  Heart,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { ContactItem, CallLogItem, DisplayDensity } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';
import ModernFilterBar, { FilterTabOption } from './ModernFilterBar';

interface ContactsTabProps {
  contacts: ContactItem[];
  onInitiateCall: (number: string, name?: string, sim?: any, isPrivate?: boolean) => void;
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onUpdateContact: (id: string, updates: Partial<ContactItem>) => void;
  onDeleteContact: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  recentCalls: CallLogItem[];
  density?: DisplayDensity;
  onOpenCallerDetail?: (item: any) => void;
  privateCallPrefix?: string;
}

type CategoryFilter = 'ALL' | 'FAVORITES' | 'FAMILY' | 'WORK' | 'BUSINESSES' | 'RECENT';
const clean = (v: string) => v.replace(/\D/g, '');

function ContactsTab({
  contacts,
  onInitiateCall,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onToggleFavorite,
  density = 'comfortable',
  onOpenCallerDetail,
  privateCallPrefix = '*67',
}: ContactsTabProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [selected, setSelected] = useState<ContactItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<ContactItem['category']>('GENERAL');

  const counts = useMemo(() => {
    return {
      ALL: contacts.length,
      FAVORITES: contacts.filter((c) => c.isFavorite).length,
      FAMILY: contacts.filter((c) => c.category === 'FAMILY').length,
      WORK: contacts.filter((c) => c.category === 'WORK').length,
      BUSINESSES: contacts.filter((c) => c.category === 'BUSINESS').length,
      RECENT: contacts.filter((c) => c.lastCallTimestamp && c.lastCallTimestamp > Date.now() - 604800000).length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(),
      d = clean(query);
    return contacts
      .filter((c) => {
        if (filter === 'FAVORITES' && !c.isFavorite) return false;
        if (filter === 'FAMILY' && c.category !== 'FAMILY') return false;
        if (filter === 'WORK' && c.category !== 'WORK') return false;
        if (filter === 'BUSINESSES' && c.category !== 'BUSINESS') return false;
        if (filter === 'RECENT' && (!c.lastCallTimestamp || c.lastCallTimestamp < Date.now() - 604800000)) return false;
        if (!q) return true;
        return (
          String(c.name ?? '').toLowerCase().includes(q) ||
          Boolean(String(c.businessCategory ?? '').toLowerCase().includes(q)) ||
          (d.length > 0 && clean(c.number).includes(d))
        );
      })
      .sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite)) || a.name.localeCompare(b.name));
  }, [contacts, query, filter]);

  const importDevice = () => {
    if (!telecomBridge.isAndroidEnvironment()) return;
    telecomBridge.fetchDeviceContacts(1000).forEach((c) =>
      onAddContact({
        name: c.name,
        number: c.number,
        category: 'GENERAL',
        trusted: true,
        isFavorite: c.isFavorite,
        notes: 'Android Contacts',
      }),
    );
  };

  const openEdit = (c: ContactItem) => {
    setSelected(c);
    setName(c.name);
    setNumber(c.number);
    setCategory(c.category);
    setEditing(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !number.trim()) return;
    if (editing && selected) {
      onUpdateContact(selected.id, { name: name.trim(), number: number.trim(), category });
    } else {
      onAddContact({
        name: name.trim(),
        number: number.trim(),
        category,
        trusted: true,
        isFavorite: category === 'FAVORITE',
        notes: '',
      });
    }
    setName('');
    setNumber('');
    setCategory('GENERAL');
    setEditing(false);
    setShowAdd(false);
    setSelected(null);
  };

  const categoryTabs: FilterTabOption<CategoryFilter>[] = [
    { id: 'ALL', label: t('filter_all'), icon: Users, count: counts.ALL, badgeVariant: 'default' },
    { id: 'FAVORITES', label: t('cat_favorites'), icon: Star, count: counts.FAVORITES, badgeVariant: 'favorite' },
    { id: 'FAMILY', label: t('cat_family'), icon: Heart, count: counts.FAMILY, badgeVariant: 'default' },
    { id: 'WORK', label: t('cat_work'), icon: Briefcase, count: counts.WORK, badgeVariant: 'default' },
    { id: 'BUSINESSES', label: t('cat_businesses'), icon: Building2, count: counts.BUSINESSES, badgeVariant: 'default' },
    { id: 'RECENT', label: t('cat_recent'), icon: Clock, count: counts.RECENT, badgeVariant: 'default' },
  ];

  const isCompact = density === 'compact';

  return (
    <div className={`mx-auto w-full max-w-2xl select-none transition-all ${isCompact ? 'px-2 pb-6 pt-1 sm:px-3' : 'px-3 pb-8 pt-2 sm:px-4'}`}>
      {/* Header */}
      <header className={`flex items-end justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('contacts_title')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={importDevice}
            className={`hidden rounded-lg border border-white/10 bg-white/5 font-semibold text-slate-300 sm:block hover:bg-white/10 transition ${isCompact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'}`}
          >
            {t('import')}
          </button>
          <button
            type="button"
            onClick={() => {
              setName('');
              setNumber('');
              setCategory('GENERAL');
              setShowAdd(true);
            }}
            className={`flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all ${isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
          >
            <Plus className={`stroke-[2.5] ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
            <span>{t('add')}</span>
          </button>
        </div>
      </header>

      {/* Search Input */}
      <div className={`relative transition-all ${isCompact ? 'mb-2' : 'mb-2.5'}`}>
        <Search className={`absolute top-1/2 -translate-y-1/2 text-slate-500 transition-all ${isCompact ? 'left-2.5 h-3 w-3' : 'left-3 h-3.5 w-3.5'}`} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_contacts')}
          className={`w-full rounded-xl border border-white/10 bg-[#0e141c] text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all ${isCompact ? 'h-8.5 pl-8 pr-8 text-[11.5px]' : 'h-10 pl-9 pr-9 text-xs'}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className={`absolute top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white ${isCompact ? 'right-2' : 'right-2.5'}`}
          >
            <X className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          </button>
        )}
      </div>

      {/* Modern Filter Navigation Bar with full text, scroll chevrons & popover */}
      <ModernFilterBar<CategoryFilter>
        tabs={categoryTabs}
        activeId={filter}
        onChange={setFilter}
      />

      {/* Contacts List */}
      {filtered.length === 0 ? (
        <div className={`border border-white/10 bg-[#0e141c] text-center transition-all ${isCompact ? 'rounded-xl p-6' : 'rounded-2xl p-8'}`}>
          <UserRound className={`mx-auto text-slate-700 ${isCompact ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <p className={`font-semibold text-slate-300 ${isCompact ? 'mt-1.5 text-[11px]' : 'mt-2 text-xs'}`}>
            {contacts.length ? t('no_matching_contacts') : t('no_contacts_yet')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">{t('add_contact_or_import')}</p>
        </div>
      ) : (
        <div className={`overflow-hidden border border-white/10 bg-[#0e141c] transition-all ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`flex items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition ${isCompact ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-3 py-2.5'}`}
            >
              <button
                type="button"
                onClick={() => setSelected(c)}
                className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 font-bold text-white transition-all ${isCompact ? 'h-7.5 w-7.5 text-[10px]' : 'h-9 w-9 text-xs'}`}
              >
                {c.isVerifiedBusiness ? (
                  <Building2 className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                ) : (
                  c.name.slice(0, 1).toUpperCase()
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`truncate font-semibold text-white transition-all ${isCompact ? 'text-xs' : 'text-sm'}`}>{c.name}</span>
                  {c.isVerifiedBusiness && <ShieldCheck className={`text-blue-400 shrink-0 ${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />}
                </div>
                <div className={`truncate text-slate-500 transition-all ${isCompact ? 'mt-0 text-[10px]' : 'mt-0.5 text-[11px]'}`}>
                  {c.number}
                  {c.businessCategory ? ` · ${c.businessCategory}` : ''}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(c.id)}
                className={`rounded-full text-slate-600 hover:text-amber-400 transition ${isCompact ? 'p-1' : 'p-1.5'}`}
                title={t('favorite')}
              >
                <Star className={`${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${c.isFavorite ? 'fill-current text-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onInitiateCall(c.number, c.name)}
                className={`grid shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition ${isCompact ? 'h-7 w-7' : 'h-8 w-8'}`}
                aria-label={t('nav_phone')}
              >
                <Phone className={`${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} fill-current`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contact Details Modal */}
      {selected && !editing && !showAdd && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', transform: 'none' }}>
          <div className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#10161d] p-5 sm:rounded-[30px]" style={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', filter: 'none', transform: 'none' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-xl font-bold text-white">
                  {selected.name.slice(0, 1).toUpperCase()}
                </div>
                <h2 className="mt-3 text-xl font-bold text-white">{selected.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.number}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full p-2 text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onInitiateCall(selected.number, selected.name)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-500/10 p-3 text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <Phone className="h-5 w-5" />
                <span className="text-xs font-semibold">{t('call')}</span>
              </button>
              <button
                type="button"
                onClick={() => onInitiateCall(selected.number, selected.name, undefined, true)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-indigo-500/10 p-3 text-indigo-300 hover:bg-indigo-500/20 transition"
                title={`Call with ${privateCallPrefix} caller ID masking`}
              >
                <EyeOff className="h-5 w-5 text-indigo-400" />
                <span className="text-xs font-semibold">Private</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(selected.id)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 p-3 text-amber-400 hover:bg-white/10 transition"
              >
                <Star className="h-5 w-5" />
                <span className="text-xs font-semibold">{t('favorite')}</span>
              </button>
              <button
                type="button"
                onClick={() => openEdit(selected)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 p-3 text-blue-400 hover:bg-white/10 transition"
              >
                <Edit2 className="h-5 w-5" />
                <span className="text-xs font-semibold">{t('edit')}</span>
              </button>
            </div>

            {onOpenCallerDetail && (
              <button
                type="button"
                onClick={() => {
                  const target = selected;
                  setSelected(null);
                  onOpenCallerDetail({ number: target.number, name: target.name });
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-3 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>View Security Profile & Call History</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onDeleteContact(selected.id);
                setSelected(null);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm font-semibold text-rose-400 hover:bg-rose-500/20 transition"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t('delete_contact')}</span>
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Add / Edit Contact Modal */}
      {(showAdd || editing) && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#10161d] p-5 sm:rounded-[30px]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{t('contacts_title')}</p>
                <h2 className="text-lg font-bold text-white">{editing ? t('edit_contact') : t('new_contact')}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditing(false);
                  setSelected(null);
                }}
                className="rounded-full p-2 text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mb-3 block text-xs font-semibold text-slate-400">
              {t('contact_name')}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
            </label>
            <label className="mb-3 block text-xs font-semibold text-slate-400">
              {t('contact_phone')}
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="tel"
                required
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-500/40"
              />
            </label>
            <label className="mb-5 block text-xs font-semibold text-slate-400">
              {t('contact_category')}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContactItem['category'])}
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#10161d] px-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="GENERAL">General</option>
                <option value="FAVORITE">{t('cat_favorites')}</option>
                <option value="FAMILY">{t('cat_family')}</option>
                <option value="WORK">{t('cat_work')}</option>
                <option value="BUSINESS">{t('cat_businesses')}</option>
                <option value="PERSONAL">Personal</option>
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/25 transition"
            >
              {editing ? t('save_changes') : t('create_contact')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default memo(ContactsTab);
