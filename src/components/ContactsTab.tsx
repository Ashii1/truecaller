import { useState, useMemo, useRef, FormEvent, ChangeEvent } from 'react';
import {
  Users,
  Search,
  Plus,
  Star,
  Phone,
  MessageSquare,
  Shield,
  ShieldCheck,
  Building2,
  Trash2,
  Edit2,
  Share2,
  Check,
  X,
  Upload,
  Download,
  Video,
  Info,
  Smartphone,
  FileSpreadsheet
} from 'lucide-react';
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

export default function ContactsTab({
  contacts,
  onInitiateCall,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  onToggleFavorite,
  recentCalls,
}: ContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [newContactCategory, setNewContactCategory] = useState<'FAVORITE' | 'FAMILY' | 'WORK' | 'BUSINESS' | 'GENERAL'>('GENERAL');
  const [newContactNotes, setNewContactNotes] = useState('');
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Category filter
      if (activeCategory === 'FAVORITES' && !c.isFavorite) return false;
      if (activeCategory === 'FAMILY' && c.category !== 'FAMILY') return false;
      if (activeCategory === 'WORK' && c.category !== 'WORK') return false;
      if (activeCategory === 'BUSINESSES' && c.category !== 'BUSINESS') return false;
      if (activeCategory === 'RECENT' && (!c.lastCallTimestamp || c.lastCallTimestamp < Date.now() - 86400000 * 7)) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesNum = c.number.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const matchesBiz = c.businessCategory?.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesBiz) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, activeCategory, searchQuery]);

  const handleCreateContact = (e: FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactNumber.trim()) return;

    onAddContact({
      name: newContactName.trim(),
      number: newContactNumber.trim(),
      category: newContactCategory,
      isFavorite: newContactCategory === 'FAVORITE',
      trusted: true,
      notes: newContactNotes.trim(),
      avatarColor: 'from-indigo-600 to-violet-600',
    });

    setNewContactName('');
    setNewContactNumber('');
    setNewContactNotes('');
    setIsAddModalOpen(false);
  };

  const handleShareContact = (c: ContactItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${c.name}: ${c.number}`);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    }
  };

  // Android Native ContactsContract, Web Contacts API & vCard / CSV Import
  const handleImportDeviceContacts = async () => {
    // 1. If running in Android WebView with native bridge
    if (telecomBridge.isAndroidEnvironment()) {
      try {
        const deviceContacts = telecomBridge.fetchDeviceContacts(500);
        if (deviceContacts && deviceContacts.length > 0) {
          deviceContacts.forEach((c) => {
            onAddContact({
              name: c.name,
              number: c.number,
              category: 'GENERAL',
              trusted: true,
              isFavorite: c.isFavorite,
              notes: 'Imported from Android ContactsContract',
            });
          });
          return;
        }
      } catch (err) {
        console.warn('Native contacts fetch error:', err);
      }
    }

    // 2. Web Contacts API (PWA / Chrome on Android)
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: true };
        const picked = await (navigator as any).contacts.select(props, opts);
        if (picked && picked.length > 0) {
          picked.forEach((p: any) => {
            const name = p.name?.[0] || 'Device Contact';
            const tel = p.tel?.[0];
            if (tel) {
              onAddContact({
                name,
                number: tel,
                category: 'GENERAL',
                trusted: true,
                notes: 'Imported from device address book via Web Contacts API',
              });
            }
          });
          return;
        }
      } catch (err) {
        console.warn('Device contacts selector dismissed or unsupported:', err);
      }
    }
    // 3. Fallback to file picker for vCard (.vcf) or CSV
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;

      if (file.name.endsWith('.vcf') || text.includes('BEGIN:VCARD')) {
        // Simple vCard parser
        const cards = text.split('BEGIN:VCARD');
        for (const card of cards) {
          const fnMatch = card.match(/FN:(.+)/i) || card.match(/N;[^:]*:(.+)/i);
          const telMatch = card.match(/TEL[^:]*:(.+)/i);
          if (telMatch) {
            const name = fnMatch ? fnMatch[1].replace(/;/g, ' ').trim() : 'Imported Contact';
            const number = telMatch[1].trim();
            onAddContact({
              name,
              number,
              category: 'GENERAL',
              trusted: true,
              notes: 'Imported from .vcf vCard file',
            });
          }
        }
      } else {
        // Simple CSV parser (Name, Phone)
        const lines = text.split('\n');
        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length >= 2) {
            const name = parts[0].replace(/"/g, '').trim();
            const number = parts[1].replace(/"/g, '').trim();
            if (number.replace(/\D/g, '').length >= 7) {
              onAddContact({
                name,
                number,
                category: 'GENERAL',
                trusted: true,
                notes: 'Imported from CSV file',
              });
            }
          }
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatPhoneNumber = (num: string) => {
    const clean = num.replace(/\D/g, '');
    if (clean.length === 10) {
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length === 11 && clean.startsWith('1')) {
      return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
    }
    return num;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Hidden file input for vCard / CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,.csv,text/vcard,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center space-x-2">
            <span>Contacts</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
              {contacts.length} saved
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Local sandbox only • Zero cloud exfiltration • Friends/family never blocked</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Import Contacts Button */}
          <button
            onClick={handleImportDeviceContacts}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition flex items-center space-x-1.5 active:scale-95"
            title="Import from Android Contacts or local vCard/CSV file"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Contacts</span>
          </button>

          {/* New Contact Button */}
          <button
            id="btn-add-contact"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center space-x-1.5 shadow-lg shadow-indigo-950/50 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Contact</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, number, or business category..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {(
          [
            { key: 'ALL', label: 'All Contacts' },
            { key: 'FAVORITES', label: '⭐ Favorites' },
            { key: 'FAMILY', label: '🏠 Family' },
            { key: 'WORK', label: '💼 Work' },
            { key: 'BUSINESSES', label: '🏢 Verified' },
            { key: 'RECENT', label: '📞 Recent Callers' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
              activeCategory === tab.key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contacts List */}
      <div className="space-y-2">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-800/20 rounded-2xl border border-slate-800/80 space-y-3">
            <Users className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <div className="text-sm font-bold text-slate-300">
                {searchQuery ? 'No matching contacts found' : 'Address book is empty'}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                VigilShield strictly adheres to a zero address-book upload policy. Your contacts stay on your device. Click &ldquo;Import Contacts&rdquo; to load contacts from your phone or .vcf file, or add a contact manually.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={handleImportDeviceContacts}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Import from Device</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 cursor-pointer transition-all flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3 min-w-0">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${contact.avatarColor || 'from-indigo-600 to-violet-600'} flex items-center justify-center text-white text-sm font-bold shadow`}>
                  {contact.isVerifiedBusiness ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    contact.name.slice(0, 1).toUpperCase()
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition">
                      {contact.name}
                    </span>
                    {contact.isFavorite && (
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    {contact.isVerifiedBusiness ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        ✓ Verified
                      </span>
                    ) : contact.trusted ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🟢 Trusted
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                    <span>{formatPhoneNumber(contact.number)}</span>
                    {contact.businessCategory && (
                      <>
                        <span>•</span>
                        <span className="text-slate-300 truncate">{contact.businessCategory}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onInitiateCall(contact.number, contact.name);
                  }}
                  className="w-8 h-8 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 flex items-center justify-center transition shadow"
                  title="Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(contact.id);
                  }}
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center transition ${
                    contact.isFavorite
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                  }`}
                  title={contact.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                >
                  <Star className={`w-3.5 h-3.5 ${contact.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SMART CONTACT PROFILE MODAL */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
                <span>Contact Card</span>
                {selectedContact.isVerifiedBusiness && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300">
                    Official Enterprise
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar & Info */}
            <div className="text-center space-y-2">
              <div className={`w-20 h-20 rounded-3xl mx-auto bg-gradient-to-tr ${selectedContact.avatarColor || 'from-indigo-600 to-violet-600'} flex items-center justify-center text-white text-3xl font-bold shadow-xl border-2 border-slate-700`}>
                {selectedContact.isVerifiedBusiness ? (
                  <Building2 className="w-10 h-10" />
                ) : (
                  selectedContact.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center justify-center space-x-1.5">
                  <span>{selectedContact.name}</span>
                  {selectedContact.isFavorite && (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  )}
                </h2>
                <p className="text-sm font-semibold text-slate-300 mt-0.5">
                  {formatPhoneNumber(selectedContact.number)}
                </p>
                {selectedContact.businessCategory && (
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedContact.businessCategory}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Circle Buttons */}
            <div className="flex items-center justify-center space-x-4 py-2">
              <button
                onClick={() => {
                  const num = selectedContact.number;
                  const name = selectedContact.name;
                  setSelectedContact(null);
                  onInitiateCall(num, name);
                }}
                className="flex flex-col items-center space-y-1 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-950/50 transition active:scale-95">
                  <Phone className="w-5 h-5 fill-current" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300">Call</span>
              </button>

              <button
                onClick={() => {
                  alert(`Message composer for ${selectedContact.name}`);
                }}
                className="flex flex-col items-center space-y-1 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-950/50 transition active:scale-95">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300">Message</span>
              </button>

              <button
                onClick={() => handleShareContact(selectedContact)}
                className="flex flex-col items-center space-y-1 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center border border-slate-700 transition active:scale-95">
                  {copiedShareLink ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
                </div>
                <span className="text-[11px] font-semibold text-slate-300">
                  {copiedShareLink ? 'Copied' : 'Share'}
                </span>
              </button>
            </div>

            {/* Notes & Actions */}
            <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-800 text-xs space-y-1.5">
              <div className="text-slate-400 font-medium">Personal Notes:</div>
              <div className="text-slate-200">{selectedContact.notes || 'No notes added.'}</div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  onDeleteContact(selectedContact.id);
                  setSelectedContact(null);
                }}
                className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 font-semibold text-xs flex items-center space-x-1.5 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>

              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW CONTACT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateContact}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Add New Contact</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="e.g., Jane Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newContactNumber}
                  onChange={(e) => setNewContactNumber(e.target.value)}
                  placeholder="e.g., +1 (555) 019-2834"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                <select
                  value={newContactCategory}
                  onChange={(e) => setNewContactCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="FAVORITE">⭐ Favorite</option>
                  <option value="FAMILY">🏠 Family</option>
                  <option value="WORK">💼 Work</option>
                  <option value="BUSINESS">🏢 Business</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newContactNotes}
                  onChange={(e) => setNewContactNotes(e.target.value)}
                  placeholder="e.g., Colleague from Product Team"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-950/50 transition"
              >
                Save Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
