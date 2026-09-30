import { FormEvent, memo, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  Edit2,
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
import GlobalSearchAutocomplete, { AutocompleteItem } from './common/GlobalSearchAutocomplete';

interface ContactsTabProps {
  contacts: ContactItem[];
  onInitiateCall: (number: string, name?: string, sim?: any) => void;
  onAddContact: (contact: Omit<ContactItem, 'id'>) => void;
  onUpdateContact: (id: string, updates: Partial<ContactItem>) => void;
  onDeleteContact: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  recentCalls: CallLogItem[];
  density?: DisplayDensity;
  onOpenCallerDetail?: (item: any) => void;
}

type CategoryFilter = 'ALL' | 'FAVORITES' | 'FAMILY' | 'WORK' | 'BUSINESSES' | 'RECENT' | 'GENERAL';
type AccountFilter = 'ALL' | 'GOOGLE_ALL' | 'GOOGLE_PERSONAL' | 'GOOGLE_WORK' | 'SIM1' | 'SIM2' | 'PHONE';
type AccountChoice = 'GOOGLE_PERSONAL' | 'GOOGLE_WORK' | 'SIM1' | 'SIM2' | 'PHONE';

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
  const [accountChoice, setAccountChoice] = useState<AccountChoice>('GOOGLE_PERSONAL');
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

  const resolveAccountType = (c: ContactItem): 'GOOGLE' | 'SIM1' | 'SIM2' | 'PHONE' => {
    if (c.accountType) return c.accountType;
    const note = (c.notes || '').toLowerCase();
    const lbl = (c.accountLabel || '').toLowerCase();
    if (note.includes('sim 1') || lbl.includes('sim 1') || note.includes('sim1') || lbl.includes('sim1')) return 'SIM1';
    if (note.includes('sim 2') || lbl.includes('sim 2') || note.includes('sim2') || lbl.includes('sim2')) return 'SIM2';
    if (note.includes('phone') || lbl.includes('phone') || note.includes('device') || lbl.includes('device') || note.includes('storage')) return 'PHONE';
    return 'GOOGLE';
  };

  const isGoogleWorkAccount = (c: ContactItem): boolean => {
    const lbl = (c.accountLabel || '').toLowerCase();
    const note = (c.notes || '').toLowerCase();
    return lbl.includes('work') || lbl.includes('corp') || lbl.includes('office') || note.includes('work google');
  };

  // Category matching helper predicates
  const isFavoriteContact = (c: ContactItem) =>
    Boolean(c.isFavorite) || String(c.category || '').toUpperCase() === 'FAVORITE';

  const isFamilyContact = (c: ContactItem) => {
    const cat = String(c.category || '').toUpperCase();
    const note = (c.notes || '').toLowerCase();
    return (
      cat === 'FAMILY' ||
      cat === 'PERSONAL' ||
      note.includes('family') ||
      note.includes('personal') ||
      note.includes('friend') ||
      note.includes('home')
    );
  };

  const isWorkContact = (c: ContactItem) => {
    const cat = String(c.category || '').toUpperCase();
    const lbl = (c.accountLabel || '').toLowerCase();
    const note = (c.notes || '').toLowerCase();
    return (
      cat === 'WORK' ||
      isGoogleWorkAccount(c) ||
      lbl.includes('work') ||
      lbl.includes('office') ||
      note.includes('work')
    );
  };

  const isBusinessContact = (c: ContactItem) => {
    const cat = String(c.category || '').toUpperCase();
    return cat === 'BUSINESS' || Boolean(c.businessCategory) || Boolean(c.isVerifiedBusiness);
  };

  const isRecentContact = (c: ContactItem) => {
    const cClean = clean(c.number);
    const c10 = cClean.length >= 10 ? cClean.slice(-10) : cClean;
    const hasRecentMap = Boolean(contactRecentMap[c10] || (cClean && contactRecentMap[cClean]));
    const hasLastCall = Boolean(c.lastCallTimestamp && c.lastCallTimestamp > 0);
    const hasTotalCalls = Boolean(c.totalCallsCount && c.totalCallsCount > 0);
    return hasRecentMap || hasLastCall || hasTotalCalls;
  };

  const isGeneralContact = (c: ContactItem) => {
    const cat = String(c.category || '').toUpperCase();
    return cat === 'GENERAL' || (!isFamilyContact(c) && !isWorkContact(c) && !isBusinessContact(c) && !isFavoriteContact(c));
  };

  const matchesAccount = (c: ContactItem, accFilter: AccountFilter) => {
    if (accFilter === 'ALL') return true;
    const acc = resolveAccountType(c);
    if (accFilter === 'GOOGLE_ALL') return acc === 'GOOGLE';
    if (accFilter === 'GOOGLE_PERSONAL') return acc === 'GOOGLE' && !isGoogleWorkAccount(c);
    if (accFilter === 'GOOGLE_WORK') return acc === 'GOOGLE' && isGoogleWorkAccount(c);
    if (accFilter === 'SIM1') return acc === 'SIM1';
    if (accFilter === 'SIM2') return acc === 'SIM2';
    if (accFilter === 'PHONE') return acc === 'PHONE';
    return true;
  };

  // Dynamic counts reflecting active account filter so badges always match visible results
  const counts = useMemo(() => {
    const base = contacts.filter((c) => matchesAccount(c, accountFilter));
    return {
      ALL: base.length,
      FAVORITES: base.filter(isFavoriteContact).length,
      FAMILY: base.filter(isFamilyContact).length,
      WORK: base.filter(isWorkContact).length,
      BUSINESSES: base.filter(isBusinessContact).length,
      RECENT: base.filter(isRecentContact).length,
      GENERAL: base.filter(isGeneralContact).length,
    };
  }, [contacts, accountFilter, contactRecentMap]);

  const accountCounts = useMemo(() => {
    return {
      ALL: contacts.length,
      GOOGLE_ALL: contacts.filter((c) => resolveAccountType(c) === 'GOOGLE').length,
      GOOGLE_PERSONAL: contacts.filter((c) => resolveAccountType(c) === 'GOOGLE' && !isGoogleWorkAccount(c)).length,
      GOOGLE_WORK: contacts.filter((c) => resolveAccountType(c) === 'GOOGLE' && isGoogleWorkAccount(c)).length,
      SIM1: contacts.filter((c) => resolveAccountType(c) === 'SIM1').length,
      SIM2: contacts.filter((c) => resolveAccountType(c) === 'SIM2').length,
      PHONE: contacts.filter((c) => resolveAccountType(c) === 'PHONE').length,
    };
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const d = clean(query);

    return contacts
      .filter((c) => {
        // 1. Account / Storage filter
        if (!matchesAccount(c, accountFilter)) return false;

        // 2. Category filter
        if (filter === 'FAVORITES' && !isFavoriteContact(c)) return false;
        if (filter === 'FAMILY' && !isFamilyContact(c)) return false;
        if (filter === 'WORK' && !isWorkContact(c)) return false;
        if (filter === 'BUSINESSES' && !isBusinessContact(c)) return false;
        if (filter === 'RECENT' && !isRecentContact(c)) return false;
        if (filter === 'GENERAL' && !isGeneralContact(c)) return false;

        // 3. Search query
        if (!q) return true;
        const nameMatch = String(c.name ?? '').toLowerCase().includes(q);
        const bizMatch = Boolean(String(c.businessCategory ?? '').toLowerCase().includes(q));
        const numClean = clean(c.number);
        const numMatch = d.length > 0 && numClean.includes(d);
        const notesMatch = Boolean(String(c.notes ?? '').toLowerCase().includes(q));
        const accountMatch = Boolean(String(c.accountLabel ?? '').toLowerCase().includes(q));
        return nameMatch || bizMatch || numMatch || notesMatch || accountMatch;
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
    if (c.accountType === 'SIM1') setAccountChoice('SIM1');
    else if (c.accountType === 'SIM2') setAccountChoice('SIM2');
    else if (c.accountType === 'PHONE') setAccountChoice('PHONE');
    else if (isGoogleWorkAccount(c)) setAccountChoice('GOOGLE_WORK');
    else setAccountChoice('GOOGLE_PERSONAL');
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
    const accType: ContactItem['accountType'] =
      accountChoice === 'SIM1' ? 'SIM1' : accountChoice === 'SIM2' ? 'SIM2' : accountChoice === 'PHONE' ? 'PHONE' : 'GOOGLE';
    const accLabel =
      accountChoice === 'GOOGLE_WORK'
        ? 'Google (Work)'
        : accountChoice === 'GOOGLE_PERSONAL'
        ? 'Google (Personal)'
        : accountChoice === 'SIM1'
        ? 'SIM 1 (Personal)'
        : accountChoice === 'SIM2'
        ? 'SIM 2 (Work)'
        : 'Device Storage';

    if (editing && selected) {
      onUpdateContact(selected.id, { 
        name: name.trim(), 
        number: number.trim(), 
        category,
        accountType: accType,
        accountLabel: accLabel,
      });
    } else {
      onAddContact({
        name: name.trim(),
        number: number.trim(),
        category,
        trusted: true,
        isFavorite: category === 'FAVORITE',
        accountType: accType,
        accountLabel: accLabel,
        notes: '',
      });
    }
    setName('');
    setNumber('');
    setCategory('GENERAL');
    setAccountChoice('GOOGLE_PERSONAL');
    setEditing(false);
    setShowAdd(false);
    setSelected(null);
  };

  const categoryTabs: FilterTabOption<CategoryFilter>[] = [
    { id: 'ALL', label: t('filter_all') || 'All', icon: Users, count: counts.ALL, badgeVariant: 'default' },
    { id: 'FAVORITES', label: t('cat_favorites') || 'Favorites', icon: Star, count: counts.FAVORITES, badgeVariant: 'favorite' },
    { id: 'FAMILY', label: t('cat_family') || 'Family', icon: Heart, count: counts.FAMILY, badgeVariant: 'default' },
    { id: 'WORK', label: t('cat_work') || 'Work', icon: Briefcase, count: counts.WORK, badgeVariant: 'default' },
    { id: 'BUSINESSES', label: t('cat_businesses') || 'Businesses', icon: Building2, count: counts.BUSINESSES, badgeVariant: 'default' },
    { id: 'RECENT', label: t('cat_recent') || 'Recent', icon: Clock, count: counts.RECENT, badgeVariant: 'default' },
    { id: 'GENERAL', label: t('cat_general') || 'General', icon: UserRound, count: counts.GENERAL, badgeVariant: 'default' },
  ];

  const isCompact = density === 'compact';

  const autocompleteItems: AutocompleteItem[] = useMemo(() => {
    return contacts.map((c) => ({
      id: c.id,
      name: c.name,
      number: c.number,
      category: c.category,
      accountLabel: c.accountLabel || resolveAccountType(c),
      type: 'contact',
    }));
  }, [contacts]);

  return (
    <div className={`mx-auto w-full max-w-2xl select-none transition-all ${isCompact ? 'px-2 pb-6 pt-1 sm:px-3' : 'px-3 pb-8 pt-2 sm:px-4'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between gap-2 transition-all ${isCompact ? 'mb-2' : 'mb-3'}`}>
        <div>
          <h1 className={`font-black tracking-tight text-white transition-all ${isCompact ? 'text-lg' : 'text-xl'}`}>{t('contacts_title')}</h1>
          <p className="text-[11px] text-slate-400">
            {filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'} {filter !== 'ALL' ? `· ${filter.toLowerCase()}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Storage Accounts Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountMenu((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                accountFilter !== 'ALL'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
              }`}
              title="Filter by Google, SIM or Device Storage"
            >
              <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span>
                {accountFilter === 'ALL'
                  ? 'All Storage'
                  : accountFilter === 'GOOGLE_ALL'
                  ? 'All Google'
                  : accountFilter === 'GOOGLE_PERSONAL'
                  ? 'Google'
                  : accountFilter === 'GOOGLE_WORK'
                  ? 'Work'
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
                    { id: 'ALL' as const, label: 'All Accounts', count: accountCounts.ALL, icon: Users },
                    { id: 'GOOGLE_ALL' as const, label: 'All Google Accounts', count: accountCounts.GOOGLE_ALL, icon: Building2 },
                    { id: 'GOOGLE_PERSONAL' as const, label: 'Google (Personal)', count: accountCounts.GOOGLE_PERSONAL, icon: Building2 },
                    { id: 'GOOGLE_WORK' as const, label: 'Google (Work)', count: accountCounts.GOOGLE_WORK, icon: Briefcase },
                    { id: 'SIM1' as const, label: 'SIM 1 Storage', count: accountCounts.SIM1, icon: Smartphone },
                    { id: 'SIM2' as const, label: 'SIM 2 Storage', count: accountCounts.SIM2, icon: Smartphone },
                    { id: 'PHONE' as const, label: 'Device Storage', count: accountCounts.PHONE, icon: Smartphone },
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
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
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
            className={`hidden rounded-xl border border-white/10 bg-white/5 font-semibold text-slate-300 sm:block hover:bg-white/10 transition cursor-pointer ${isCompact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'}`}
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
            className={`flex items-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer ${isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
          >
            <Plus className={`stroke-[2.5] ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />
            <span>{t('add')}</span>
          </button>
        </div>
      </header>

      {/* Global Search Bar with Live Autocomplete Filtering */}
      <GlobalSearchAutocomplete
        value={query}
        onChange={setQuery}
        placeholder={t('search_contacts') || 'Search contacts or enter phone number...'}
        items={autocompleteItems}
        onSelectItem={(item) => {
          setQuery(item.name || item.number);
          const found = contacts.find((c) => c.id === item.id);
          if (found) {
            if (onOpenCallerDetail) {
              onOpenCallerDetail({ number: found.number, name: found.name, contact: found });
            } else {
              setSelected(found);
            }
          }
        }}
        onInitiateCall={onInitiateCall}
        density={density}
      />

      {/* Modern Category Filter Navigation Bar - 100% Reliable click response */}
      <ModernFilterBar<CategoryFilter>
        tabs={categoryTabs}
        activeId={filter}
        onChange={(newFilter) => {
          setFilter(newFilter);
        }}
        accentClass="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_2px_12px_rgba(59,130,246,0.35)]"
        activeTextClass="text-white font-bold"
      />

      {/* Active Storage Account Notice & Reset */}
      {accountFilter !== 'ALL' && (
        <div className="flex items-center justify-between gap-2 px-1 py-1 -mt-1 mb-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Storage Filter:</span>
            <span className="font-bold text-blue-300">
              {accountFilter === 'GOOGLE_ALL'
                ? 'All Google Accounts'
                : accountFilter === 'GOOGLE_PERSONAL'
                ? 'Google (Personal)'
                : accountFilter === 'GOOGLE_WORK'
                ? 'Google (Work)'
                : accountFilter === 'SIM1'
                ? 'SIM 1 Storage'
                : accountFilter === 'SIM2'
                ? 'SIM 2 Storage'
                : 'Device Storage'}
            </span>
            <span className="text-slate-500">({filtered.length} visible)</span>
          </div>
          <button
            type="button"
            onClick={() => setAccountFilter('ALL')}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
          >
            <span>Show all</span>
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Contacts List */}
      {filtered.length === 0 ? (
        <div className={`border border-white/10 bg-[#0e141c] text-center transition-all ${isCompact ? 'rounded-xl p-6' : 'rounded-2xl p-8'}`}>
          <UserRound className={`mx-auto text-slate-700 ${isCompact ? 'h-6 w-6' : 'h-7 w-7'}`} />
          <p className={`font-semibold text-slate-300 ${isCompact ? 'mt-1.5 text-[11px]' : 'mt-2 text-xs'}`}>
            {contacts.length ? (
              filter !== 'ALL' || accountFilter !== 'ALL' ? (
                <>No contacts match active filters ({filter.toLowerCase()})</>
              ) : (
                t('no_matching_contacts')
              )
            ) : (
              t('no_contacts_yet')
            )}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {(filter !== 'ALL' || accountFilter !== 'ALL' || query) && (
              <button
                type="button"
                onClick={() => {
                  setFilter('ALL');
                  setAccountFilter('ALL');
                  setQuery('');
                }}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-white/10 transition cursor-pointer"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`overflow-hidden border border-white/[0.08] bg-[#0c121e]/90 shadow-sm transition-all ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`flex items-center border-b border-white/[0.05] last:border-0 hover:bg-[#121a2b] transition ${isCompact ? 'gap-2.5 px-3 py-2.5' : 'gap-3 px-3.5 py-3'}`}
            >
              <button
                type="button"
                onClick={() => {
                  if (onOpenCallerDetail) {
                    onOpenCallerDetail({ number: c.number, name: c.name, contact: c });
                  } else {
                    setSelected(c);
                  }
                }}
                className={`grid shrink-0 place-items-center rounded-full bg-slate-800 text-slate-200 border border-white/10 font-bold transition-all cursor-pointer ${isCompact ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm'}`}
              >
                {c.isVerifiedBusiness ? (
                  <Building2 className={isCompact ? 'h-4 w-4 text-blue-400' : 'h-4.5 w-4.5 text-blue-400'} />
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
                  }
                }}
                className="min-w-0 flex-1 text-left cursor-pointer focus:outline-none"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`truncate font-semibold tracking-tight text-white transition-all ${isCompact ? 'text-xs' : 'text-sm'}`}>{c.name}</span>
                  {c.isVerifiedBusiness && <ShieldCheck className={`text-blue-400 shrink-0 ${isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} />}
                  <span className="text-[11px] font-medium text-slate-400">
                    · {c.accountType === 'SIM1' ? 'SIM 1' : c.accountType === 'SIM2' ? 'SIM 2' : c.accountType === 'PHONE' ? 'Device' : 'Google'}
                  </span>
                  {c.category && c.category !== 'GENERAL' && (
                    <span className="text-[11px] font-medium text-slate-400 capitalize">· {c.category.toLowerCase()}</span>
                  )}
                </div>
                <div className={`truncate text-slate-400 transition-all font-mono tabular-nums ${isCompact ? 'mt-0 text-[10.5px]' : 'mt-0.5 text-[11.5px]'}`}>
                  {c.number}
                  {c.businessCategory ? ` · ${c.businessCategory}` : ''}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(c.id)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:text-amber-400 transition cursor-pointer active:scale-95"
                title={t('favorite')}
                aria-label={c.isFavorite ? 'Unmark favorite' : 'Mark favorite'}
              >
                <Star className={`h-4 w-4 ${c.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onInitiateCall(c.number, c.name)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition cursor-pointer active:scale-95"
                aria-label={`${t('nav_phone')} ${c.name}`}
                title={`Call ${c.name}`}
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                  <Phone className="h-4 w-4 fill-current" />
                </div>
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
            <div className="mt-6 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => onInitiateCall(selected.number, selected.name)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-500/10 p-3 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
              >
                <Phone className="h-5 w-5" />
                <span className="text-xs font-semibold">{t('call')}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(selected.id)}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 p-3 text-amber-400 hover:bg-white/10 transition cursor-pointer"
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
                value={accountChoice}
                onChange={(e) => setAccountChoice(e.target.value as AccountChoice)}
                className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-[#10161d] px-3 text-sm text-white outline-none focus:border-emerald-500/40"
              >
                <option value="GOOGLE_PERSONAL">Google Account (Personal - ashiqm867@gmail.com)</option>
                <option value="GOOGLE_WORK">Google Account (Work)</option>
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
