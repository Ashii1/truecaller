import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  X, 
  Database, 
  Lock, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Trash2, 
  Radio, 
  Cpu, 
  FileText,
  ExternalLink
} from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllData: () => void;
}

export default function DataSourcesModal({
  isOpen,
  onClose,
  onClearAllData,
}: DataSourcesModalProps) {
  const [sources, setSources] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'SOURCES' | 'PRIVACY' | 'PLATFORM'>('SOURCES');

  useEffect(() => {
    if (isOpen) {
      fetch('/v1/data-sources')
        .then(res => res.json())
        .then(data => {
          if (data.dataSources) setSources(data.dataSources);
        })
        .catch(() => {
          // Fallback static specification if offline
          setSources([
            {
              id: 'stir_shaken',
              name: 'STIR/SHAKEN Cryptographic Caller ID',
              authority: 'ATIS-1000074 / FCC Part 64',
              confidence: '99%',
              caching: 'Ephemeral (Per call)',
              license: 'Public Telecom Standard',
            },
            {
              id: 'trai_ucc',
              name: 'TRAI Commercial Telemarketer Registry',
              authority: 'Telecom Regulatory Authority of India',
              confidence: '98%',
              caching: '30 days local SQLite',
              license: 'Indian Telecom Regulatory Open Data',
            },
            {
              id: 'itu_e164',
              name: 'ITU-T E.164 National Numbering Plans',
              authority: 'International Telecommunication Union',
              confidence: '99%',
              caching: '60 days',
              license: 'Apache 2.0 (libphonenumber)',
            },
            {
              id: 'community_reputation',
              name: 'CallShield Distributed Anti-Abuse Network',
              authority: 'Time-Decayed Community Telemetry',
              confidence: 'Weighted (40% - 95%)',
              caching: '1 hour',
              license: 'CallShield Privacy First Policy',
            }
          ]);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportData = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      settings: localStorage.getItem('vigilshield_settings'),
      rules: localStorage.getItem('vigilshield_rules'),
      whitelist: localStorage.getItem('vigilshield_whitelist'),
      contactsCount: (JSON.parse(localStorage.getItem('vigilshield_contacts') || '[]')).length,
      callsCount: (JSON.parse(localStorage.getItem('vigilshield_calls') || '[]')).length,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vigilshield-data-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Data Sources & Privacy Architecture
              </h2>
              <p className="text-xs text-slate-400">
                Transparent data origins, cryptographic proofs & zero address-book leakage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-5 pt-3 gap-4">
          <button
            onClick={() => setActiveSubTab('SOURCES')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              activeSubTab === 'SOURCES'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Authorized Data Sources
          </button>
          <button
            onClick={() => setActiveSubTab('PRIVACY')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              activeSubTab === 'PRIVACY'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Zero-Leakage Privacy Policy
          </button>
          <button
            onClick={() => setActiveSubTab('PLATFORM')}
            className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              activeSubTab === 'PLATFORM'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            OS Integration (Android vs iOS)
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeSubTab === 'SOURCES' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Zero-Scraping Guarantee:</span> CallShield never scrapes social media, websites, or proprietary caller-ID services. Every data point is sourced from official regulatory datasets, cryptographic telecom headers, or audited enterprise filings.
                </div>
              </div>

              <div className="grid gap-3">
                {sources.map(src => (
                  <div key={src.id} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 text-sm">{src.name}</span>
                      <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-300 text-[11px] rounded-full border border-indigo-500/25">
                        {src.confidence} Confidence
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                      <div>
                        <span className="text-slate-500">Authority:</span> {src.authority}
                      </div>
                      <div>
                        <span className="text-slate-500">Cache Policy:</span> {src.caching}
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500">License / Policy:</span> {src.license}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'PRIVACY' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Your Address Book Never Leaves Your Phone
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  Unlike traditional caller-ID apps that upload your entire contact book to build searchable phone directories, CallShield performs all contact matching entirely in client-side device memory. Your friends, family, and private contacts are 100% private to you.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400" />
                  Anti-Abuse & Multi-Report Protection
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  A single user report never marks a number as spam. Reports require multi-source corroboration, accumulate trust scores, and undergo exponential time-decay so that transient or disputed reports naturally expire after 30 days.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={handleExportData}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-2 font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export All My Data (JSON)
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to wipe all local cache, rules, and history?')) {
                      onClearAllData();
                      onClose();
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl flex items-center gap-2 font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Wipe All Local Data
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'PLATFORM' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Android Implementation (CallScreeningService)
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  On Android 10+ (API 29+), CallShield binds directly to the OS Telecom subsystem via <code className="text-indigo-300">android.telecom.CallScreeningService</code>. Incoming calls are intercepted in real-time before your phone rings, matching against local SQLite rules and STIR/SHAKEN verification tokens.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400" />
                  iOS Implementation (CallKit CXCallDirectoryProvider)
                </h4>
                <p className="text-slate-400 leading-relaxed">
                  On iOS 14+, Apple does not permit third-party apps to execute real-time code during incoming calls. Instead, CallShield compiles a pre-sorted database of blocked and identified numbers into the OS CallKit extension, respecting iOS's strict &lt; 5MB memory limit.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500">
          <span>Documentation reference: <code className="text-slate-400">docs/DATA_SOURCES.md</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
