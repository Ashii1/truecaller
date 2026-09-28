import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Phone,
  User,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatPhoneNumber } from '../../utils/spamEngine';

export interface AutocompleteItem {
  id: string;
  name: string;
  number: string;
  category?: string;
  accountLabel?: string;
  isSpam?: boolean;
  type?: 'contact' | 'recent' | 'rule';
  timestamp?: number;
  highlightText?: string;
}

interface GlobalSearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  items: AutocompleteItem[];
  onSelectItem?: (item: AutocompleteItem) => void;
  onInitiateCall?: (number: string, name?: string) => void;
  density?: 'compact' | 'comfortable';
}

export default function GlobalSearchAutocomplete({
  value,
  onChange,
  placeholder = 'Search numbers or caller names...',
  items,
  onSelectItem,
  onInitiateCall,
  density = 'comfortable',
}: GlobalSearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions popover when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const queryClean = value.trim().toLowerCase();
  const digitsClean = value.replace(/\D/g, '');

  const suggestions = useMemo(() => {
    if (!queryClean && !digitsClean) return [];
    const set = new Set<string>();
    const matches: AutocompleteItem[] = [];

    for (const item of items) {
      const name = (item.name || '').toLowerCase();
      const numDigits = (item.number || '').replace(/\D/g, '');
      const key = `${name}_${numDigits}`;

      if (set.has(key)) continue;

      let matched = false;
      let highlight = '';

      if (name.includes(queryClean)) {
        matched = true;
        highlight = item.name;
      } else if (digitsClean && numDigits.includes(digitsClean)) {
        matched = true;
        highlight = item.number;
      }

      if (matched) {
        set.add(key);
        matches.push({ ...item, highlightText: highlight });
        if (matches.length >= 6) break;
      }
    }
    return matches;
  }, [items, queryClean, digitsClean]);

  const handleSelect = (item: AutocompleteItem) => {
    onChange(item.name || item.number);
    setIsOpen(false);
    onSelectItem?.(item);
  };

  const isCompact = density === 'compact';

  return (
    <div ref={containerRef} className="relative w-full mb-3">
      {/* Search Input Bar */}
      <div
        className={`flex items-center gap-2 rounded-2xl border bg-[#0d131b] transition-all duration-200 ${
          isOpen && suggestions.length > 0
            ? 'border-blue-500/50 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
            : 'border-white/10 hover:border-white/20'
        } ${isCompact ? 'px-3 py-1.5' : 'px-3.5 py-2.5'}`}
      >
        <Search className={`shrink-0 text-slate-400 ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim()) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
              onChange('');
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white transition"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 overflow-hidden rounded-2xl border border-white/15 bg-[#0a0f16]/98 p-1.5 shadow-2xl shadow-black/90 backdrop-blur-2xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span>Matching Contacts & Numbers ({suggestions.length})</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">ESC to close</span>
          </div>

          <div className="max-h-60 overflow-y-auto py-1 space-y-1">
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="group flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-white/10 cursor-pointer transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow ${
                      item.isSpam
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-200 border border-white/10'
                    }`}
                  >
                    {item.isSpam ? (
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                    ) : item.type === 'recent' ? (
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      item.name?.[0]?.toUpperCase() || <User className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition">
                        {item.name || formatPhoneNumber(item.number)}
                      </h4>
                      {item.category && (
                        <span className="rounded bg-white/10 px-1.5 py-0.2 text-[9px] font-semibold text-slate-300">
                          {item.category}
                        </span>
                      )}
                      {item.accountLabel && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-blue-300">
                          {item.accountLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{formatPhoneNumber(item.number)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {onInitiateCall && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onInitiateCall(item.number, item.name);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white transition active:scale-90"
                      title={`Call ${item.name || item.number}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/15 hover:text-white transition"
                    title="Select"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
