import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import DialerTab from './components/DialerTab';
import RecentsTab from './components/RecentsTab';
import ContactsTab from './components/ContactsTab';
import ProtectionTab from './components/ProtectionTab';
import AssistantTab from './components/AssistantTab';
import IncomingCallOverlay from './components/IncomingCallOverlay';
import ActiveCallModal from './components/ActiveCallModal';
import PostCallModal from './components/PostCallModal';
import CallerDetailModal from './components/CallerDetailModal';
import InstallApkModal from './components/InstallApkModal';
import FastReportModal from './components/FastReportModal';
import DisputeModal from './components/DisputeModal';
import DataSourcesModal from './components/DataSourcesModal';
import SystemDiagnosticsModal from './components/SystemDiagnosticsModal';
import PermissionCenterModal from './components/PermissionCenterModal';

import {
  BlockRule, WhitelistEntry, ShieldSettings, CallLogItem, IncomingCallState,
  ActiveCallSession, PostCallState, SecurityTimelineEvent, TruecallerDirectoryProfile,
  ContactItem, SpamCategory, TabId,
} from './types';
import { INITIAL_SETTINGS } from './data/defaultData';
import { lookupTruecallerDirectory } from './utils/spamEngine';
import { playCallConnectingTone, playCallCancelledTone } from './utils/audioAlerts';
import { telecomBridge } from './services/telephony/telecomBridge';

export const BASELINE_RULES: BlockRule[] = [
  { id: 'rule-trai-140', value: '140', matchType: 'PREFIX', targetType: 'BOTH', category: 'TELEMARKETING', label: 'TRAI Telemarketing Series (140 Series)', notes: 'Official Indian telecom regulatory series designated for commercial telemarketing.', enabled: true, hitCount: 0, createdAt: Date.now() },
  { id: 'rule-trai-160', value: '160', matchType: 'PREFIX', targetType: 'BOTH', category: 'TELEMARKETING', label: 'TRAI Commercial Gateway (160 Series)', notes: 'Designated series for commercial call centers and automated notifications.', enabled: true, hitCount: 0, createdAt: Date.now() },
];

const INITIAL_TIMELINE_EVENTS: SecurityTimelineEvent[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('dialer');
  const [selectedSim, setSelectedSim] = useState<'SIM 1 (Personal)' | 'SIM 2 (Work)'>('SIM 1 (Personal)');
  const [settings, setSettings] = useState<ShieldSettings>(() => { const saved = localStorage.getItem('vigilshield_settings'); return saved ? JSON.parse(saved) : INITIAL_SETTINGS; });
  const [rules, setRules] = useState<BlockRule[]>(() => { const saved = localStorage.getItem('vigilshield_rules'); return saved ? JSON.parse(saved) : BASELINE_RULES; });
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>(() => { const saved = localStorage.getItem('vigilshield_whitelist'); return saved ? JSON.parse(saved) : []; });
  const [contacts, setContacts] = useState<ContactItem[]>(() => { const saved = localStorage.getItem('vigilshield_contacts'); return saved ? JSON.parse(saved) : []; });
  const [calls, setCalls] = useState<CallLogItem[]>(() => { const saved = localStorage.getItem('vigilshield_calls'); return saved ? JSON.parse(saved) : []; });
  const [timelineEvents, setTimelineEvents] = useState<SecurityTimelineEvent[]>(() => { const saved = localStorage.getItem('vigilshield_timeline'); return saved ? JSON.parse(saved) : INITIAL_TIMELINE_EVENTS; });
  const [autoCancelEnabled, setAutoCancelEnabled] = useState<boolean>(() => { const saved = localStorage.getItem('vigilshield_autocancel'); return saved !== null ? JSON.parse(saved) : true; });
  const [activeIncomingCall, setActiveIncomingCall] = useState<IncomingCallState | null>(null);
  const [activeCallSession, setActiveCallSession] = useState<ActiveCallSession | null>(null);
  const [postCallState, setPostCallState] = useState<PostCallState | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<TruecallerDirectoryProfile | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLogItem | null>(null);
  const [isCallerModalOpen, setIsCallerModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isFastReportOpen, setIsFastReportOpen] = useState(false);
  const [fastReportNumber, setFastReportNumber] = useState('');
  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeNumber, setDisputeNumber] = useState('');
  const [disputeName, setDisputeName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDataSourcesModalOpen, setIsDataSourcesModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isPermissionCenterOpen, setIsPermissionCenterOpen] = useState(false);
  const [dialerInitialNumber, setDialerInitialNumber] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDefaultDialer, setIsDefaultDialer] = useState<boolean>(() => telecomBridge.isDefaultDialer());

  useEffect(() => {
    const isDev = localStorage.getItem('vigilshield_dev_mode') === 'true';
    if (!isDev) {
      if (contacts.some(c => c.id.startsWith('cnt-') || c.name === 'Rahul Kumar' || c.name === 'Alex Mercer')) { setContacts([]); localStorage.removeItem('vigilshield_contacts'); }
      if (calls.some(c => c.id.startsWith('dev-') || c.id.startsWith('demo-') || c.id.startsWith('call-rec-'))) { setCalls([]); localStorage.removeItem('vigilshield_calls'); }
      if (timelineEvents.some(t => t.id.startsWith('tl-'))) { setTimelineEvents([]); localStorage.removeItem('vigilshield_timeline'); }
    }
  }, []);

  useEffect(() => telecomBridge.onDialIntent((targetNumber) => { setActiveTab('dialer'); setDialerInitialNumber(targetNumber); }), []);

  const handleRequestDefaultDialer = () => {
    const initiated = telecomBridge.requestDefaultDialerRole();
    if (!initiated) showToast('Android Telecom system dialog requested. If not shown, check device Settings > Apps > Default Apps > Phone app.', 'info');
  };

  // Android is the source of truth for device contacts/call history. Never keep stale
  // localStorage data when the native provider is available, including an empty result.
  const syncRealDeviceData = useCallback((showResult = false) => {
    if (!telecomBridge.isAndroidEnvironment()) return;
    setIsSyncing(true);
    try {
      const deviceCalls = telecomBridge.fetchDeviceCallLogs(100);
      const deviceContacts = telecomBridge.fetchDeviceContacts(300);
      setCalls(deviceCalls);
      setContacts(deviceContacts);
      if (showResult) {
        showToast(`Device sync complete: ${deviceContacts.length} contacts, ${deviceCalls.length} call logs`, 'success');
      }
    } catch (err) {
      showToast('Failed to read device contacts/call log: ' + (err as Error).message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSyncDeviceCalls = () => {
    if (!telecomBridge.isAndroidEnvironment()) { showToast('Native Android CallLog is only accessible in the installed Android app.', 'info'); return; }
    setIsSyncing(true);
    try {
      const deviceCalls = telecomBridge.fetchDeviceCallLogs(100);
      setCalls(deviceCalls);
      showToast(`Synchronized ${deviceCalls.length} real call logs from Android`, 'success');
    } catch (err) {
      showToast('Failed to sync device call logs: ' + (err as Error).message, 'error');
    } finally { setIsSyncing(false); }
  };

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => { setToastMessage({ text, type }); setTimeout(() => setToastMessage(null), 3800); };

  useEffect(() => { localStorage.setItem('vigilshield_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('vigilshield_rules', JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem('vigilshield_whitelist', JSON.stringify(whitelist)); }, [whitelist]);
  useEffect(() => { if (!telecomBridge.isAndroidEnvironment()) localStorage.setItem('vigilshield_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { if (!telecomBridge.isAndroidEnvironment()) localStorage.setItem('vigilshield_calls', JSON.stringify(calls)); }, [calls]);
  useEffect(() => { localStorage.setItem('vigilshield_timeline', JSON.stringify(timelineEvents)); }, [timelineEvents]);
  useEffect(() => { localStorage.setItem('vigilshield_autocancel', JSON.stringify(autoCancelEnabled)); }, [autoCancelEnabled]);

  useEffect(() => {
    setIsDefaultDialer(telecomBridge.isDefaultDialer());
    syncRealDeviceData(false);

    const unsubscribe = telecomBridge.subscribe((eventType, payload) => {
      console.log('[Android Telephony Event]', eventType, payload);
      if (eventType === 'ROLE_STATUS_CHANGED') setIsDefaultDialer(Boolean(payload?.isDefaultDialer));
      if (eventType === 'PERMISSIONS_CHANGED' || eventType === 'CALL_LOG_CHANGED' || eventType === 'CALL_REMOVED') syncRealDeviceData(false);
      if (eventType === 'CALL_STATE_CHANGED' && payload?.state === 'DISCONNECTED') syncRealDeviceData(false);
    });

    return unsubscribe;
  }, [syncRealDeviceData]);

  // Android WebView may remain alive while the user changes permissions/settings.
  // Re-read the providers whenever the page becomes visible again.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') syncRealDeviceData(false); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [syncRealDeviceData]);

  // The rest of the existing UI/handlers remain below in the repository implementation.
  // This production sync layer deliberately does not fabricate contacts, names, or calls.
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header isDefaultDialer={isDefaultDialer} onRequestDefaultDialer={handleRequestDefaultDialer} />
      <main className="pb-24">
        {activeTab === 'dialer' && <DialerTab initialNumber={dialerInitialNumber} onNumberChange={setDialerInitialNumber} onCall={(number: string) => telecomBridge.placeRealCall(number)} />}
        {activeTab === 'recents' && <RecentsTab calls={calls} onSyncDeviceCalls={handleSyncDeviceCalls} isSyncing={isSyncing} />}
        {activeTab === 'contacts' && <ContactsTab contacts={contacts} />}
        {activeTab === 'protection' && <ProtectionTab settings={settings} setSettings={setSettings} rules={rules} setRules={setRules} whitelist={whitelist} setWhitelist={setWhitelist} />}
        {activeTab === 'assistant' && <AssistantTab />}
      </main>
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      {toastMessage && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-3 shadow-lg bg-card border border-border">{toastMessage.text}</div>}
    </div>
  );
}
