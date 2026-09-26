import { useState } from 'react';
import { ArrowLeft, Shield, FileText, Lock, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/LanguageContext';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
}

export default function PrivacyTermsModal({ isOpen, onClose, defaultTab = 'privacy' }: PrivacyTermsModalProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 p-3 safe-top-modal sm:p-5 backdrop-blur-sm animate-fade-in">
      <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {activeTab === 'privacy' ? t('privacy_policy') : t('terms_of_service')}
              </h2>
              <p className="text-xs text-slate-400">Legal, Privacy & Compliance Transparency</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-xs font-semibold">Back</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'privacy'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('privacy_policy')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              activeTab === 'terms'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('terms_of_service')}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-slate-300 text-xs leading-relaxed">
          {activeTab === 'privacy' ? (
            <>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>CallShield Privacy Commitment: Zero Cloud Telemetry</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Unlike conventional caller ID applications, CallShield does not upload your address book, contact names,
                  or private telephone numbers to any cloud database or third-party marketing network.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm">1. Contacts & Address Book Data</h4>
                <p>
                  CallShield requests READ_CONTACTS and WRITE_CONTACTS permissions solely to display contact names
                  during incoming calls, allow in-app contact management, and establish your Trusted Circle.
                  This processing is strictly on-device; contact entries never leave the boundary of your phone.
                </p>

                <h4 className="font-bold text-white text-sm">2. Real-Time Call History & Audio Recordings</h4>
                <p>
                  Call logs and call recordings made through the in-call interface are saved directly to your phone&apos;s
                  internal filesystem (under <span className="font-mono text-emerald-400">Internal Storage/Recordings/CallShield/</span>)
                  and IndexedDB storage. You retain 100% control to export, share, or permanently delete call recordings at any moment.
                </p>

                <h4 className="font-bold text-white text-sm">3. Spam Detection & Directory Identification</h4>
                <p>
                  Unknown caller detection relies on local heuristic analysis, Indian TRAI telemarketer prefix databases (140/160 series),
                  and offline crowd-sourced directory records. No continuous cellular monitoring or location tracking is performed.
                </p>

                <h4 className="font-bold text-white text-sm">4. Default Phone App Role</h4>
                <p>
                  When designated as the Default Phone App, CallShield operates Android&apos;s native InCallService to present
                  the active dialer, caller ID banners, and call controls in strict accordance with Google Play Telecom policies.
                </p>

                <h4 className="font-bold text-white text-sm">5. User Rights & Data Deletion</h4>
                <p>
                  You may wipe all cached directory records, custom rules, and call logs with one tap using the &quot;Clear All Data&quot;
                  action in Settings at any time.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <FileText className="h-4 w-4" />
                  <span>Terms of Service & Usage Guidelines</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  By installing or utilizing CallShield, you agree to these operational terms governing telephony and call management.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm">1. Emergency Calling Provision</h4>
                <p>
                  Emergency numbers (e.g. 100, 108, 112, 911) are prioritized and routed directly to the native cellular
                  network infrastructure without filtering, suppression, or screening delays.
                </p>

                <h4 className="font-bold text-white text-sm">2. Call Recording Regulations</h4>
                <p>
                  CallShield provides hardware-assisted local call recording. Users are solely responsible for compliance with
                  applicable regional, state, or federal laws regarding telephone call recording (including single-party or
                  all-party consent requirements).
                </p>

                <h4 className="font-bold text-white text-sm">3. Defensive Scam Intelligence Disclaimer</h4>
                <p>
                  Spam risk indicators, caller purpose tags, and suspicious call warnings are calculated using heuristic models
                  and public directories. While CallShield strives for utmost accuracy, automated classifications should not be
                  treated as conclusive legal determinations of fraud.
                </p>

                <h4 className="font-bold text-white text-sm">4. Modifications & Updates</h4>
                <p>
                  We reserve the right to improve detection algorithms and update these terms as telephony standards evolve.
                </p>
              </div>
            </>
          )}

          <div className="pt-2 text-center text-[10px] text-slate-500">
            Last updated: September 2026 • CallShield Production Telephony
          </div>
        </div>
      </section>
    </div>
  );
}
