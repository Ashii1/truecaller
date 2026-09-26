import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Download, 
  Smartphone, 
  ExternalLink, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  ShieldCheck,
  Package
} from 'lucide-react';
import QRCode from 'qrcode';

interface InstallApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerInstall: () => void;
}

export default function InstallApkModal({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}: InstallApkModalProps) {
  const [activeTab, setActiveTab] = useState<'INSTALL' | 'PWABUILDER' | 'QR' | 'CLI' | 'UPDATES'>('INSTALL');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(currentUrl)}`;

  useEffect(() => {
    if (isOpen && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const bubblewrapCode = `# 1. Install Google's official Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Generate Android Studio APK project from this app
bubblewrap init --manifest="${currentUrl}/manifest.webmanifest"

# 3. Build signed or debug APK
bubblewrap build`;

  const capacitorCode = `# 1. Install Capacitor Android
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor project
npx cap init SpamShield com.spamshield.app --web-dir dist

# 3. Add Android platform & build APK
npm run build
npx cap add android
npx cap open android # Opens Android Studio to click "Build APK"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Get Android APK & Install
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Android Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Install directly as an Android WebAPK or generate a standalone .apk package
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition active:scale-95"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold">Back</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
          {[
            { id: 'INSTALL', label: '1. Direct Install (WebAPK)', icon: Smartphone },
            { id: 'PWABUILDER', label: '2. 1-Click APK Builder', icon: Download },
            { id: 'QR', label: '3. Scan with Phone', icon: QrCode },
            { id: 'CLI', label: '4. CLI / Android Studio', icon: Terminal },
            { id: 'UPDATES', label: '5. In-Place Updates & Signing', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-2 shrink-0 ${
                  active
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Direct Android Install (WebAPK) */}
          {activeTab === 'INSTALL' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Official Android WebAPK Technology
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    When you install SpamShield on Android (via Chrome, Edge, or Samsung Internet), Android automatically compiles and signs a real <strong>native WebAPK</strong> in the background. It installs into your Android system with its own launcher icon, splash screen, and full-screen window without browser address bars!
                  </p>
                </div>
              </div>

              {/* Install Button or Instructions */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-white">Instant Device Installation</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {deferredPrompt 
                        ? 'Your browser is ready to install the APK immediately.' 
                        : 'Open this page on your Android device to install with one click.'}
                    </p>
                  </div>

                  <button
                    onClick={onTriggerInstall}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App on Android</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  <h6 className="text-xs font-bold text-slate-300">How to install manually on Android:</h6>
                  <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Open this URL on your Android phone in <span className="text-white font-medium">Chrome</span> or <span className="text-white font-medium">Brave</span>.</li>
                    <li>Tap the <span className="text-indigo-400 font-bold">⋮ (Three dots menu)</span> at the top right of the browser.</li>
                    <li>Tap <span className="text-indigo-400 font-bold">"Install app"</span> or <span className="text-indigo-400 font-bold">"Add to Home screen"</span>.</li>
                    <li>Android will automatically generate and install the WebAPK on your phone!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 1-Click APK Builder (PWABuilder) */}
          {activeTab === 'PWABUILDER' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Free 1-Click Android .APK / .AAB Generator
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    You can download a raw standalone <strong>.apk</strong> file or a Google Play Store <strong>.aab</strong> package using <strong>PWABuilder</strong> (an open-source project by Microsoft and Google). It analyzes SpamShield's manifest and compiles an installable APK for you in under 1 minute.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-bold text-white">PWABuilder Cloud Packaging</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Your app's manifest and icons are 100% compliant and ready.
                    </p>
                  </div>

                  <a
                    href={pwaBuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/30"
                  >
                    <span>Generate APK on PWABuilder</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
                  <div className="font-bold text-slate-300">Quick 3-step process on PWABuilder:</div>
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                    <span>Click the button above to open PWABuilder with SpamShield pre-loaded.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                    <span>Click <strong className="text-emerald-400">"Package for Stores"</strong> &gt; <strong className="text-emerald-400">"Android"</strong>.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                    <span>Download your signed <code className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">.apk</code> file to install directly onto any Android phone!</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Scan with Phone QR Code */}
          {activeTab === 'QR' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-slate-950/70 border border-slate-800">
                {/* QR Code */}
                <div className="bg-white p-3 rounded-2xl shrink-0 shadow-lg">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Scan to install on Android" className="w-48 h-48 block" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-xl" />
                  )}
                </div>

                {/* Instructions */}
                <div className="space-y-3 flex-1 text-center sm:text-left">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Point Phone Camera Here</span>
                  </div>
                  <h4 className="text-base font-bold text-white">
                    Install Directly onto Your Android Phone
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Scan this QR code with your phone camera or Google Lens to open SpamShield on your device. Once opened, tap <strong>"Install"</strong> in the browser prompt to install the native WebAPK!
                  </p>
                  <div className="pt-2">
                    <div className="text-[11px] text-slate-500 font-mono break-all bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      {currentUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLI / Android Studio Packaging */}
          {activeTab === 'CLI' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">Option A: Build APK with Google Bubblewrap CLI</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(bubblewrapCode, 'bubblewrap')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center space-x-1"
                  >
                    {copiedCode === 'bubblewrap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === 'bubblewrap' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {bubblewrapCode}
                </pre>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Option B: Build APK with Capacitor in Android Studio</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(capacitorCode, 'cap')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center space-x-1"
                  >
                    {copiedCode === 'cap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === 'cap' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-slate-800">
                  {capacitorCode}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: In-Place Updates & Signing */}
          {activeTab === 'UPDATES' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Seamless In-Place APK Updates (Works on Build 402 & Newer)
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Android package manager allows updating directly over your installed app (preserving call logs, contacts, recordings, and custom blocklists) without uninstalling:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">1</span>
                    <span>Exact Matching Certificate</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Previously, CI generated a randomized ephemeral signing key per run, which triggered <code className="text-amber-400 font-mono">INSTALL_FAILED_UPDATE_INCOMPATIBLE</code>.
                  </p>
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/20 font-medium">
                    ✓ Fixed: Both CI and Gradle now sign using the persistent <code className="font-mono">release-keystore.jks</code> matching Build 402.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">2</span>
                    <span>Higher versionCode (403+)</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Android rejects installing an APK if its <code className="text-amber-400 font-mono">versionCode</code> is equal to or lower than the installed version.
                  </p>
                  <div className="text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/20 font-medium">
                    ✓ Fixed: VersionCode is now bumped to <code className="font-mono">403+</code> (above Build 402) so Android treats it as an in-place upgrade!
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <h5 className="text-xs font-bold text-slate-200">How to update your current 402 build:</h5>
                <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li><strong>Keep your existing app installed:</strong> Do not uninstall Build 402. All your contacts and call recordings will be preserved.</li>
                  <li><strong>Install the new update APK:</strong> Tap the new APK build (v1.5.3, versionCode 403+).</li>
                  <li><strong>Android Package Installer prompt:</strong> Android will recognize it as an update and display <em>"Do you want to update this app? Your existing data won't be lost."</em> Tap <strong>Update</strong> to complete!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>CallShield Native Android & PWA v1.5.3 (Build 403+)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
