import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Phone, Plus, Trash2, Check, BookUser, ExternalLink } from 'lucide-react';
import { ContactItem } from '../types';
import { telecomBridge } from '../services/telephony/telecomBridge';

interface ContactEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialNumber: string;
  existingContact?: ContactItem | null;
  onSaveContact: (contact: { id?: string; name: string; number: string; category?: any; trusted?: boolean }) => void;
  onDeleteContact?: (id: string) => void;
}

export default function ContactEditorSheet({
  isOpen,
  onClose,
  initialName = '',
  initialNumber,
  existingContact,
  onSaveContact,
  onDeleteContact,
}: ContactEditorSheetProps) {
  const [name, setName] = useState(initialName);
  const [numbers, setNumbers] = useState<string[]>([initialNumber]);
  const [category, setCategory] = useState<string>(existingContact?.category || 'GENERAL');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(existingContact?.name || initialName || '');
      const primaryNum = existingContact?.number || initialNumber || '';
      setNumbers([primaryNum]);
      setCategory(existingContact?.category || 'GENERAL');
      setError(null);
    }
  }, [isOpen, existingContact, initialName, initialNumber]);

  if (!isOpen) return null;

  const handleAddNumberField = () => {
    setNumbers((prev) => [...prev, '']);
  };

  const handleNumberChange = (index: number, val: string) => {
    setNumbers((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveNumberField = (index: number) => {
    if (numbers.length <= 1) return;
    setNumbers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const primaryNumber = (numbers[0] || '').trim();

    if (!cleanName) {
      setError('Please provide a contact name.');
      return;
    }
    if (!primaryNumber) {
      setError('Please provide at least one valid phone number.');
      return;
    }

    onSaveContact({
      id: existingContact?.id,
      name: cleanName,
      number: primaryNumber,
      category: category as any,
      trusted: true,
    });

    onClose();
  };

  const isExisting = Boolean(existingContact);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-slate-800 bg-[#0d131f] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-[#0a0f19]">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <BookUser className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {isExisting ? 'Edit Contact' : 'Add to Contacts'}
              </h3>
              <p className="text-[11px] text-slate-400">Saved to device address book</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-semibold">Back</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Contact Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Rahul Kumar"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                autoFocus
              />
            </div>
          </div>

          {/* Phone Numbers List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Phone Numbers</label>
              <button
                type="button"
                onClick={handleAddNumberField}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition"
              >
                <Plus className="h-3 w-3" />
                <span>Add another number</span>
              </button>
            </div>

            {numbers.map((num, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    value={num}
                    onChange={(e) => handleNumberChange(idx, e.target.value)}
                    placeholder={idx === 0 ? 'Primary number' : 'Alternative number'}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                </div>
                {numbers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveNumberField(idx)}
                    className="rounded-xl p-2.5 text-slate-500 hover:bg-rose-950/50 hover:text-rose-400 transition cursor-pointer"
                    title="Remove number"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Label / Category</label>
            <div className="grid grid-cols-4 gap-2">
              {(['GENERAL', 'FAMILY', 'WORK', 'FAVORITE'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl py-2 text-xs font-bold transition cursor-pointer ${
                    category === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'GENERAL' ? 'Personal' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Actions Bar */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
            {isExisting && onDeleteContact && existingContact?.id ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteContact(existingContact.id);
                  onClose();
                }}
                className="rounded-xl px-3.5 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
              >
                Delete Contact
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Save Contact</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
