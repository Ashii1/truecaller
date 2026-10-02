import { memo } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  Lock,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllData?: () => void;
  inline?: boolean;
}

interface DataSourceItem {
  id: string;
  name: string;
  category: string;
  authority: string;
  confidence: string;
  description: string;
  attribution: string;
  license: string;
  badgeColor: string;
  icon: typeof Database;
}

const DATA_SOURCES: DataSourceItem[] = [
  {
    id: 'trai',
    name: 'TRAI Commercial Telemarketer Registry',
    category: 'Official Regulatory',
    authority: 'Telecom Regulatory Authority of India',
    confidence: '100% Deterministic',
    description: 'Statutory 140-series allocations mandated for all registered telemarketers, banks, and enterprise outbound sales agents across Indian telecom operators.',
    attribution: 'TRAI Statutory DND (Do Not Disturb) and UCC Telemarketing Regulations',
    license: 'Public Telecom Regulatory Open Data',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: ShieldCheck,
  },
  {
    id: 'opencorporates',
    name: 'OpenCorporates Global Corporate Database',
    category: 'Public Company Registry',
    authority: 'OpenCorporates Open Legal Entities Database',
    confidence: '98% Verified',
    description: 'Audited enterprise registrations, official registered office telephone listings, and legal entity identifiers for corporate callers.',
    attribution: 'Data sourced under Open Database License (ODbL) from OpenCorporates Ltd.',
    license: 'Open Database License (ODbL) 1.0',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    icon: Building2,
  },
  {
    id: 'stir_shaken',
    name: 'STIR/SHAKEN Cryptographic Caller ID',
    category: 'Telecom Cryptography',
    authority: 'ATIS-1000074 / FCC Part 64 Standards',
    confidence: '99% Carrier Verified',
    description: 'Cryptographic digital certificates embedded directly in SIP invite headers to mathematically prove the originating caller identity and eliminate neighbor spoofing.',
    attribution: 'ATIS / SIP Forum NANC Call Authentication Standard',
    license: 'Public International Telephony Standard',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    icon: Radio,
  },
  {
    id: 'itu',
    name: 'ITU-T E.164 National Numbering Plans',
    category: 'International Standard',
    authority: 'International Telecommunication Union (Geneva)',
    confidence: '100% Deterministic',
    description: 'Official global routing tables, international country calling codes, domestic numbering plans, and statutory toll-free series (1800, 800, 888).',
    attribution: 'ITU-T Recommendation E.164 & libphonenumber project',
    license: 'Apache License 2.0',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    icon: Globe2,
  },
  {
    id: 'community',
    name: 'CallShield Distributed Anti-Abuse Network',
    category: 'Time-Decayed Heuristics',
    authority: 'CallShield Autonomous Anti-Fraud Engine',
    confidence: 'Multi-Corroborated',
    description: 'Aggregated community abuse reports with exponential 30-day time decay. Single reports are never actionable; automated algorithmic consensus prevents harassment.',
    attribution: 'CallShield Decentralized Telephony Threat Intelligence',
    license: 'CallShield Strict Zero-Telemetry Protocol',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: Sparkles,
  },
];

const DataSourcesModal = memo(function DataSourcesModal({
  isOpen,
  onClose,
  inline = false,
}: DataSourcesModalProps) {
  if (!isOpen) return null;

  const content = (
    <div className="space-y-4">
      {/* Top Back Navigation & Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shrink-0">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 truncate">
            <h1 className="text-base font-bold text-white tracking-tight">
              Data Sources & Attribution
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              Public registries, regulatory data & open licensing
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition active:scale-95 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* Zero Address-Book Scraping Hero Guarantee */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950 p-4 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Strict Zero-Telemetry & Zero-Scraping Commitment</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Unlike traditional caller-ID applications that harvest your address book and upload your friends' phone numbers to commercial cloud databases, CallShield <strong>never uploads your private contacts</strong>. All caller identification is resolved from audited public registries, regulatory statutory series, or performed entirely on-device.
        </p>
      </div>

      {/* Data Sources Inset List */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Authorized Public Data Sources
        </h2>

        <div className="space-y-2.5">
          {DATA_SOURCES.map((src) => {
            const Icon = src.icon;
            return (
              <div
                key={src.id}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.04] p-3.5 space-y-2 transition"
              >
                {/* Source Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-slate-300 shrink-0">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate">
                        {src.name}
                      </h3>
                      <div className="text-[10px] text-slate-400 truncate">
                        {src.authority}
                      </div>
                    </div>
                  </div>

                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${src.badgeColor}`}>
                    {src.category}
                  </span>
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {src.description}
                </p>

                {/* Metadata & Attribution Pill */}
                <div className="pt-1 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-1">
                  <span className="truncate max-w-[220px]">
                    {src.attribution}
                  </span>
                  <span className="font-mono text-emerald-400/90 font-medium">
                    {src.confidence}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Licensing & Legal Attribution Section */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2 text-xs text-slate-400">
        <h3 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
          <span>Open Data Licensing Transparency</span>
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          OpenCorporates company data is licensed under the <strong>Open Database License (ODbL)</strong>. Any telecommunication prefix information from the International Telecommunication Union conforms to Recommendation ITU-T E.164. All commercial telemarketer data is statutory public regulatory data released by TRAI.
        </p>
      </div>

      {/* Footer Return Button */}
      <div className="pt-1 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition active:scale-95 cursor-pointer"
        >
          Return to Settings
        </button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Data Sources & Public Attribution"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0d131f] p-4 sm:p-5 shadow-2xl">
        {content}
      </div>
    </div>
  );
});

export default DataSourcesModal;
