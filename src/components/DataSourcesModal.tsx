import { memo, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe2,
  Lock,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  Info,
  Layers,
  FileText,
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
  category: 'REGULATORY' | 'CORPORATE' | 'CRYPTOGRAPHY' | 'STANDARDS' | 'COMMUNITY';
  authority: string;
  confidence: string;
  description: string;
  attribution: string;
  license: string;
  statutoryRule?: string;
  samplePrefixes: string[];
  badgeColor: string;
  icon: typeof Database;
}

const DATA_SOURCES: DataSourceItem[] = [
  {
    id: 'trai',
    name: 'TRAI Commercial Telemarketer Registry',
    category: 'REGULATORY',
    authority: 'Telecom Regulatory Authority of India (Govt. of India)',
    confidence: '100% Statutory Deterministic',
    description: 'Statutory 140-series allocations mandated for all registered telemarketers and promotional callers. 160-series designated for transactional banking and OTP alerts across Indian telecom operators.',
    attribution: 'TRAI Statutory DND & Telecom Commercial Communications Customer Preference Regulations (TCCCPR)',
    license: 'Statutory Public Telecom Regulatory Open Data',
    statutoryRule: 'Telemarketers mandated to originate calls solely from 140-series; transactional banks from 160-series.',
    samplePrefixes: ['+91 140 •••••• (Sales)', '+91 160 •••••• (Banking/OTP)'],
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: ShieldCheck,
  },
  {
    id: 'opencorporates',
    name: 'OpenCorporates Global Corporate Database',
    category: 'CORPORATE',
    authority: 'OpenCorporates Open Legal Entities Database',
    confidence: '98% Enterprise Verified',
    description: 'Audited enterprise registrations, official registered office telephone listings, and legal entity identifiers for corporate callers across 140+ international jurisdictions.',
    attribution: 'Data sourced under Open Database License (ODbL) from OpenCorporates Ltd.',
    license: 'Open Database License (ODbL) 1.0',
    statutoryRule: 'Audited against official company house records, MCA (India), SEC (US), and Companies House (UK).',
    samplePrefixes: ['Registered HQ Lines', 'Corporate Dispatch Desks'],
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    icon: Building2,
  },
  {
    id: 'stir_shaken',
    name: 'STIR/SHAKEN Cryptographic Caller ID',
    category: 'CRYPTOGRAPHY',
    authority: 'ATIS-1000074 / FCC Part 64 Standards & SIP Forum',
    confidence: '99.9% Cryptographic Proof',
    description: 'Cryptographic digital certificates embedded directly in SIP invite headers to mathematically prove the originating caller identity and eliminate neighbor and circle spoofing.',
    attribution: 'ATIS / SIP Forum NANC Call Authentication Standard',
    license: 'Public International Telephony Standard',
    statutoryRule: 'Carrier-signed JSON Web Signatures (JWS) in SIP Identity headers (Full A-level attestation).',
    samplePrefixes: ['Attestation Level A (Verified)', 'Attestation Level B/C (Untrusted)'],
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    icon: Radio,
  },
  {
    id: 'itu',
    name: 'ITU-T E.164 National Numbering Plans',
    category: 'STANDARDS',
    authority: 'International Telecommunication Union (Geneva, UN Agency)',
    confidence: '100% Deterministic',
    description: 'Official global routing tables, international country calling codes, domestic numbering plans, and statutory toll-free series (1800, 800, 888) across all 193 member states.',
    attribution: 'ITU-T Recommendation E.164 & Google libphonenumber project',
    license: 'Apache License 2.0 / Public International Standard',
    statutoryRule: 'Deterministic parsing of country codes, national destination codes, and subscriber length rules.',
    samplePrefixes: ['1800 •••••• (Toll-Free)', '+1 800 •••••• (US Toll-Free)'],
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    icon: Globe2,
  },
  {
    id: 'carrier_cnam',
    name: 'Carrier Direct CNAM & Telecom Circle Registry',
    category: 'REGULATORY',
    authority: 'National Telecom Circle Allocations (DoT / FCC / Ofcom)',
    confidence: '100% Network Verified',
    description: 'Deterministic telecom circle and operator series mapping (Airtel, Jio, Vodafone Idea, BSNL, Verizon, AT&T, T-Mobile). Resolves geographic circle and original allocation network without internet latency.',
    attribution: 'National Telecom Numbering Plan & Licensed Service Area (LSA) Allocation Tables',
    license: 'Public Telecom Technical Specifications',
    statutoryRule: 'Operator circle prefix blocks deterministically pinpoint caller circle and legitimate routing channel.',
    samplePrefixes: ['Circle LSA Mappings', 'Direct Carrier Series'],
    badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    icon: Layers,
  },
  {
    id: 'community',
    name: 'CallShield Distributed Anti-Abuse Network',
    category: 'COMMUNITY',
    authority: 'CallShield Autonomous Anti-Fraud Engine',
    confidence: 'Multi-Corroborated Consensus',
    description: 'Aggregated community abuse reports with exponential 30-day time decay. Single reports are never actionable; automated algorithmic consensus prevents harassment or malicious reporting.',
    attribution: 'CallShield Decentralized Telephony Threat Intelligence Network',
    license: 'CallShield Strict Zero-Telemetry Protocol',
    statutoryRule: 'Requires multi-user cross-verification and velocity spikes before flagging. Time-decayed auto-pruning.',
    samplePrefixes: ['High-Velocity Robocall Bursts', 'Phishing Callback Traps'],
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: Sparkles,
  },
];

const SAMPLE_QUERIES = [
  { label: '140 Series', query: '140', note: 'TRAI Telemarketer' },
  { label: '160 Series', query: '160', note: 'TRAI Banking' },
  { label: 'OpenCorporates', query: 'OpenCorporates', note: 'Enterprise DB' },
  { label: 'STIR/SHAKEN', query: 'STIR', note: 'Digital Proof' },
  { label: 'Toll-Free', query: '1800', note: 'E.164 ITU' },
];

const DataSourcesModal = memo(function DataSourcesModal({
  isOpen,
  onClose,
  inline = false,
}: DataSourcesModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredSources = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return DATA_SOURCES.filter((src) => {
      if (selectedCategory !== 'ALL' && src.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        src.name.toLowerCase().includes(q) ||
        src.authority.toLowerCase().includes(q) ||
        src.description.toLowerCase().includes(q) ||
        src.attribution.toLowerCase().includes(q) ||
        src.license.toLowerCase().includes(q) ||
        (src.statutoryRule && src.statutoryRule.toLowerCase().includes(q)) ||
        src.samplePrefixes.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const content = (
    <div className="mx-auto w-full max-w-2xl space-y-4 text-slate-200">
      {/* 1. Header with Back Navigation */}
      <div className="sticky top-0 z-20 -mx-2 sm:-mx-3 px-3 py-2.5 bg-[#080c14]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer shrink-0 border border-white/[0.08]"
            aria-label="Back"
            title="Return to Settings"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight truncate">
              Data Sources & Public Attribution
            </h1>
            <p className="text-[11px] text-slate-400 truncate">
              TRAI Registry, OpenCorporates, and Public Telecom Standards
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold">
          <ShieldCheck className="h-3 w-3" />
          <span>Audited Open Data</span>
        </span>
      </div>

      {/* 2. Zero Address-Book Scraping Hero Guarantee */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950 p-4 sm:p-5 space-y-2 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Strict Zero Address-Book Scraping Guarantee</span>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
          Unlike commercial caller-ID apps that upload your personal address book and disclose your friends’ phone numbers without their consent, <strong>CallShield never uploads, transmits, or crowdsources your private contacts</strong>.
        </p>
        <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-emerald-500/20">
          All caller identification is resolved 100% deterministically from public regulatory registries (TRAI), open corporate registers (OpenCorporates ODbL), international standards (ITU-T E.164), or on-device cryptographic verification (STIR/SHAKEN).
        </p>
      </div>

      {/* 3. Interactive Search & Quick Filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search data sources, registries, prefixes (e.g. 140, TRAI, ODbL)…"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/[0.08] focus:border-blue-500/50 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick query chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Quick query:</span>
          {SAMPLE_QUERIES.map((sq) => (
            <button
              key={sq.label}
              type="button"
              onClick={() => setSearchQuery(sq.query)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer"
            >
              <span className="font-semibold">{sq.label}</span>
              <span className="text-[9px] text-slate-500">· {sq.note}</span>
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'ALL', label: 'All Sources' },
            { id: 'REGULATORY', label: 'TRAI & Regulatory' },
            { id: 'CORPORATE', label: 'Corporate & Entities' },
            { id: 'CRYPTOGRAPHY', label: 'STIR/SHAKEN' },
            { id: 'STANDARDS', label: 'ITU Standards' },
            { id: 'COMMUNITY', label: 'Anti-Abuse' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600/30 border border-blue-500/50 text-white'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Filtered Data Source Cards */}
      <div className="space-y-3 pt-1">
        {filteredSources.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center space-y-2">
            <Info className="mx-auto h-6 w-6 text-slate-500" />
            <div className="text-sm font-semibold text-white">No matching registry found</div>
            <p className="text-xs text-slate-400">
              Try searching for "TRAI", "140", "OpenCorporates", or clear the filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredSources.map((src) => {
            const Icon = src.icon;
            return (
              <div
                key={src.id}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.045] p-4 space-y-2.5 transition shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-slate-200 shrink-0 border border-white/[0.08]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-white tracking-tight truncate">
                        {src.name}
                      </h2>
                      <p className="text-[11px] text-slate-400 truncate">
                        {src.authority}
                      </p>
                    </div>
                  </div>

                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shrink-0 ${src.badgeColor}`}>
                    {src.confidence}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {src.description}
                </p>

                {/* Statutory Rule / Sample Prefixes */}
                {src.statutoryRule && (
                  <div className="rounded-xl bg-black/40 border border-white/[0.05] p-2.5 text-[11px] text-slate-300 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>Statutory Telephony Rule:</span>
                    </div>
                    <p className="text-slate-300 leading-normal">{src.statutoryRule}</p>
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {src.samplePrefixes.map((p) => (
                        <span key={p} className="font-mono text-[10px] bg-white/[0.06] text-slate-200 px-1.5 py-0.5 rounded border border-white/[0.08]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attribution & Legal License Footer */}
                <div className="pt-2 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-1.5">
                  <div className="flex items-center gap-1 text-slate-400 truncate">
                    <FileText className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="truncate">{src.attribution}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 shrink-0">
                    {src.license}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Open Data Legal Disclosure */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 text-xs text-slate-400">
        <h3 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-blue-400" />
          <span>Open Data Licensing Transparency</span>
        </h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          OpenCorporates entity data is licensed under the <strong>Open Database License (ODbL) v1.0</strong>. Telecommunication routing rules and prefixes conform to ITU-T Recommendation E.164. Statutory telemarketing and transactional series are published under public regulatory mandates by the Telecom Regulatory Authority of India (TRAI).
        </p>
      </div>

      {/* 6. Return Button */}
      <div className="pt-2 pb-6 flex justify-center">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-5 py-2.5 text-xs font-semibold text-slate-200 transition active:scale-95 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Settings</span>
        </button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  // Full-page native modal overlay with zero dark cramped popup styling
  return (
    <div
      className="fixed inset-0 z-[70] bg-[#080c14] overflow-y-auto px-3 sm:px-4 py-3 animate-in fade-in duration-150"
      role="region"
      aria-label="Data Sources & Public Attribution"
    >
      {content}
    </div>
  );
});

export default DataSourcesModal;
