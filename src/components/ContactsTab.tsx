import { FormEvent, memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  Edit2,
  EyeOff,
  Heart,
  Layers,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
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
type AccountFilter = 'ALL' | 'GOOGLE' | 'SIM1' | 'SIM2' | 'PHONE';

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
  recentCalls,
  privateCallPrefix = '*67',
}: ContactsTabProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('ALL');
  const [selected, setSelected] = useState<ContactItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [category, setCategory] = useState<ContactItem['category']>('GENERAL');
  const [accountType, setAccountType] = useState<NonNullable<ContactItem['accountType']>>('GOOGLE');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Handle hardware / gesture back navigation for contact subviews
  useEffect(() => {
    const handleBack = (e: any) => {
      if (showAdd || editing) {
        setShowAdd(false);
        setEditing(false);
        if (e.detail && typeof e.detail.handled === 'function') e.detail.handled();
      } else if (selected) {
        setSelected(null);
        if (e.detail && typeof e.detail.handled === 'function') e.detail.handled();
      }
    };
    window.addEventListener('callshield_back_request', handleBack);
    return () => window.removeEventListener('callshield_back_request', handleBack);
  }, [showAdd, editing, selected]);

  // Map recent call activity to contact numbers for accurate "RECENT" filtering
  const contactRecentMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!recentCalls) return map;
    recentCalls.forEach((c) => {
      const d = clean(c.number);
      if (!d) return;
      const key10 = d.length >= 10 ? d.slice(-10) : d;
      if (!map[key10] || c.timestamp > map[key10]) {
        map[key10] = c.timestamp;
      }
    });
    return map;
  }, [recentCalls]);

  const counts = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      ALL: contacts.length,
      FAVORITES: contacts.filter((c) => c.isFavorite || c.category === 'FAVORITE').length,
      FAMILY: contacts.filter((c) => c.category === 'FAMILY').length,
      WORK: contacts.filter((c) => c.category === 'WORK').length,
      BUSINESSES: contacts.filter((c) => c.category === 'BUSINESS' || Boolean(c.businessCategory) || c.isVerifiedBusiness).length,
      RECENT: contacts.filter((c) => {
        const lastCall = c.lastCallTimestamp || contactRecentMap[clean(c.number).slice(-10)] || 0;
        return lastCall > weekAgo;
      }).length,
    };
  }, [contacts, contactRecentMap]);

  const resolveAccountType = (c: ContactItem): 'GOOGLE' | 'SIM1' | 'SIM2' | 'PHONE' => {
    if (c.accountType) return c.accountType;
    const note = (c.notes || '').toLowerCase();
    const lbl = (c.accountLabel || '').toLowerCase();
    if (note.includes('sim 1') || lbl.includes('sim 1') || note.includes('sim1') || lbl.includes('sim1')) return 'SIM1';
    if (note.includes('sim 2') || lbl.includes('sim 2') || note.includes('sim2') || lbl.includes('sim2')) return 'SIM2';
    if (note.includes('phone') || lbl.includes('phone') || note.includes('device') || lbl.includes('device') || note.includes('storage')) return 'PHONE';
    return 'GOOGLE';
  };

  const accountCounts = useMemo(() => {
    return {
      ALL: contacts.length,
      GOOGLE: contacts.filter((c) => resolveAccountType(c) === 'GOOGLE').length,
      SIM1: contacts.filter((c) => resolveAccountType(c) === 'SIM1').length,
      SIM2: contacts.filter((c) => resolveAccountType(c) === 'SIM2').length,
      PHONE: contacts.filter((c) => resolveAccountType(c) === 'PHONE').length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase(),
      d = clean(query);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return contacts
      .filter((c) => {
        // 1. Account / Storage filter
        if (accountFilter !== 'ALL') {
          const acc = resolveAccountType(c);
          if (acc !== accountFilter) return false;
        }

        // 2. Category filter
        if (filter === 'FAVORITES' && !c.isFavorite && c.category !== 'FAVORITE') return false;
        if (filter === 'FAMILY' && c.category !== 'FAMILY') return false;
        if (filter === 'WORK' && c.category !== 'WORK') return false;
        if (filter === 'BUSINESSES' && c.category !== 'BUSINESS' && !c.businessCategory && !c.isVerifiedBusiness) return false;
        if (filter === 'RECENT') {
          const cClean = clean(c.number);
          const c10 = cClean.length >= 10 ? cClean.slice(-10) : cClean;
          const lastCall = c.lastCallTimestamp || contactRecentMap[c10] || (cClean ? contactRecentMap[cClean] : 0) || 0;
          if (lastCall < weekAgo && !c.lastCallTimestamp) return false;
        }

        // 3. Search query
        if (!q) return true;
        return (
          String(c.name ?? '').toLowerCase().includes(q) ||
          Boolean(String(c.businessCategory ?? '').toLowerCase().includes(q)) ||
          (d.length > 0 && clean(c.number).includes(d))
        );
      })
      .sort((a, b) => Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite)) || a.name.localeCompare(b.name));
  }, [contacts, query, filter, accountFilter, contactRecentMap]);

  const importDevice = () => {
    if (!telecomBridge.isAndroidEnvironment()) return;
    telecomBridge.fetchDeviceContacts(1000).forEach((c) =>
      onAddContact({
        name: c.name,
        number: c.number,
        category: 'GENERAL',
        trusted: true,
        isFavorite: c.isFavorite,
        accountType: 'GOOGLE',
        accountLabel: 'ashiqm867@gmail.com',
        notes: 'Android Contacts',
      }),
    );
  };

  const openEdit = (c: ContactItem) => {
    setSelected(c);
    setName(c.name);
    setNumber(c.number);
    setCategory(c.category);
    setAccountType(c.accountType || 'GOOGLE');
    setEditing(true);
    if (typeof window !== 'undefined' && window.history) {
      try {
        window.history.pushState({ app: 'callshield', view: 'contact_edit', id: c.id }, '', window.location.href);
      } catch {}
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !number.trim()) return;
    const accLabel =
      accountType === 'GOOGLE'
        ? 'ashiqm867@gmail.com'
        : accountType === 'SIM1'
        ? 'SIM 1 Card'
        : accountType === 'SIM2'
        ? 'SIM 2 Card'
        : 'Internal Phone Storage';

    if (editing && selected) {
      onUpdateContact(selected.id, { 
        name: name.trim(), 
        number: number.trim(), 
        category,
        accountType,
        accountLabel: accLabel,
      });
    } else {
      onAddContact({
        name: name.trim(),
        number: number.trim(),
        category,
        trusted: true,
        isFavorite: category === 'FAVORITE',
        accountType,
        accountLabel: accLabel,
        notes: '',
      });
    }
    setName('');
    setNumber('');
    setCategory('GENERAL');
    setAccountType('GOOGLE');
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
      <header className={`flex items-center justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <h1 className={`font-bold tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('contacts_title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Subtle Accounts & Storage Filter Dropdown (Tucked away, clean, not cluttering all the time) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountMenu((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                accountFilter !== 'ALL'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="Filter by Google, SIM or Device Storage"
            >
              <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>
                {accountFilter === 'ALL'
                  ? 'Accounts'
                  : accountFilter === 'GOOGLE'
                  ? 'Google'
                  : accountFilter === 'SIM1'
                  ? 'SIM 1'
                  : accountFilter === 'SIM2'
                  ? 'SIM 2'
                  : 'Device'}
              </span>
              <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300">
                {accountCounts[accountFilter]}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Account Selector Menu Popover */}
            {showAccountMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-2xl border border-white/15 bg-[#0e141c] p-1.5 shadow-2xl shadow-black/80 backdrop-blur-xl">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filter by Storage Account
                  </div>
                  {[
                    { id: 'ALL' as const, label: 'All Contacts', count: accountCounts.ALL, icon: Users },
                    { id: 'GOOGLE' as const, label: 'Google Account', count: accountCounts.GOOGLE, icon: Building2 },
                    { id: 'SIM1' as const, label: 'SIM 1 Storage', count: accountCounts.SIM1, icon: Smartphone },
                    { id: 'SIM2' as const, label: 'SIM 2 Storage', count: accountCounts.SIM2, icon: Smartphone },
                    { id: 'PHONE' as const, label: 'Device Memory', count: accountCounts.PHONE, icon: Smartphone },
                  ].map((acc) => {
                    const Icon = acc.icon;
                    const isSelected = accountFilter === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setAccountFilter(acc.id);
                          setShowAccountMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30 font-bold'
                            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                          <span>{acc.label}</span>
                        </div>
                        <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          isSelected ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {acc.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={importDevice}
            className={`hidden rounded-xl border border-white/10 bg-white/5 font-semibold text-slate-300 sm:block hover:bg-white/10 transition ${isCompact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'}`}
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
              if (typeof window !== 'undefined' && window.history) {
                try {
                  window.history.pushState({ app: 'callshield', view: 'contact_add' }, '', window.location.href);
                } catch {}
              }
            }}
            className={`flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all ${isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
          >
            <Plus className={`stroke-[2.5] ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
            <span>{t('add')}</span>
          </button>
        </div>
      </header>

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
                onClick={() => {
                  if (onOpenCallerDetail) {
                    onOpenCallerDetail({ number: c.number, name: c.name, contact: c });
                  } else {
                    setSelected(c);
                    if (typeof window !== 'undefined' && window.history) {
                      try {
                        window.history.pushState({ app: 'callshield', view: 'contact_detail', id: c.id }, '', window.location.href);
                      } catch {}
                    }
                  }
                }}
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
                onClick={() => {
                  if (onOpenCallerDetail) {
                    onOpenCallerDetail({ number: c.number, name: c.name, contact: c });
                  } else {
                    setSelected(c);
                    if (typeof window !== 'undefined' && window.history) {
                      try {
                        window.history.pushState({ app: 'callshield', view: 'contact_detail', id: c.id }, '', window.location.href);
                      } catch {}
                    }
                  }
                }}
                className="min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`truncate font-semibold text-white transition-all ${isCompact ? 'text-xs' : 'text-sm'}`}>{c.name}</span>
                  {c.isVerifiedBusiness && <ShieldCheck className={`text-blue-400 shrink-0 ${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />}
                  {c.accountType === 'SIM1' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">SIM 1</span>
                  ) : c.accountType === 'SIM2' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">SIM 2</span>
                  ) : c.accountType === 'PHONE' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Phone</span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">Google</span>
                  )}
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
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95"
                aria-label="Back"
                title="Back to contacts list"
              >
                <ArrowLeft className="h-5 w-5 text-slate-300" />
                <span className="text-xs font-semibold text-slate-300">Back</span>
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
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95"
                aria-label="Back"
                title="Back to contacts list"
              >
                <ArrowLeft className="h-5 w-5 text-slate-300" />
                <span className="text-xs font-semibold text-slate-300">Back</span>
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
            <label className="mb-3 block text-xs font-semibold text-slate-400">
              Save contact to
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as any)}
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#10161d] px-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="GOOGLE">Google Account (ashiqm867@gmail.com)</option>
                <option value="SIM1">SIM 1 Card</option>
                <option value="SIM2">SIM 2 Card</option>
                <option value="PHONE">Device Storage (Phone)</option>
              </select>
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
