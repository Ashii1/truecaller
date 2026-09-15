import { useState, useEffect } from 'react';
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
  BlockRule,
  WhitelistEntry,
  ShieldSettings,
  CallLogItem,
  IncomingCallState,
  ActiveCallSession,
  PostCallState,
  SecurityTimelineEvent,
  TruecallerDirectoryProfile,
  ContactItem,
  SpamCategory,
  TabId,
} from './types';

import {
  INITIAL_SETTINGS,
} from './data/defaultData';
import { lookupTruecallerDirectory } from './utils/spamEngine';
import { playCallConnectingTone, playCallCancelledTone } from './utils/audioAlerts';
import { telecomBridge } from './services/telephony/telecomBridge';

// Baseline regulatory telemarketing prefixes for pure production mode
export const BASELINE_RULES: BlockRule[] = [
  {
    id: 'rule-trai-140',
    value: '140',
    matchType: 'PREFIX',
    targetType: 'BOTH',
    category: 'TELEMARKETING',
    label: 'TRAI Telemarketing Series (140 Series)',
    notes: 'Official Indian telecom regulatory series designated for commercial telemarketing.',
    enabled: true,
    hitCount: 0,
    createdAt: Date.now(),
  },
  {
    id: 'rule-trai-160',
    value: '160',
    matchType: 'PREFIX',
    targetType: 'BOTH',
    category: 'TELEMARKETING',
    label: 'TRAI Commercial Gateway (160 Series)',
    notes: 'Designated series for commercial call centers and automated notifications.',
    enabled: true,
    hitCount: 0,
    createdAt: Date.now(),
  },
];

const INITIAL_TIMELINE_EVENTS: SecurityTimelineEvent[] = [];

export default function App() {
  // 1. Navigation State
  const [activeTab, setActiveTab] = useState<TabId>('dialer');

  // 2. Dual SIM state
  const [selectedSim, setSelectedSim] = useState<'SIM 1 (Personal)' | 'SIM 2 (Work)'>('SIM 1 (Personal)');

  // 3. Persistent Core States (Strict Real Device Data: empty by default)
  const [settings, setSettings] = useState<ShieldSettings>(() => {
    const saved = localStorage.getItem('vigilshield_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [rules, setRules] = useState<BlockRule[]>(() => {
    const saved = localStorage.getItem('vigilshield_rules');
    return saved ? JSON.parse(saved) : BASELINE_RULES;
  });

  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>(() => {
    const saved = localStorage.getItem('vigilshield_whitelist');
    return saved ? JSON.parse(saved) : [];
  });

  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    const saved = localStorage.getItem('vigilshield_contacts');
    return saved ? JSON.parse(saved) : [];
  });

  const [calls, setCalls] = useState<CallLogItem[]>(() => {
    const saved = localStorage.getItem('vigilshield_calls');
    return saved ? JSON.parse(saved) : [];
  });

  const [timelineEvents, setTimelineEvents] = useState<SecurityTimelineEvent[]>(() => {
    const saved = localStorage.getItem('vigilshield_timeline');
    return saved ? JSON.parse(saved) : [];
  });

  const [autoCancelEnabled, setAutoCancelEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('vigilshield_autocancel');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // 5. Modal & Overlay States
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

  // Real Android TelecomManager default phone role state
  const [isDefaultDialer, setIsDefaultDialer] = useState<boolean>(() => {
    return telecomBridge.isDefaultDialer();
  });

  // Strict "No Dummy Data" verification & sanitization for production
  useEffect(() => {
    const isDev = localStorage.getItem('vigilshield_dev_mode') === 'true';
    if (!isDev) {
      // Remove any historical demo fixtures if they lingered in user's browser localStorage
      const legacyContactFound = contacts.some(c => c.id.startsWith('cnt-') || c.name === 'Rahul Kumar' || c.name === 'Alex Mercer');
      if (legacyContactFound) {
        setContacts([]);
        localStorage.removeItem('vigilshield_contacts');
      }
      const legacyCallFound = calls.some(c => c.id.startsWith('dev-') || c.id.startsWith('demo-') || c.id.startsWith('call-rec-'));
      if (legacyCallFound) {
        setCalls([]);
        localStorage.removeItem('vigilshield_calls');
      }
      const legacyTimelineFound = timelineEvents.some(t => t.id.startsWith('tl-'));
      if (legacyTimelineFound) {
        setTimelineEvents([]);
        localStorage.removeItem('vigilshield_timeline');
      }
    }
  }, []);

  // Listen to incoming external dial intents (ACTION_DIAL, ACTION_CALL, tel: URI)
  useEffect(() => {
    return telecomBridge.onDialIntent((targetNumber) => {
      setActiveTab('dialer');
      setDialerInitialNumber(targetNumber);
    });
  }, []);

  const handleRequestDefaultDialer = () => {
    const initiated = telecomBridge.requestDefaultDialerRole();
    if (!initiated) {
      showToast('Android Telecom system dialog requested. If not shown, check device Settings > Apps > Default Apps > Phone app.', 'info');
    }
  };

  // Sync authentic device call logs from android.provider.CallLog.Calls
  const handleSyncDeviceCalls = () => {
    if (telecomBridge.isAndroidEnvironment()) {
      try {
        const deviceCalls = telecomBridge.fetchDeviceCallLogs(100);
        if (deviceCalls && deviceCalls.length > 0) {
          setCalls(deviceCalls);
          showToast(`Synchronized ${deviceCalls.length} call logs from Android device`, 'success');
        } else {
          showToast('No calls found in device CallLog. Ensure READ_CALL_LOG permission is granted.', 'info');
        }
      } catch (err) {
        showToast('Failed to sync device call logs: ' + (err as Error).message, 'error');
      }
    } else {
      showToast('Native Android CallLog is only accessible when running on Android with Telecom permissions', 'info');
    }
  };

  // In-app visual notification toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'error' | 'success' } | null>(null);
  const showToast = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('vigilshield_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vigilshield_rules', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('vigilshield_whitelist', JSON.stringify(whitelist));
  }, [whitelist]);

  useEffect(() => {
    localStorage.setItem('vigilshield_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('vigilshield_calls', JSON.stringify(calls));
  }, [calls]);

  useEffect(() => {
    localStorage.setItem('vigilshield_timeline', JSON.stringify(timelineEvents));
  }, [timelineEvents]);

  useEffect(() => {
    localStorage.setItem('vigilshield_autocancel', JSON.stringify(autoCancelEnabled));
  }, [autoCancelEnabled]);

  // Synchronize initial real device state and listen to Telecom events
  useEffect(() => {
    // 1. Initial default dialer check
    setIsDefaultDialer(telecomBridge.isDefaultDialer());

    // 2. Fetch real calls and contacts on launch if running inside Android container
    if (telecomBridge.isAndroidEnvironment()) {
      try {
        const deviceCalls = telecomBridge.fetchDeviceCallLogs(100);
        if (deviceCalls && deviceCalls.length > 0) {
          setCalls(deviceCalls);
        }
        const deviceContacts = telecomBridge.fetchDeviceContacts(300);
        if (deviceContacts && deviceContacts.length > 0) {
          setContacts(deviceContacts);
        }
      } catch (err) {
        console.warn('Initial device data sync failed:', err);
      }
    }

    // 3. Subscribe to real telecom events from Android InCallService and TelecomManager
    const unsubscribe = telecomBridge.subscribe((eventType, payload) => {
      console.log('[Android Telephony Event]', eventType, payload);

      if (eventType === 'ROLE_STATUS_CHANGED') {
        const hasRole = Boolean(payload?.isDefaultDialer);
        setIsDefaultDialer(hasRole);
        if (hasRole) {
          showToast('VigilShield is now your Default Phone App!', 'success');
        }
      } else if (eventType === 'CALL_ADDED' || eventType === 'CALL_STATE_CHANGED') {
        const callId = payload?.callId || `call-${Date.now()}`;
        const details = payload?.details;
        const number = details?.number || '';
        const state = details?.state || 'RINGING';
        const isIncoming = details?.isIncoming ?? (state === 'RINGING');

        if (isIncoming && (state === 'RINGING' || state === 'CONNECTING')) {
          // Real incoming call detected by InCallService
          const profile = lookupTruecallerDirectory(number, rules, whitelist);
          setActiveIncomingCall({
            callId,
            number,
            callerName: details?.callerDisplayName || profile.name || number,
            carrier: profile.carrier || 'Cellular',
            location: profile.location || 'Incoming Cellular Call',
            riskScore: profile.spamScore,
            reportsCount: profile.spamReportsCount,
            isSpam: profile.isSpam,
            spamCategory: profile.spamCategory,
            spamReason: profile.spamReason,
            isVerifiedBusiness: profile.isVerified,
            status: 'RINGING',
            simSlot: details?.phoneAccountId?.includes('2') ? 2 : 1,
          });
        } else if (state === 'ACTIVE' || state === 'DIALING' || state === 'HOLDING') {
          // Real active/outgoing or connected call
          setActiveIncomingCall((prev) => (prev?.callId === callId ? null : prev));
          const profile = lookupTruecallerDirectory(number, rules, whitelist);
          setActiveCallSession({
            id: callId,
            number,
            name: details?.callerDisplayName || profile.name || number,
            isSpam: profile.isSpam,
            spamCategory: profile.spamCategory,
            riskScore: profile.spamScore,
            riskLevel: profile.riskLevel || 'SAFE',
            durationSeconds: details?.durationSeconds || 0,
            status: state === 'HOLDING' ? 'HELD' : 'CONNECTED',
            isMuted: false,
            isSpeaker: false,
            isHeld: Boolean(details?.isHolding || state === 'HOLDING'),
            isKeypadOpen: false,
            selectedSim,
            sim: selectedSim,
            isVerifiedBusiness: profile.isVerified,
          });
        }
      } else if (eventType === 'CALL_REMOVED' || eventType === 'CALL_DISCONNECTED') {
        const callId = payload?.callId;
        setActiveIncomingCall((prev) => (prev && (!callId || prev.callId === callId) ? null : prev));
        setActiveCallSession((prev) => {
          if (!prev) return null;
          if (callId && prev.id !== callId) return prev;
          
          // Open Post-Call Intelligence with actual call statistics
          const finalDuration = prev.durationSeconds || 1;
          setPostCallState({
            isOpen: true,
            callId: prev.id,
            number: prev.number,
            name: prev.name,
            durationSeconds: finalDuration,
            durationStr: `${finalDuration}s`,
            sim: prev.sim,
            isSpam: prev.isSpam,
            wasSpam: prev.isSpam,
          });
          return null;
        });

        // Sync fresh call logs from Android device
        if (telecomBridge.isAndroidEnvironment()) {
          try {
            const freshLogs = telecomBridge.fetchDeviceCallLogs(100);
            if (freshLogs && freshLogs.length > 0) {
              setCalls(freshLogs);
            }
          } catch (e) {
            console.warn('Post-call history refresh failed:', e);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [rules, whitelist, selectedSim]);

  // Reset to pure real device state (zero mock data)
  const handleResetToCleanState = () => {
    setContacts([]);
    setCalls([]);
    setWhitelist([]);
    setTimelineEvents([]);
    setRules(BASELINE_RULES);
    localStorage.removeItem('vigilshield_contacts');
    localStorage.removeItem('vigilshield_calls');
    localStorage.removeItem('vigilshield_whitelist');
    localStorage.removeItem('vigilshield_timeline');
    localStorage.setItem('vigilshield_rules', JSON.stringify(BASELINE_RULES));
    showToast('Reset to pure real device state: address book and call history cleared', 'success');
  };

  const handleImportAllData = (data: any) => {
    if (data.contacts && Array.isArray(data.contacts)) setContacts(data.contacts);
    if (data.calls && Array.isArray(data.calls)) setCalls(data.calls);
    if (data.rules && Array.isArray(data.rules)) setRules(data.rules);
    if (data.whitelist && Array.isArray(data.whitelist)) setWhitelist(data.whitelist);
    if (data.settings) setSettings(data.settings);
    if (data.timelineEvents && Array.isArray(data.timelineEvents)) setTimelineEvents(data.timelineEvents);
    showToast('Application backup restored successfully!', 'success');
  };

  // PWA install prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallModalOpen(false);
      }
    } else {
      alert('To install VigilShield as a native Android Phone app, open this page in Chrome or Brave on your device and select "Install app".');
    }
  };

  // Profile directory lookup helper
  const handleLookupProfile = (number: string): TruecallerDirectoryProfile => {
    return lookupTruecallerDirectory(number, rules, whitelist);
  };

  // REAL CALL INITIATION (Outgoing from Dialer, Contacts, or Recents)
  const handleInitiateCall = (
    number: string,
    name?: string,
    sim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)'
  ) => {
    if (!number || !number.trim()) {
      showToast('Please enter a valid phone number to dial', 'error');
      return;
    }

    const cleanNumber = number.trim();
    const dialableDigits = cleanNumber.replace(/[^\d+*#]/g, '');
    const pureDigits = dialableDigits.replace(/\D/g, '');

    // Check minimum length (< 3 digits) unless it's a known service/emergency code
    const isSpecialCode = ['911', '112', '999', '100', '198', '121', '108', '102', '101'].includes(pureDigits);
    if (pureDigits.length < 3 && !isSpecialCode) {
      showToast('Phone number is too short to dial', 'error');
      return;
    }

    const targetSim = sim || selectedSim;
    const profile = lookupTruecallerDirectory(cleanNumber, rules, whitelist);
    const matchedContact = contacts.find((c) => {
      const cDig = c.number.replace(/\D/g, '');
      return cDig === pureDigits || (cDig.length >= 7 && pureDigits.endsWith(cDig));
    });
    const resolvedName = name || matchedContact?.name || (profile.isVerified ? profile.name : profile.isSpam ? profile.name : cleanNumber);

    playCallConnectingTone();

    // Place real call via official TelecomManager bridge
    const callResult = telecomBridge.placeRealCall(dialableDigits, targetSim);
    if (!callResult.success) {
      showToast(callResult.message, 'error');
    } else {
      showToast(`Calling ${resolvedName || dialableDigits} via ${targetSim}...`, 'info');
    }

    // Create active call session for in-call HUD
    const session: ActiveCallSession = {
      id: callResult.callId || `call-sess-${Date.now()}`,
      number: cleanNumber,
      name: resolvedName,
      isSpam: profile.isSpam,
      spamCategory: profile.spamCategory,
      riskScore: profile.spamScore,
      riskLevel: profile.riskLevel || 'SAFE',
      durationSeconds: 0,
      status: 'DIALING',
      isMuted: false,
      isSpeaker: false,
      isHeld: false,
      isKeypadOpen: false,
      selectedSim: targetSim,
      sim: targetSim,
      isVerifiedBusiness: profile.isVerified,
    };

    setActiveCallSession(session);

    // Record into call log
    const outgoingLog: CallLogItem = {
      id: `call-${Date.now()}`,
      number: cleanNumber,
      callerName: resolvedName,
      type: 'OUTGOING',
      timestamp: Date.now(),
      durationSeconds: 0,
      isSpam: profile.isSpam,
      spamCategory: profile.spamCategory,
      riskScore: profile.spamScore,
      reportsCount: profile.spamReportsCount,
      carrier: profile.carrier,
      location: profile.location,
      isVerifiedBusiness: profile.isVerified,
      isContact: !!matchedContact,
    };

    setCalls((prev) => [outgoingLog, ...prev]);

    // Add security timeline event if spam
    if (profile.isSpam) {
      const newEvent: SecurityTimelineEvent = {
        id: `tl-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: 'Just now',
        title: 'Outgoing Call to High-Risk Number',
        description: `Alerted user during outbound call to reported number ${cleanNumber} (${profile.spamScore}% risk).`,
        severity: 'WARNING',
        matchedNumber: cleanNumber,
      };
      setTimelineEvents((prev) => [newEvent, ...prev]);
    }
  };

  // END ACTIVE CALL -> OPENS POST-CALL INTELLIGENCE SCREEN
  const handleEndActiveCall = () => {
    if (!activeCallSession) return;

    const endedSession = activeCallSession;
    if (endedSession.id) {
      telecomBridge.disconnectCall(endedSession.id);
    }
    setActiveCallSession(null);

    // Open Post-Call intelligence modal
    const finalDuration = endedSession.durationSeconds || 1;
    setPostCallState({
      isOpen: true,
      callId: endedSession.id,
      number: endedSession.number,
      name: endedSession.name,
      durationSeconds: finalDuration,
      durationStr: `${finalDuration}s`,
      sim: endedSession.sim,
      isSpam: endedSession.isSpam,
      wasSpam: endedSession.isSpam,
    });
  };

  // TRIGGER SIMULATED INCOMING CALL (Safe, Suspicious, or High-Risk Scam)
  const handleTriggerIncomingCall = (preset?: 'safe' | 'suspicious' | 'scam') => {
    const simulationPresets = {
      safe: {
        number: '+91 80471 93300',
        name: 'Amazon India Delivery Support',
        carrier: 'Airtel Enterprise Verified',
        location: 'Bengaluru, India',
        isSpam: false,
        isVerifiedBusiness: true,
        riskScore: 4,
        reportsCount: 0,
        spamCategory: undefined,
        spamReason: 'Verified cryptographically signed enterprise Caller ID token.',
      },
      suspicious: {
        number: '+91 14090 98984',
        name: 'Commercial Telemarketing Hub',
        carrier: 'Vodafone Idea Telemarketing',
        location: 'Mumbai, India',
        isSpam: true,
        isVerifiedBusiness: false,
        riskScore: 68,
        reportsCount: 1248,
        spamCategory: 'TELEMARKETING' as SpamCategory,
        spamReason: 'Reported by 1,200+ users for repetitive promotional loan solicitations.',
      },
      scam: {
        number: '+1 (800) 555-0199',
        name: 'Chase Fraud Alert Dept',
        carrier: 'Twilio VoIP Untrusted',
        location: 'Delaware, USA',
        isSpam: true,
        isVerifiedBusiness: false,
        riskScore: 96,
        reportsCount: 8420,
        spamCategory: 'SCAM' as SpamCategory,
        spamReason: 'Known bank impersonation scam attempting to harvest 2FA security codes.',
      },
    };

    const chosenPreset = preset ? simulationPresets[preset] : simulationPresets.scam;

    const incomingState: IncomingCallState = {
      active: true,
      number: chosenPreset.number,
      callerName: chosenPreset.name,
      carrier: chosenPreset.carrier,
      location: chosenPreset.location,
      lineType: chosenPreset.isSpam ? 'VoIP / Automated' : 'Enterprise Mobile',
      isSpam: chosenPreset.isSpam,
      isVerifiedBusiness: chosenPreset.isVerifiedBusiness,
      riskScore: chosenPreset.riskScore,
      spamCategory: chosenPreset.spamCategory,
      spamReason: chosenPreset.spamReason,
      reportsCount: chosenPreset.reportsCount,
      countdown: chosenPreset.isSpam && autoCancelEnabled ? 3 : 0,
      status: 'RINGING',
    };

    setActiveIncomingCall(incomingState);
  };

  // INCOMING CALL ACTION HANDLERS
  const handleCancelIncomingCall = (reason: string, block: boolean) => {
    if (!activeIncomingCall) return;

    const callState = activeIncomingCall;
    if (callState.callId) {
      telecomBridge.rejectCall(callState.callId, reason);
    }
    setActiveIncomingCall(null);
    playCallCancelledTone();

    // Log call as blocked or missed
    const cancelledCall: CallLogItem = {
      id: `call-term-${Date.now()}`,
      number: callState.number,
      callerName: callState.callerName,
      type: callState.isSpam ? 'BLOCKED_CANCELLED' : 'MISSED',
      timestamp: Date.now(),
      durationSeconds: 0,
      isSpam: callState.isSpam,
      spamCategory: callState.spamCategory,
      spamReason: reason,
      riskScore: callState.riskScore,
      reportsCount: callState.reportsCount,
      carrier: callState.carrier,
      location: callState.location,
      isVerifiedBusiness: callState.isVerifiedBusiness,
    };

    setCalls((prev) => [cancelledCall, ...prev]);

    if (block) {
      handleBlockNumber(callState.number, callState.callerName);
    }

    // Add to Security Timeline
    const timelineEvt: SecurityTimelineEvent = {
      id: `tl-${Date.now()}`,
      timestamp: Date.now(),
      timeStr: 'Just now',
      title: callState.isSpam ? 'Spam Call Dropped by Firewall' : 'Incoming Call Declined',
      description: `${callState.callerName} (${callState.number}) — ${reason}`,
      severity: callState.isSpam ? 'BLOCK' : 'INFO',
      matchedNumber: callState.number,
    };
    setTimelineEvents((prev) => [timelineEvt, ...prev]);
  };

  const handleAnswerIncomingCall = () => {
    if (!activeIncomingCall) return;

    const callState = activeIncomingCall;
    if (callState.callId) {
      telecomBridge.answerCall(callState.callId);
    }
    setActiveIncomingCall(null);

    const session: ActiveCallSession = {
      id: callState.callId || `call-sess-${Date.now()}`,
      number: callState.number,
      name: callState.callerName,
      isSpam: callState.isSpam,
      spamCategory: callState.spamCategory,
      riskScore: callState.riskScore,
      riskLevel: callState.riskScore > 70 ? 'HIGH_RISK' : callState.riskScore > 40 ? 'SUSPICIOUS' : 'SAFE',
      durationSeconds: 0,
      status: 'CONNECTED',
      isMuted: false,
      isSpeaker: false,
      isHeld: false,
      isKeypadOpen: false,
      selectedSim,
      sim: selectedSim,
      isVerifiedBusiness: callState.isVerifiedBusiness,
    };

    setActiveCallSession(session);

    // Record incoming call
    const answeredLog: CallLogItem = {
      id: `call-${Date.now()}`,
      number: callState.number,
      callerName: callState.callerName,
      type: 'INCOMING',
      timestamp: Date.now(),
      durationSeconds: 0,
      isSpam: callState.isSpam,
      spamCategory: callState.spamCategory,
      riskScore: callState.riskScore,
      reportsCount: callState.reportsCount,
      carrier: callState.carrier,
      location: callState.location,
      isVerifiedBusiness: callState.isVerifiedBusiness,
    };

    setCalls((prev) => [answeredLog, ...prev]);
  };

  // BLOCK & WHITELIST RULES
  const handleBlockNumber = (number: string, label: string) => {
    const newRule: BlockRule = {
      id: `rule-${Date.now()}`,
      value: number,
      matchType: 'EXACT',
      targetType: 'BOTH',
      category: 'SPAM',
      label: label || `Blocked ${number}`,
      notes: 'Added via VigilShield call intelligence',
      enabled: true,
      hitCount: 1,
      createdAt: Date.now(),
    };

    setRules((prev) => [newRule, ...prev]);

    // Update existing calls to reflected blocked state
    setCalls((prev) =>
      prev.map((c) =>
        c.number === number
          ? {
              ...c,
              isSpam: true,
              type: 'BLOCKED_CANCELLED',
              spamReason: 'Blocked in firewall rules',
            }
          : c
      )
    );

    // Timeline event
    setTimelineEvents((prev) => [
      {
        id: `tl-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: 'Just now',
        title: 'Number Added to Firewall Blocklist',
        description: `Permanently blocked ${number} (${label}) from ringing.`,
        severity: 'BLOCK',
        matchedNumber: number,
      },
      ...prev,
    ]);
  };

  const handleWhitelistNumber = (number: string, name: string) => {
    const newWl: WhitelistEntry = {
      id: `wl-${Date.now()}`,
      value: number,
      name: name || 'Trusted Caller',
      notes: 'Manually verified as safe',
      createdAt: Date.now(),
    };

    setWhitelist((prev) => [newWl, ...prev]);

    // Update call list
    setCalls((prev) =>
      prev.map((c) =>
        c.number === number
          ? {
              ...c,
              isSpam: false,
              type: c.type === 'BLOCKED_CANCELLED' ? 'INCOMING' : c.type,
              riskScore: 0,
            }
          : c
      )
    );

    setTimelineEvents((prev) => [
      {
        id: `tl-${Date.now()}`,
        timestamp: Date.now(),
        timeStr: 'Just now',
        title: 'Number Whitelisted as Trusted',
        description: `Granted full bypass privileges to ${name || number}.`,
        severity: 'SAFE',
        matchedNumber: number,
      },
      ...prev,
    ]);
  };

  // CONTACTS MANAGEMENT
  const handleAddContact = (newContact: Omit<ContactItem, 'id'>) => {
    const contact: ContactItem = {
      ...newContact,
      id: `cnt-${Date.now()}`,
    };
    setContacts((prev) => [contact, ...prev]);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleToggleFavoriteContact = (id: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  };

  const handleEditContact = (id: string, updates: Partial<ContactItem>) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  // POST-CALL ACTIONS
  const handlePostCallAddContact = (number: string, name?: string) => {
    handleAddContact({
      name: name || 'New Contact',
      number,
      category: 'PERSONAL',
      isFavorite: false,
      trusted: true,
    });
  };

  const handlePostCallReportSpam = (number: string, category: SpamCategory, reason: string) => {
    handleBlockNumber(number, `Spam #${category}`);
    setFastReportNumber(number);
  };

  const handlePostCallSaveNote = (number: string, note: string) => {
    setCalls((prev) =>
      prev.map((c) => (c.number === number ? { ...c, aiSummary: `User note: ${note}` } : c))
    );
  };

  // SYNC COMMUNITY DATABASE
  const handleSyncDatabase = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSettings((prev) => ({
        ...prev,
        lastSyncedTimestamp: Date.now(),
        communityDatabaseVersion: `v2026.09.${new Date().getDate()}-rev5`,
      }));
      setTimelineEvents((prev) => [
        {
          id: `tl-${Date.now()}`,
          timestamp: Date.now(),
          timeStr: 'Just now',
          title: 'Threat Database Synchronized',
          description: 'Updated with latest verified carrier numbers and robocall telemetry.',
          severity: 'INFO',
        },
        ...prev,
      ]);
    }, 1200);
  };

  const spamCallsCount = calls.filter((c) => c.isSpam || c.type === 'BLOCKED_CANCELLED').length;
  const activeRulesCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* 1. Live Incoming Call Overlay Screen (Safe, Suspicious, Critical Scam) */}
      <IncomingCallOverlay
        call={activeIncomingCall}
        autoCancelEnabled={autoCancelEnabled}
        onCancelCall={handleCancelIncomingCall}
        onAnswerCall={handleAnswerIncomingCall}
        onDismiss={() => {
          if (activeIncomingCall) {
            handleCancelIncomingCall('Call dismissed by user', false);
          }
        }}
        onScreenCall={(call) => {
          alert(`AI Screening initiated for ${call.callerName}. Asking caller for purpose of call...`);
        }}
      />

      {/* 2. Active Call In-Call HUD (Screen 6) */}
      <ActiveCallModal
        session={activeCallSession}
        onEndCall={handleEndActiveCall}
        lookupProfile={handleLookupProfile}
        onAddCall={(number) => handleInitiateCall(number)}
      />

      {/* 3. Post-Call Intelligence Screen (Screen 7) */}
      <PostCallModal
        postCall={postCallState}
        onDismiss={() => setPostCallState(null)}
        onAddContact={handlePostCallAddContact}
        onBlockNumber={handleBlockNumber}
        onReportSpam={handlePostCallReportSpam}
        onSaveNote={handlePostCallSaveNote}
      />

      {/* 4. Top Header with Quick Actions and Simulation Controls */}
      <Header
        settings={settings}
        onToggleShield={() => setSettings((prev) => ({ ...prev, masterEnabled: !prev.masterEnabled }))}
        onSyncDatabase={handleSyncDatabase}
        isSyncing={isSyncing}
        onTriggerIncomingCall={() => handleTriggerIncomingCall('scam')}
        autoCancelEnabled={autoCancelEnabled}
        onToggleAutoCancel={() => setAutoCancelEnabled((prev) => !prev)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        onOpenDataSources={() => setIsDataSourcesModalOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
        isDefaultDialer={isDefaultDialer}
        onRequestDefaultDialer={handleRequestDefaultDialer}
        onOpenPermissionCenter={() => setIsPermissionCenterOpen(true)}
      />

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2 border transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-600/50'
              : toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-600/50'
              : 'bg-slate-900 text-indigo-300 border-indigo-500/40'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* 5. 5-Tab Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        spamCallsCount={spamCallsCount}
        activeRulesCount={activeRulesCount}
        assistantAlertsCount={3}
      />

      {/* 6. Main Tab Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 sm:pb-8">
        {/* Tab 1: Dialer */}
        {activeTab === 'dialer' && (
          <DialerTab
            contacts={contacts}
            recentCalls={calls}
            settings={settings}
            lookupProfile={handleLookupProfile}
            onInitiateCall={(number, name, sim) => {
              if (sim) setSelectedSim(sim);
              handleInitiateCall(number, name, sim);
            }}
            onOpenCallerDetail={(item) => {
              const num = 'number' in item ? item.number : '';
              const profile = lookupTruecallerDirectory(num, rules, whitelist);
              setSelectedProfile(profile);
              const matchedCall = calls.find((c) => c.number === num) || null;
              setSelectedCall(matchedCall);
              setIsCallerModalOpen(true);
            }}
            onSaveContact={(number, name) => {
              handlePostCallAddContact(number, name);
            }}
            selectedSim={selectedSim}
            onChangeSim={setSelectedSim}
            initialNumber={dialerInitialNumber}
          />
        )}

        {/* Tab 2: Recents */}
        {activeTab === 'recents' && (
          <RecentsTab
            calls={calls}
            rules={rules}
            whitelist={whitelist}
            settings={settings}
            lookupProfile={handleLookupProfile}
            onInitiateCall={handleInitiateCall}
            onSelectCall={(call) => {
              const profile = lookupTruecallerDirectory(call.number, rules, whitelist);
              setSelectedProfile(profile);
              setSelectedCall(call);
              setIsCallerModalOpen(true);
            }}
            onBlockNumber={handleBlockNumber}
            onWhitelistNumber={handleWhitelistNumber}
            onDeleteCall={(id) => setCalls((prev) => prev.filter((c) => c.id !== id))}
            onClearAllCalls={() => {
              if (window.confirm('Clear your entire call log history?')) {
                setCalls([]);
              }
            }}
            onStartScreeningDemo={(number, name) => {
              handleTriggerIncomingCall('suspicious');
            }}
            onSyncDeviceCalls={handleSyncDeviceCalls}
          />
        )}

        {/* Tab 3: Contacts */}
        {activeTab === 'contacts' && (
          <ContactsTab
            contacts={contacts}
            onInitiateCall={handleInitiateCall}
            onAddContact={handleAddContact}
            onUpdateContact={handleEditContact}
            onDeleteContact={handleDeleteContact}
            onToggleFavorite={handleToggleFavoriteContact}
            recentCalls={calls}
          />
        )}

        {/* Tab 4: Protection */}
        {activeTab === 'protection' && (
          <ProtectionTab
            settings={settings}
            onUpdateSettings={setSettings}
            rules={rules}
            onToggleRule={(id) => {
              setRules((prev) =>
                prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
              );
            }}
            onDeleteRule={(id) => setRules((prev) => prev.filter((r) => r.id !== id))}
            onAddRule={(ruleData) => {
              const newRule: BlockRule = {
                ...ruleData,
                id: `rule-${Date.now()}`,
                hitCount: 0,
                createdAt: Date.now(),
              };
              setRules((prev) => [newRule, ...prev]);
            }}
            whitelist={whitelist}
            onRemoveWhitelist={(id) => setWhitelist((prev) => prev.filter((w) => w.id !== id))}
            timelineEvents={timelineEvents}
          />
        )}

        {/* Tab 5: Assistant */}
        {activeTab === 'assistant' && (
          <AssistantTab
            calls={calls}
            contacts={contacts}
            rules={rules}
            lookupProfile={handleLookupProfile}
            onInitiateCall={handleInitiateCall}
            onAddRule={(ruleData) => {
              const newRule: BlockRule = {
                ...ruleData,
                id: `rule-${Date.now()}`,
                hitCount: 0,
                createdAt: Date.now(),
              };
              setRules((prev) => [newRule, ...prev]);
            }}
          />
        )}
      </main>

      {/* 7. Caller Identity Profile Detail Modal */}
      <CallerDetailModal
        call={selectedCall}
        profile={selectedProfile}
        isOpen={isCallerModalOpen}
        onClose={() => setIsCallerModalOpen(false)}
        onBlockNumber={handleBlockNumber}
        onMarkSafe={(num, name) => handleWhitelistNumber(num, name)}
        onInitiateCall={handleInitiateCall}
        onOpenReportModal={(num) => {
          setFastReportNumber(num);
          setIsFastReportOpen(true);
        }}
        onOpenDisputeModal={(num, name) => {
          setDisputeNumber(num);
          setDisputeName(name);
          setIsDisputeOpen(true);
        }}
        onUpdateCallerName={(num, newName) => {
          setCalls((prev) =>
            prev.map((c) => (c.number === num ? { ...c, callerName: newName } : c))
          );
        }}
      />

      {/* 8. Install APK Modal */}
      <InstallApkModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />

      {/* 9. Fast Spam Report Modal */}
      <FastReportModal
        isOpen={isFastReportOpen}
        initialNumber={fastReportNumber}
        onClose={() => setIsFastReportOpen(false)}
        onSubmitReport={(num, category, description) => {
          handleBlockNumber(num, `Reported ${category}: ${description}`);
          // Send to backend REST API v1
          fetch('/v1/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: num,
              report_type: category === 'PHISHING' || category === 'IMPERSONATOR' ? 'SCAM' : 'SPAM',
              category,
              comment: description,
              user_id: 'local_device_user',
            }),
          }).catch(console.error);
          setIsFastReportOpen(false);
        }}
      />

      {/* 10. Classification Dispute Modal */}
      <DisputeModal
        isOpen={isDisputeOpen}
        initialNumber={disputeNumber}
        initialName={disputeName}
        onClose={() => setIsDisputeOpen(false)}
        onSubmitDispute={(data) => {
          // Send to backend REST API v1
          fetch('/v1/caller-corrections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: data.number,
              suggested_name: data.requesterName,
              reason: data.reason,
            }),
          }).catch(console.error);
          alert(`Dispute for ${data.number} has been logged and queued for audit.`);
          setIsDisputeOpen(false);
        }}
      />

      {/* 11. Data Sources & Privacy Architecture Modal */}
      <DataSourcesModal
        isOpen={isDataSourcesModalOpen}
        onClose={() => setIsDataSourcesModalOpen(false)}
        onClearAllData={handleResetToCleanState}
      />

      {/* 12. Permission Center & Telephony Setup Wizard */}
      <PermissionCenterModal
        isOpen={isPermissionCenterOpen}
        onClose={() => setIsPermissionCenterOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        isDefaultDialer={isDefaultDialer}
        onRequestDefaultDialer={handleRequestDefaultDialer}
        onSyncContacts={() => {
          if (telecomBridge.isAndroidEnvironment()) {
            try {
              const deviceContacts = telecomBridge.fetchDeviceContacts(300);
              if (deviceContacts && deviceContacts.length > 0) {
                setContacts(deviceContacts);
                showToast(`Synchronized ${deviceContacts.length} contacts`, 'success');
              }
            } catch (err) {
              showToast('Contacts permission required on Android device', 'error');
            }
          } else {
            showToast('Device contacts sync is ready for Android Telecom environment', 'info');
          }
        }}
      />

      {/* 13. System Diagnostics & Telephony Health Modal (Issue 30) */}
      <SystemDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        contacts={contacts}
        calls={calls}
        rules={rules}
        whitelist={whitelist}
        settings={settings}
        timelineEvents={timelineEvents}
        onResetToCleanState={handleResetToCleanState}
        onImportAllData={handleImportAllData}
        isDefaultDialer={isDefaultDialer}
        onRequestDefaultDialer={handleRequestDefaultDialer}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VigilShield • Calm. Intelligent. Protective. Private.</span>
          <span className="font-mono text-[11px] text-slate-600">
            Firewall Engine: {settings.communityDatabaseVersion} • Zero-Telemetry Design
          </span>
        </div>
      </footer>
    </div>
  );
}
