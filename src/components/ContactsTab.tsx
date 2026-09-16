import { FormEvent, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Clock,
  Edit2,
  Heart,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { ContactItem, CallLogItem } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { useI18n } from '../i18n/LanguageContext';

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
const clean = (v: string) => v.replace(/\D/g, '');

export default function ContactsTab({
  contacts,
  onInitiateCall,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onToggleFavorite,
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
          c.name.toLowerCase().includes(q) ||
          Boolean(c.businessCategory?.toLowerCase().includes(q)) ||
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

  const categoryTabs: { id: CategoryFilter; label: string; icon: typeof Users }[] = [
    { id: 'ALL', label: t('filter_all'), icon: Users },
    { id: 'FAVORITES', label: t('cat_favorites'), icon: Star },
    { id: 'FAMILY', label: t('cat_family'), icon: Heart },
    { id: 'WORK', label: t('cat_work'), icon: Briefcase },
    { id: 'BUSINESSES', label: t('cat_businesses'), icon: Building2 },
    { id: 'RECENT', label: t('cat_recent'), icon: Clock },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-8 pt-2 sm:px-4 select-none">
      {/* Header */}
      <header className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">{t('contacts_people')}</p>
          <h1 className="text-xl font-bold tracking-tight text-white">{t('contacts_title')}</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={importDevice}
            className="hidden rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 sm:block hover:bg-white/10 transition"
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
            className="flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>{t('add')}</span>
          </button>
        </div>
      </header>

      {/* Search Input */}
      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('search_contacts')}
          className="h-10 w-full rounded-xl border border-white/10 bg-[#0e141c] pl-9 pr-9 text-xs text-white outline-none placeholder:text-slate-600 shadow-inner shadow-black/20 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Redesigned UI 9.5 Segmented Category Filter Tab Strip */}
      <div className="mb-3 rounded-2xl border border-white/10 bg-[#0e141c] p-1 shadow-lg shadow-black/20">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {categoryTabs.map(({ id, label, icon: Icon }) => {
            const active = filter === id;
            const count = counts[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`group relative flex flex-1 min-w-[70px] sm:min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-[0_2px_12px_rgba(16,185,129,0.35)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    active
                      ? 'text-slate-950 stroke-[2.5]'
                      : id === 'FAVORITES' && count > 0
                      ? 'text-amber-400'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none shrink-0 ${
                      active
                        ? 'bg-slate-950/25 text-slate-950'
                        : id === 'FAVORITES'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contacts List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0e141c] p-8 text-center">
          <UserRound className="mx-auto h-7 w-7 text-slate-700" />
          <p className="mt-2 text-xs font-semibold text-slate-300">
            {contacts.length ? t('no_matching_contacts') : t('no_contacts_yet')}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600">{t('add_contact_or_import')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e141c]">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2.5 last:border-0 hover:bg-white/[0.02] transition"
            >
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-white"
              >
                {c.isVerifiedBusiness ? <Building2 className="h-4 w-4" /> : c.name.slice(0, 1).toUpperCase()}
              </button>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-white">{c.name}</span>
                  {c.isVerifiedBusiness && <ShieldCheck className="h-3 w-3 text-blue-400 shrink-0" />}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-500">
                  {c.number}
                  {c.businessCategory ? ` · ${c.businessCategory}` : ''}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(c.id)}
                className="rounded-full p-1.5 text-slate-600 hover:text-amber-400 transition"
                title={t('favorite')}
              >
                <Star className={`h-3.5 w-3.5 ${c.isFavorite ? 'fill-current text-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onInitiateCall(c.number, c.name)}
                className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                aria-label={t('nav_phone')}
              >
                <Phone className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contact Details Modal */}
      {selected && !editing && !showAdd && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#10161d] p-5 sm:rounded-[30px]">
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
            <div className="mt-6 grid grid-cols-3 gap-2">
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
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {(showAdd || editing) && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
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
