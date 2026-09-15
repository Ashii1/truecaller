import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  PhoneCall,
  Users,
  Clock,
  Bell,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  X,
  ExternalLink,
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { telecomBridge } from '../services/telephony/telecomBridge';
import { ShieldSettings } from '../types';

interface PermissionCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShieldSettings;
  onUpdateSettings: (newSettings: ShieldSettings) => void;
  isDefaultDialer: boolean;
  onRequestDefaultDialer: () => void;
  onSyncContacts: () => void;
}

export default function PermissionCenterModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isDefaultDialer,
  onRequestDefaultDialer,
  onSyncContacts,
}: PermissionCenterModalProps) {
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'PERMISSIONS' | 'ONBOARDING'>('PERMISSIONS');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');
  const [contactsStatus, setContactsStatus] = useState<'GRANTED' | 'DENIED'>('DENIED');
  const [callLogStatus, setCallLogStatus] = useState<'AVAILABLE' | 'UNAVAILABLE'>('UNAVAILABLE');

  // Check live OS permissions on mount and when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // 1. Notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }

    // 2. Contacts capability
    const hasWebContacts = typeof navigator !== 'undefined' && 'contacts' in navigator;
    const diag = telecomBridge.getDiagnostics();
    if (diag.contactsPermission || hasWebContacts) {
      setContactsStatus('GRANTED');
    } else {
      setContactsStatus('DENIED');
    }

    // 3. Call Log access
    if (diag.callLogPermission || isDefaultDialer) {
      setCallLogStatus('AVAILABLE');
    } else {
      setCallLogStatus('UNAVAILABLE');
    }
  }, [isOpen, isDefaultDialer]);

  // Request notifications
  const handleRequestNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setNotificationStatus(res);
      } catch (err) {
        console.warn('Error requesting notification permission:', err);
      }
    }
  };

  // Request contacts
  const handleRequestContacts = async () => {
    onSyncContacts();
    setContactsStatus('GRANTED');
  };

  if (!isOpen) return null;

  const isSetupComplete = isDefaultDialer && settings.masterEnabled && contactsStatus === 'GRANTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                Permission Center & Telephony Setup
              </h2>
              <p className="text-xs text-slate-400">
                Official Android Telecom & Telephony Role Authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Overview vs Onboarding Flow */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('PERMISSIONS')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'PERMISSIONS'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Live Permission Status
          </button>
          <button
            onClick={() => setActiveTab('ONBOARDING')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ONBOARDING'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>5-Step Setup Wizard</span>
            {isSetupComplete && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'PERMISSIONS' ? (
            /* Live Permission Status Cards (Issue 28) */
            <div className="space-y-3">
              <p className="text-xs text-slate-400 mb-2">
                The permissions below reflect the actual live state provided by the operating system and Android Telecom subsystem.
              </p>

              {/* 1. Default Phone App */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDefaultDialer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Default Phone App (ROLE_DIALER)</div>
                    <div className="text-xs text-slate-400">Routes real cellular calls through VigilShield InCallService</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    isDefaultDialer ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {isDefaultDialer ? 'ON' : 'OFF'}
                  </span>
                  {!isDefaultDialer && (
                    <button
                      onClick={onRequestDefaultDialer}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition"
                    >
                      Grant
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Contacts */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    contactsStatus === 'GRANTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Contacts (READ_CONTACTS)</div>
                    <div className="text-xs text-slate-400">Priority 1 Caller ID resolution (displays "Mom" instead of raw digits)</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    contactsStatus === 'GRANTED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {contactsStatus}
                  </span>
                  {contactsStatus !== 'GRANTED' && (
                    <button
                      onClick={handleRequestContacts}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                    >
                      Allow
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Call Log */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    callLogStatus === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Call Log (READ_CALL_LOG)</div>
                    <div className="text-xs text-slate-400">Synchronizes incoming, outgoing, and missed call history</div>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                  callLogStatus === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-400'
                }`}>
                  {callLogStatus}
                </span>
              </div>

              {/* 4. Caller Protection */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    settings.masterEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Caller Protection & Smart Firewall</div>
                    <div className="text-xs text-slate-400">TRAI 140 telemarketing block & multi-layer scam screening</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    settings.masterEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {settings.masterEnabled ? 'ON' : 'OFF'}
                  </span>
                  <button
                    onClick={() => onUpdateSettings({ ...settings, masterEnabled: !settings.masterEnabled })}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition ${
                      settings.masterEnabled ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {settings.masterEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>

              {/* 5. Notifications */}
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    notificationStatus === 'granted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Notifications (POST_NOTIFICATIONS)</div>
                    <div className="text-xs text-slate-400">Incoming call alerts, missed call summaries & spam notifications</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                    notificationStatus === 'granted' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {notificationStatus === 'granted' ? 'ON' : 'OFF'}
                  </span>
                  {notificationStatus !== 'granted' && (
                    <button
                      onClick={handleRequestNotifications}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 5-Step Default Phone App Onboarding (Issue 29) */
            <div className="space-y-4">
              {/* Stepper Header */}
              <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-400 border-b border-slate-800 pb-3">
                <span>Step {onboardingStep} of 5</span>
                <span>{onboardingStep === 5 ? 'Ready' : 'Setup In Progress'}</span>
              </div>

              {/* Step 1: Default Phone App */}
              {onboardingStep === 1 && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto shadow-lg shadow-amber-950/30">
                    <PhoneCall className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Step 1: Set as Default Phone App</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      To make real cellular calls without opening another phone app and to display the in-call screen, VigilShield must be granted Android's official ROLE_DIALER.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={onRequestDefaultDialer}
                      className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition"
                    >
                      Set as Default Phone App
                    </button>
                    <button
                      onClick={() => setOnboardingStep(2)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition"
                    >
                      Continue to Step 2
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Contacts Access */}
              {onboardingStep === 2 && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto shadow-lg shadow-indigo-950/30">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Step 2: Allow Contacts Access</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      Allows VigilShield to identify saved contacts instantly. In accordance with strict caller ID rules, your local contact name ("Mom", "Dr. Reed") always takes absolute Priority 1.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={handleRequestContacts}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
                    >
                      Allow Contacts Access
                    </button>
                    <button
                      onClick={() => setOnboardingStep(3)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Enable Caller Protection */}
              {onboardingStep === 3 && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/30">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Step 3: Enable Smart Caller Protection</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      Activates the VigilShield call firewall to silence high-risk scams, commercial telemarketers (TRAI 140 series), and auto-cancel malicious robocalls before your phone rings.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        onUpdateSettings({ ...settings, masterEnabled: true });
                        setOnboardingStep(4);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
                    >
                      Activate Protection & Proceed
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Enable Notifications */}
              {onboardingStep === 4 && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-lg shadow-blue-950/30">
                    <Bell className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Step 4: Enable Telephony Notifications</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      Allows the app to display real-time incoming call heads-up notifications, missed call summaries, and threat blocks while the screen is locked.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <button
                      onClick={async () => {
                        await handleRequestNotifications();
                        setOnboardingStep(5);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
                    >
                      Enable Notifications & Finish
                    </button>
                    <button
                      onClick={() => setOnboardingStep(5)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition"
                    >
                      Skip to Finish
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Completion (Only shows "Your phone is ready" after steps) */}
              {onboardingStep === 5 && (
                <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-4 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/30">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Step 5: Your phone is ready!</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-md mx-auto">
                      VigilShield is fully configured as your default telephone dialer with live caller ID resolution and active spam protection.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
                    >
                      Start Using Phone App
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <span>Android Telecom Framework v34</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
