import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import LockscreenBarrier from './components/LockscreenBarrier';
import { BlockRule, WhitelistEntry, ShieldSettings, CallLogItem, IncomingCallState, ActiveCallSession, PostCallState, SecurityTimelineEvent, CallShieldDirectoryProfile, ContactItem, SpamCategory, TabId, CallRecordingItem, DisplayDensity } from './types';
import { INITIAL_SETTINGS } from './data/defaultData';
import { lookupCallShieldDirectory } from './utils/spamEngine';
import { detectNeighborSpoof, detectPingBackScam, formatPrivateCallNumber } from './utils/spoofEngine';
import { telecomBridge } from './services/telephony/telecomBridge';
import { externalDirectoryService } from './services/externalDirectoryService';
import { generateScreeningSummary } from './services/aiScreenerService';
import { readThemePreferences, persistAndApplyTheme, applyTheme } from './services/theme/themeService';

export const BASELINE_RULES: BlockRule[] = [
 {id:'rule-trai-140',value:'140',matchType:'PREFIX',targetType:'BOTH',category:'TELEMARKETING',label:'TRAI Telemarketing Series (140 Series)',notes:'Official Indian telecom regulatory series designated for commercial telemarketing.',enabled:true,hitCount:0,createdAt:Date.now()},
 {id:'rule-trai-160',value:'160',matchType:'PREFIX',targetType:'BOTH',category:'TELEMARKETING',label:'TRAI Commercial Gateway (160 Series)',notes:'Designated series for commercial call centers and automated notifications.',enabled:true,hitCount:0,createdAt:Date.now()}
];
const INITIAL_TIMELINE_EVENTS: SecurityTimelineEvent[] = [];
type Sim='SIM 1 (Personal)'|'SIM 2 (Work)';

export default function App(){
 const [activeTab,setActiveTab]=useState<TabId>('dialer'); const [phoneOnly,setPhoneOnly]=useState(false); const [navigationSignal,setNavigationSignal]=useState(0); const [selectedSim,setSelectedSim]=useState<Sim>('SIM 1 (Personal)');
 const safeParse=<T,>(key:string,fallback:T):T=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}};
 const safeStore=<T,>(key:string,value:T):void=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(err){console.warn(`Storage quota or write failed for ${key}:`,err)}};
 const [settings,setSettings]=useState<ShieldSettings>(()=>safeParse('callshield_settings',INITIAL_SETTINGS));
 const [rules,setRules]=useState<BlockRule[]>(()=>safeParse('callshield_rules',BASELINE_RULES));
 const [whitelist,setWhitelist]=useState<WhitelistEntry[]>(()=>safeParse('callshield_whitelist',[]));
 const [contacts,setContacts]=useState<ContactItem[]>(()=>safeParse('callshield_contacts',[]));
 const [calls,setCalls]=useState<CallLogItem[]>(()=>safeParse('callshield_calls',[]));
 const [timelineEvents,setTimelineEvents]=useState<SecurityTimelineEvent[]>(()=>safeParse('callshield_timeline',INITIAL_TIMELINE_EVENTS));
 const [autoCancelEnabled,setAutoCancelEnabled]=useState<boolean>(()=>safeParse('callshield_autocancel',true));
 const [activeIncomingCall,setActiveIncomingCall]=useState<IncomingCallState|null>(null); const [activeCallSession,setActiveCallSession]=useState<ActiveCallSession|null>(null); const [postCallState,setPostCallState]=useState<PostCallState|null>(null);
 const [selectedProfile,setSelectedProfile]=useState<CallShieldDirectoryProfile|null>(null); const [selectedCall,setSelectedCall]=useState<CallLogItem|null>(null); const [isCallerModalOpen,setIsCallerModalOpen]=useState(false);
 const [isInstallModalOpen,setIsInstallModalOpen]=useState(false); const [isFastReportOpen,setIsFastReportOpen]=useState(false); const [fastReportNumber,setFastReportNumber]=useState(''); const [isDisputeOpen,setIsDisputeOpen]=useState(false); const [disputeNumber,setDisputeNumber]=useState(''); const [disputeName,setDisputeName]=useState('');
 const [isSyncing,setIsSyncing]=useState(false); const [isDataSourcesModalOpen,setIsDataSourcesModalOpen]=useState(false); const [isDiagnosticsModalOpen,setIsDiagnosticsModalOpen]=useState(false); const [isPermissionCenterOpen,setIsPermissionCenterOpen]=useState(false); const [dialerInitialNumber,setDialerInitialNumber]=useState(''); const [deferredPrompt,setDeferredPrompt]=useState<any>(null); const [isDefaultDialer,setIsDefaultDialer]=useState(()=>telecomBridge.isDefaultDialer());
 const [toastMessage,setToastMessage]=useState<{text:string,type:'info'|'error'|'success'}|null>(null);
 const [isDeviceLocked, setIsDeviceLocked] = useState<boolean>(() => telecomBridge.isDeviceLocked());
 const [appInForeground, setAppInForeground] = useState<boolean>(() => typeof document === 'undefined' || document.visibilityState === 'visible');
 
 const showToast=(text:string,type:'info'|'error'|'success'='info')=>{setToastMessage({text,type});window.setTimeout(()=>setToastMessage(null),3800)};

 const [density, setDensity] = useState<DisplayDensity>(() => {
   const tp = readThemePreferences();
   return tp.density === 'COMPACT' ? 'compact' : 'comfortable';
 });

 const handleDensityChange = useCallback((newDensity: DisplayDensity) => {
   setDensity(newDensity);
   const currentTheme = readThemePreferences();
   persistAndApplyTheme({
     ...currentTheme,
     density: newDensity === 'compact' ? 'COMPACT' : 'COMFORTABLE',
   });
 }, []);

 useEffect(() => {
   applyTheme(readThemePreferences());
 }, []);

 const lastBackPressTimeRef = useRef<number>(0);
 const initiateCallRef = useRef<(number: string, name?: string, sim?: Sim, isPrivate?: boolean) => void>(() => {});
 const dataRef = useRef({ rules, whitelist, contacts, settings, autoCancelEnabled, calls, selectedSim });
 dataRef.current = { rules, whitelist, contacts, settings, autoCancelEnabled, calls, selectedSim };
 const stateRef = useRef({
   activeTab,
   isCallerModalOpen,
   postCallState,
   isInstallModalOpen,
   isFastReportOpen,
   isDisputeOpen,
   isDataSourcesModalOpen,
   isDiagnosticsModalOpen,
   isPermissionCenterOpen,
   activeIncomingCall,
 });
 stateRef.current = {
   activeTab,
   isCallerModalOpen,
   postCallState,
   isInstallModalOpen,
   isFastReportOpen,
   isDisputeOpen,
   isDataSourcesModalOpen,
   isDiagnosticsModalOpen,
   isPermissionCenterOpen,
   activeIncomingCall,
 };

 const handleAppBack = (): boolean => {
   const current = stateRef.current;
   if (current.isCallerModalOpen) {
     setIsCallerModalOpen(false);
     return true;
   }
   if (current.postCallState) {
     setPostCallState(null);
     return true;
   }
   if (current.isFastReportOpen) {
     setIsFastReportOpen(false);
     return true;
   }
   if (current.isDisputeOpen) {
     setIsDisputeOpen(false);
     return true;
   }
   if (current.isDataSourcesModalOpen) {
     setIsDataSourcesModalOpen(false);
     return true;
   }
   if (current.isDiagnosticsModalOpen) {
     setIsDiagnosticsModalOpen(false);
     return true;
   }
   if (current.isPermissionCenterOpen) {
     setIsPermissionCenterOpen(false);
     return true;
   }
   if (current.isInstallModalOpen) {
     setIsInstallModalOpen(false);
     return true;
   }
   if (current.activeIncomingCall) {
     setActiveIncomingCall(null);
     return true;
   }
   if (current.activeTab !== 'dialer') {
     setActiveTab('dialer');
     return true;
   }

   const now = Date.now();
   if (now - lastBackPressTimeRef.current < 2000) {
     return false;
   }
   lastBackPressTimeRef.current = now;
   showToast('Press back again to exit', 'info');
   return true;
 };

 useEffect(() => {
   window.history.pushState({ app: 'callshield' }, '', window.location.href);

   const onPopState = () => {
     const handled = handleAppBack();
     if (handled) {
       window.history.pushState({ app: 'callshield' }, '', window.location.href);
     } else {
       window.history.back();
     }
   };

   const onAndroidBack = () => {
     return handleAppBack();
   };

   window.addEventListener('popstate', onPopState);
   (window as any).__onAndroidBackPressed = onAndroidBack;
   window.addEventListener('android_back_pressed', onAndroidBack);

   return () => {
     window.removeEventListener('popstate', onPopState);
     delete (window as any).__onAndroidBackPressed;
     window.removeEventListener('android_back_pressed', onAndroidBack);
   };
 }, []);

 useEffect(()=>{const handler=(e:any)=>{e.preventDefault();setDeferredPrompt(e)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);
 useEffect(()=>{const handleCallsUpdate=(e:any)=>{if(e.detail&&Array.isArray(e.detail)){setCalls(e.detail)}else{const fresh=safeParse<CallLogItem[]>('callshield_calls',[]);if(fresh?.length)setCalls(fresh)}};window.addEventListener('callshield_calls_updated',handleCallsUpdate as EventListener);externalDirectoryService.batchEnrichLocalCalls();return()=>window.removeEventListener('callshield_calls_updated',handleCallsUpdate as EventListener)},[]);
 const syncNativeDeviceData=useCallback(()=>{if(!telecomBridge.isAndroidEnvironment())return;try{const freshCalls=telecomBridge.fetchDeviceCallLogs(200);const freshContacts=telecomBridge.fetchDeviceContacts(500);setCalls(prev=>freshCalls.length?freshCalls:prev);setContacts(prev=>freshContacts.length?freshContacts:prev)}catch(e){console.warn('Device data refresh failed',e)}},[]);
  useEffect(() => { safeStore('callshield_settings', settings); }, [settings]);
  useEffect(() => { safeStore('callshield_rules', rules); }, [rules]);
  useEffect(() => { safeStore('callshield_whitelist', whitelist); }, [whitelist]);
  useEffect(() => { safeStore('callshield_contacts', contacts); }, [contacts]);
  useEffect(() => {
    const timer = setTimeout(() => {
      safeStore('callshield_calls', calls);
    }, 150);
    return () => clearTimeout(timer);
  }, [calls]);
  useEffect(() => {
    const timer = setTimeout(() => {
      safeStore('callshield_timeline', timelineEvents);
    }, 200);
    return () => clearTimeout(timer);
  }, [timelineEvents]);
  useEffect(() => { safeStore('callshield_autocancel', autoCancelEnabled); }, [autoCancelEnabled]);
  useEffect(() => {
    setIsDefaultDialer(telecomBridge.isDefaultDialer());
    if (telecomBridge.isAndroidEnvironment()) {
      syncNativeDeviceData();
      setIsDeviceLocked(telecomBridge.isDeviceLocked());
      try {
        const d = telecomBridge.fetchDeviceCallLogs(100);
        if (d?.length) setCalls(d);
        const c = telecomBridge.fetchDeviceContacts(300);
        if (c?.length) setContacts(c);
      } catch (e) {
        console.warn('Initial device data sync failed', e);
      }
    }

    telecomBridge.syncActiveCalls();

    const handleFocus = () => {
      if (telecomBridge.isAndroidEnvironment()) {
        setIsDeviceLocked(telecomBridge.isDeviceLocked());
      }
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => setAppInForeground(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);

    const unsub = telecomBridge.subscribe((eventType, payload) => {
      if (eventType === 'PHONE_SURFACE_CHANGED') {
        setPhoneOnly(Boolean(payload?.phoneOnly));
        return;
      }
      if (eventType === 'DEVICE_LOCK_STATE_CHANGED') {
        setIsDeviceLocked(Boolean(payload?.isLocked));
        return;
      }
      if (eventType === 'SILENCE_RINGER') {
        setActiveIncomingCall(prev => prev ? { ...prev, isRingerSilenced: true } : null);
        return;
      }
      if (eventType === 'OPEN_CALL_FROM_NOTIFICATION') {
        const rawNumber = payload?.number;
        const number = typeof rawNumber === 'string' ? rawNumber.trim() : rawNumber != null ? String(rawNumber).trim() : '';
        const callId = payload?.callId || '';
        const tab = payload?.tab || 'recents';
        const isIncoming = Boolean(payload?.isIncoming);
        if (payload?.phoneSurface) setPhoneOnly(true);

        if (isIncoming && number) {
          const p = lookupCallShieldDirectory(number, dataRef.current.rules, dataRef.current.whitelist);
          setActiveIncomingCall({
            callId: callId || `call-${Date.now()}`,
            number,
            callerName: payload?.name || p.name || number,
            carrier: p.carrier || 'Cellular',
            location: p.location || 'Incoming Cellular Call',
            riskScore: p.spamScore || 0,
            reportsCount: p.spamReportsCount || 0,
            isSpam: p.isSpam,
            spamCategory: p.spamCategory,
            spamReason: p.spamReason,
            isVerifiedBusiness: p.isVerified,
            status: 'RINGING',
            countdown: 0,
          });
        } else if (tab === 'dialer' && number) {
          setActiveTab('dialer');
          setDialerInitialNumber(number);
          initiateCallRef.current(number, payload?.name);
        } else if (number) {
          setActiveTab(tab === 'recents' ? 'recents' : 'dialer');
          const p = lookupCallShieldDirectory(number, dataRef.current.rules, dataRef.current.whitelist);
          const foundCall = dataRef.current.calls.find((c) => c.number === number || (callId && c.id === callId));
          if (foundCall) {
            setSelectedCall(foundCall);
            setSelectedProfile(p);
            setIsCallerModalOpen(true);
          } else {
            const syntheticCall: CallLogItem = {
              id: callId || `call-notif-${Date.now()}`,
              number,
              callerName: payload?.name || p.name || number,
              type: 'MISSED',
              timestamp: Date.now(),
              durationSeconds: 0,
              isSpam: p.isSpam,
              spamCategory: p.spamCategory,
              riskScore: p.spamScore,
              reportsCount: p.spamReportsCount,
              isContact: dataRef.current.contacts.some((c) => c.number === number),
              isVerifiedBusiness: p.isVerified,
              carrier: p.carrier,
              location: p.location,
              rawSource: 'device_os',
            };
            setSelectedCall(syntheticCall);
            setSelectedProfile(p);
            setIsCallerModalOpen(true);
          }
        } else if (tab) {
          setActiveTab(tab as TabId);
        }
        return;
      }

      const callId = payload?.callId || `call-${Date.now()}`;
      const details = payload?.details && typeof payload.details === 'object' ? payload.details : {};
      const rawDetailsNumber = details?.number;
      const number = typeof rawDetailsNumber === 'string'
        ? rawDetailsNumber.trim()
        : rawDetailsNumber != null ? String(rawDetailsNumber).trim() : '';
      const state = typeof details?.state === 'string' ? details.state : 'RINGING';
      const incoming = details?.isIncoming ?? (state === 'RINGING');

      if (eventType === 'PERMISSIONS_CHANGED') {
        syncNativeDeviceData();
        return;
      }
      if (eventType === 'ROLE_STATUS_CHANGED') {
        setIsDefaultDialer(Boolean(payload?.isDefaultDialer));
        return;
      }
      if (eventType === 'CALL_ADDED' || eventType === 'CALL_STATE_CHANGED') {
        const p = lookupCallShieldDirectory(number, dataRef.current.rules, dataRef.current.whitelist);
        if (incoming && (state === 'RINGING' || state === 'CONNECTING')) {
          const contactNums = dataRef.current.contacts.map((c) => c.number);
          const spoofCheck =
            dataRef.current.settings.neighborSpoofEnabled !== false
              ? detectNeighborSpoof(number, dataRef.current.settings.userPhoneNumber, contactNums)
              : { isNeighborSpoof: false, warningMessage: '' };
          const pingBackCheck =
            dataRef.current.settings.pingBackShieldEnabled !== false
              ? detectPingBackScam(number, details?.durationSeconds || 0, state === 'MISSED' ? 1 : 0)
              : { isPingBackScam: false, warningMessage: '' };
          if (pingBackCheck.isPingBackScam) {
            telecomBridge.silenceRinger();
          }
          setActiveIncomingCall({
            callId,
            number,
            callerName: details?.callerDisplayName || p.name || number,
            carrier: p.carrier || 'Cellular',
            location: p.location || 'Incoming Cellular Call',
            riskScore: Math.max(p.spamScore, spoofCheck.isNeighborSpoof ? 80 : 0, pingBackCheck.isPingBackScam ? 95 : 0),
            reportsCount: p.spamReportsCount,
            isSpam: p.isSpam || spoofCheck.isNeighborSpoof || pingBackCheck.isPingBackScam,
            spamCategory:
              p.spamCategory ||
              (spoofCheck.isNeighborSpoof ? 'NEIGHBOR_SPOOF' : pingBackCheck.isPingBackScam ? 'PING_BACK' : undefined),
            spamReason: spoofCheck.isNeighborSpoof
              ? spoofCheck.warningMessage
              : pingBackCheck.isPingBackScam
              ? pingBackCheck.warningMessage
              : p.spamReason,
            isVerifiedBusiness: p.isVerified,
            isNeighborSpoof: spoofCheck.isNeighborSpoof,
            isPingBackScam: pingBackCheck.isPingBackScam,
            spoofWarning: spoofCheck.warningMessage || pingBackCheck.warningMessage,
            isPingBackMuted: pingBackCheck.isPingBackScam,
            status: 'RINGING',
            countdown: (p.isSpam || pingBackCheck.isPingBackScam) && dataRef.current.autoCancelEnabled ? 3 : 0,
          });
        } else if (state === 'ACTIVE' || state === 'DIALING' || state === 'HOLDING') {
          setActiveIncomingCall(null);
          setActiveCallSession({
            id: callId,
            number,
            name: details?.callerDisplayName || p.name || number,
            isSpam: p.isSpam,
            spamCategory: p.spamCategory,
            riskScore: p.spamScore,
            riskLevel: p.riskLevel || 'UNKNOWN',
            durationSeconds: details?.durationSeconds || 0,
            status: state === 'HOLDING' ? 'HELD' : 'CONNECTED',
            isMuted: false,
            isSpeaker: false,
            isHeld: Boolean(details?.isHolding),
            isKeypadOpen: false,
            selectedSim,
            sim: selectedSim,
            isVerifiedBusiness: p.isVerified,
          });
        }
      } else if (eventType === 'CALL_REMOVED' || eventType === 'CALL_DISCONNECTED') {
        setActiveIncomingCall(null);
        setActiveCallSession((prev) => {
          if (!prev || prev.id !== callId) return prev;
          const dur = prev.durationSeconds || 1;
          const isScreened = Boolean(prev.usedAiScreener);
          const transcript = prev.screeningTranscript;
          const callLogId = prev.id;

          setPostCallState({
            isOpen: true,
            callId: prev.id,
            number: prev.number,
            name: prev.name,
            durationSeconds: dur,
            durationStr: `${dur}s`,
            sim: prev.sim,
            isSpam: prev.isSpam,
            wasSpam: prev.isSpam,
            notes: prev.notes,
            usedAiScreener: isScreened,
            screeningTranscript: transcript,
            screeningDetectedIntent: prev.screeningDetectedIntent,
            isGeneratingSummary: Boolean(isScreened && transcript && transcript.length > 0),
          });

          if (isScreened && transcript && transcript.length > 0) {
            generateScreeningSummary({
              number: prev.number,
              callerName: prev.name,
              transcript,
              detectedIntent: prev.screeningDetectedIntent,
              durationSeconds: dur,
              riskScore: prev.riskScore,
              spamCategory: prev.spamCategory,
            }).then(result => {
              setCalls(cList => cList.map(c => c.id === callLogId ? {
                ...c,
                screeningSummaryBullets: result.summaryBullets,
                screeningSummary: result.fullSummary,
                screeningDetectedIntent: result.keyIntent || c.screeningDetectedIntent,
              } : c));

              setPostCallState(pState => pState && pState.callId === callLogId ? {
                ...pState,
                screeningSummaryBullets: result.summaryBullets,
                screeningSummary: result.fullSummary,
                isGeneratingSummary: false,
              } : pState);
            }).catch(err => {
              console.warn('Screening summarization error:', err);
            });
          }

          return null;
        });
        if (telecomBridge.isAndroidEnvironment()) {
          try {
            const fresh = telecomBridge.fetchDeviceCallLogs(100);
            if (fresh?.length) setCalls(fresh);
          } catch (e) {
            console.warn(e);
          }
        }
      }
    });
    const unsubDial = telecomBridge.onDialIntent((num) => {
      setActiveTab('dialer');
      setDialerInitialNumber(num);
    });
    const unsubCall = telecomBridge.onCallIntent((num) => {
      setActiveTab('dialer');
      setDialerInitialNumber(num);
      initiateCallRef.current(num);
    });

    telecomBridge.notifyUiReady();

    return () => {
      unsub();
      unsubDial();
      unsubCall();
      window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncNativeDeviceData]);

 const handleLookupProfile = useCallback((n: string) => lookupCallShieldDirectory(n, rules, whitelist), [rules, whitelist]);
 const handleRequestDefaultDialer = useCallback(() => { const r = telecomBridge.requestDefaultDialerRole(); if (!r.success) showToast(r.message, 'error'); else showToast(r.message, 'info'); }, []);
 const handleSyncDeviceData = useCallback(() => {
   setIsSyncing(true);
   try {
     if (telecomBridge.isAndroidEnvironment()) {
       const d = telecomBridge.fetchDeviceCallLogs(200);
       const c = telecomBridge.fetchDeviceContacts(500);
       if (d.length) setCalls(d);
       if (c.length) setContacts(c);
       showToast(`Synced ${d.length} calls and ${c.length} contacts`, 'success');
     } else {
       showToast('Android device sync is available in the native app', 'info');
     }
   } catch {
     showToast('Device sync failed', 'error');
   } finally {
     setIsSyncing(false);
   }
 }, []);
 const handleSaveNote = useCallback((callId: string, note: string) => {
   setCalls(prev => {
     const target = prev.find(c => c.id === callId);
     if (!target) return prev;
     const key = target.number.replace(/\D/g, '');
     return prev.map(c => c.number.replace(/\D/g, '') === key ? { ...c, notes: note } : c);
   });
   showToast(note ? 'Caller note saved' : 'Caller note cleared', 'success');
 }, []);
 const handleUpdateCallerName = useCallback((number: string, newName: string) => {
   setCalls(prev => prev.map(c => c.number.replace(/\D/g, '') === number.replace(/\D/g, '') ? { ...c, callerName: newName } : c));
   setContacts(prev => prev.map(c => c.number.replace(/\D/g, '') === number.replace(/\D/g, '') ? { ...c, name: newName } : c));
 }, []);
 const handleClearAllCalls = useCallback(() => { if (window.confirm('Clear your entire call log history?')) setCalls([]); }, []);
  const handleInitiateCall = useCallback((number: string, name?: string, sim?: Sim, isPrivate?: boolean) => {
    const clean = number.trim(), digits = clean.replace(/[^\d+*#]/g, ''), target = sim || selectedSim, p = lookupCallShieldDirectory(clean, rules, whitelist), matched = contacts.find(c => c.number.replace(/\D/g, '') === clean.replace(/\D/g, '')), resolved = name || matched?.name || p.name || clean;
    const dialedNumber = isPrivate ? formatPrivateCallNumber(digits, settings.privateCallPrefix || '*67') : digits;
    const result = telecomBridge.placeRealCall(dialedNumber, target);
    if (!result.success) { showToast(result.message, 'error'); return; }
    // A call started from Contacts/Recents must immediately replace the underlying
    // list with the CallShield in-call surface. Native Telecom state will refine this
    // session with the real call id as soon as the call is registered.
    setActiveTab('dialer');
    if (isPrivate) { showToast(`Calling with caller ID masked (${settings.privateCallPrefix || '*67'})`, 'info'); }
    setActiveCallSession({
      id: result.callId || `call-${Date.now()}`,
      number: clean,
      name: isPrivate ? `${resolved} (Private)` : resolved,
      isSpam: p.isSpam,
      spamCategory: p.spamCategory,
      riskScore: p.spamScore,
      riskLevel: p.riskLevel || 'UNKNOWN',
      durationSeconds: 0,
      status: 'DIALING',
      isMuted: false,
      isSpeaker: false,
      isHeld: false,
      isKeypadOpen: false,
      selectedSim: target,
      sim: target,
      isVerifiedBusiness: p.isVerified
    });
    setCalls(prev => [{
      id: `call-${Date.now()}`,
      number: clean,
      callerName: resolved,
      type: 'OUTGOING',
      timestamp: Date.now(),
      durationSeconds: 0,
      isSpam: p.isSpam,
      spamCategory: p.spamCategory,
      riskScore: p.spamScore,
      reportsCount: p.spamReportsCount,
      carrier: p.carrier,
      location: p.location,
      isVerifiedBusiness: p.isVerified,
      isContact: !!matched,
      isPrivate: Boolean(isPrivate)
    }, ...prev]);
  }, [selectedSim, rules, whitelist, contacts, settings]);

  initiateCallRef.current = handleInitiateCall;

  useEffect(() => {
    if (contacts.length > 0 && telecomBridge.isAndroidEnvironment()) {
      const topContacts = contacts.slice(0, 4).map(c => ({ name: c.name, number: c.number }));
      telecomBridge.updateWidgetData(topContacts);
    }
  }, [contacts]);

  const handleTriggerScreeningDemo = useCallback((customNumber?: string, customName?: string) => {
    const demoNumber = customNumber || '+91 98765 01928';
    const demoName = customName || 'Unknown Energy Services (Suspicious)';
    setActiveIncomingCall({
      callId: `demo-screen-${Date.now()}`,
      number: demoNumber,
      callerName: demoName,
      carrier: 'Cellular India',
      location: 'Mumbai, Maharashtra',
      riskScore: 74,
      reportsCount: 19,
      isSpam: true,
      spamCategory: 'TELEMARKETING',
      spamReason: 'Reported commercial robocall / unknown offer',
      isVerifiedBusiness: false,
      status: 'RINGING',
      countdown: 0
    });
    showToast('Incoming call: Tap "Screen Call" to test the AI Voice Assistant!', 'info');
  }, []);

  const handleBlockNumber = useCallback((number: string, label: string) => {
    const rule = { id: `rule-${Date.now()}`, value: number, matchType: 'EXACT' as const, targetType: 'BOTH' as const, category: 'SPAM' as SpamCategory, label: label || `Blocked ${number}`, enabled: true, hitCount: 1, createdAt: Date.now() };
    setRules(p => [rule, ...p]);
    telecomBridge.syncBlockRules?.([rule]);
    setCalls(p => p.map(c => c.number === number ? { ...c, isSpam: true, classification: 'SPAM' as const, riskLevel: 'HIGH_RISK' as const, riskScore: Math.max(c.riskScore, 90), spamReason: 'Blocked in firewall rules' } : c));
    showToast('Number blocked', 'success');
  }, []);

  const handleWhitelistNumber = useCallback((number: string, name: string) => {
    setWhitelist(p => [{ id: `wl-${Date.now()}`, value: number, name: name || 'Trusted Caller', notes: 'Manually verified as safe', createdAt: Date.now() }, ...p]);
    setCalls(p => p.map(c => c.number === number ? { ...c, isSpam: false, classification: 'SAFE' as const, riskLevel: 'SAFE' as const, riskScore: 0, userAction: 'MARKED_SAFE' as const } : c));
    showToast('Number marked safe', 'success');
  }, []);

  const handleAddContact = useCallback((contact: Omit<ContactItem, 'id'>) => {
    const n = contact.number.trim(), nm = contact.name.trim();
    if (!n) return;
    const existing = contacts.find(c => c.number.replace(/\D/g, '') === n.replace(/\D/g, ''));
    if (existing) { showToast('Contact already exists', 'info'); return; }
    const c: ContactItem = { id: `cnt-${Date.now()}`, ...contact, name: nm, number: n };
    setContacts(p => [c, ...p]);
    telecomBridge.createContact(n, nm);
    showToast('Contact added', 'success');
  }, [contacts]);

  const handleUpdateContact = useCallback((id: string, updates: Partial<ContactItem>) => setContacts(p => p.map(c => c.id === id ? { ...c, ...updates } : c)), []);
  const handleDeleteContact = useCallback((id: string) => setContacts(p => p.filter(c => c.id !== id)), []);
  const handleToggleFavorite = useCallback((id: string) => setContacts(p => p.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c)), []);

  const handleReportSpam = useCallback((number: string, category: SpamCategory, reason: string) => {
    const rule = { id: `rule-${Date.now()}`, value: number, matchType: 'EXACT' as const, targetType: 'BOTH' as const, category, label: `Reported ${category}`, notes: reason, enabled: true, hitCount: 1, createdAt: Date.now() };
    setRules(p => [rule, ...p]);
    setCalls(p => p.map(c => c.number === number ? { ...c, isSpam: true, spamCategory: category, spamReason: reason, riskScore: Math.max(c.riskScore, 85) } : c));
    setTimelineEvents(p => [{ id: `tl-${Date.now()}`, timestamp: Date.now(), type: 'REPORT', number, description: `Reported as ${category}`, ...({} as any) }, ...p]);
    showToast('Spam report saved locally', 'success');
  }, []);

  const handleClearAllData = useCallback(() => {
    ['callshield_settings', 'callshield_rules', 'callshield_whitelist', 'callshield_contacts', 'callshield_calls', 'callshield_timeline', 'callshield_autocancel', 'callshield_privacy_settings'].forEach(k => localStorage.removeItem(k));
    setSettings(INITIAL_SETTINGS);
    setRules(BASELINE_RULES);
    setWhitelist([]);
    setContacts([]);
    setCalls([]);
    setTimelineEvents([]);
    setAutoCancelEnabled(true);
    showToast('Local app state reset', 'success');
  }, []);

  const handleImportAllData = useCallback((data: any) => {
    if (data?.settings) setSettings(data.settings);
    if (Array.isArray(data?.rules)) setRules(data.rules);
    if (Array.isArray(data?.whitelist)) setWhitelist(data.whitelist);
    if (Array.isArray(data?.contacts)) setContacts(data.contacts);
    if (Array.isArray(data?.calls)) setCalls(data.calls);
    if (Array.isArray(data?.timelineEvents)) setTimelineEvents(data.timelineEvents);
    showToast('Backup restored', 'success');
  }, []);

  const handleTriggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
      return;
    }
    showToast('Use your browser menu to install the app', 'info');
  }, [deferredPrompt]);

  const handleEndCall = useCallback((recordingItem?: CallRecordingItem | null, callDuration?: number, callerNotes?: string) => {
    if (activeCallSession?.id) telecomBridge.disconnectCall(activeCallSession.id, activeCallSession.number);
    else telecomBridge.clearStaleCallNotifications();
    if (activeCallSession) {
      const dur = callDuration || activeCallSession.durationSeconds || 1;
      const note = callerNotes || activeCallSession.notes;
      const isScreened = Boolean(activeCallSession.usedAiScreener);
      const transcript = activeCallSession.screeningTranscript;
      const callLogId = `call-${Date.now()}`;
      const newCallLog: CallLogItem = {
        id: callLogId,
        number: activeCallSession.number,
        callerName: activeCallSession.name || activeCallSession.number,
        type: 'OUTGOING',
        timestamp: Date.now(),
        durationSeconds: dur,
        isSpam: Boolean(activeCallSession.isSpam),
        spamCategory: activeCallSession.spamCategory,
        riskScore: activeCallSession.riskScore || 0,
        riskLevel: activeCallSession.riskLevel || 'SAFE',
        reportsCount: 0,
        recordingUri: recordingItem ? recordingItem.dataUri : undefined,
        notes: note,
        usedAiScreener: isScreened,
        screeningTranscript: transcript,
        screeningDetectedIntent: activeCallSession.screeningDetectedIntent,
        screenedAt: isScreened ? Date.now() : undefined,
      };
      setCalls(p => [newCallLog, ...p]);
      if (recordingItem) {
        showToast(`Saved to ${recordingItem.folderPath}${recordingItem.fileName}`, 'success');
      }
      setPostCallState({
        isOpen: true,
        callId: activeCallSession.id,
        number: activeCallSession.number,
        name: activeCallSession.name,
        durationSeconds: dur,
        durationStr: `${dur}s`,
        sim: activeCallSession.sim,
        isSpam: activeCallSession.isSpam,
        wasSpam: activeCallSession.isSpam,
        notes: note,
        usedAiScreener: isScreened,
        screeningTranscript: transcript,
        screeningDetectedIntent: activeCallSession.screeningDetectedIntent,
        isGeneratingSummary: Boolean(isScreened && transcript && transcript.length > 0),
      });

      if (isScreened && transcript && transcript.length > 0) {
        generateScreeningSummary({
          number: activeCallSession.number,
          callerName: activeCallSession.name,
          transcript,
          detectedIntent: activeCallSession.screeningDetectedIntent,
          durationSeconds: dur,
          riskScore: activeCallSession.riskScore,
          spamCategory: activeCallSession.spamCategory,
        }).then(result => {
          setCalls(prev => prev.map(c => c.id === callLogId ? {
            ...c,
            screeningSummaryBullets: result.summaryBullets,
            screeningSummary: result.fullSummary,
            screeningDetectedIntent: result.keyIntent || c.screeningDetectedIntent,
          } : c));

          setPostCallState(prev => prev && prev.callId === activeCallSession.id ? {
            ...prev,
            screeningSummaryBullets: result.summaryBullets,
            screeningSummary: result.fullSummary,
            isGeneratingSummary: false,
          } : prev);
        }).catch(err => {
          console.warn('Screening summarization error:', err);
        });
      }
    }
    setActiveCallSession(null);
  }, [activeCallSession]);

  const openCaller = useCallback((call: CallLogItem) => {
    setSelectedProfile(lookupCallShieldDirectory(call.number, rules, whitelist));
    setSelectedCall(call);
    setIsCallerModalOpen(true);
  }, [rules, whitelist]);

  const handleDeleteCall = useCallback((id: string) => setCalls(p => p.filter(c => c.id !== id)), []);
  const handleToggleRule = useCallback((id: string) => setRules(p => p.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)), []);
  const handleDeleteRule = useCallback((id: string) => setRules(p => p.filter(r => r.id !== id)), []);
  const handleAddRule = useCallback((d: any) => setRules(p => [{ ...d, id: `rule-${Date.now()}`, hitCount: 0, createdAt: Date.now() }, ...p]), []);
  const handleRemoveWhitelist = useCallback((id: string) => setWhitelist(p => p.filter(w => w.id !== id)), []);
  const handleOpenCallerDetail = useCallback((item: any) => {
    const n = 'number' in item ? item.number : '';
    setSelectedProfile(lookupCallShieldDirectory(n, rules, whitelist));
    setSelectedCall(calls.find(c => c.number === n) || null);
    setIsCallerModalOpen(true);
  }, [rules, whitelist, calls]);

  const recentSpamCalls = useMemo(() => calls.filter(c => c.isSpam), [calls]);
  const spamCallsCount = useMemo(() => recentSpamCalls.length, [recentSpamCalls]);
  const activeRulesCount = useMemo(() => rules.filter(r => r.enabled).length, [rules]);

  return <div className="min-h-screen bg-[#070b10] text-white">
   {!phoneOnly && <Header closeSettingsSignal={navigationSignal} settings={settings} isDefaultDialer={isDefaultDialer} onRequestDefaultDialer={handleRequestDefaultDialer} onOpenPermissionCenter={()=>setIsPermissionCenterOpen(true)} onSyncDatabase={handleSyncDeviceData} isSyncing={isSyncing} autoCancelEnabled={autoCancelEnabled} onToggleAutoCancel={()=>setAutoCancelEnabled(v=>!v)} onOpenInstallModal={()=>setIsInstallModalOpen(true)} onOpenDataSources={()=>setIsDataSourcesModalOpen(true)} onOpenDiagnostics={()=>setIsDiagnosticsModalOpen(true)} recentSpamCalls={recentSpamCalls} onSelectCall={openCaller} onOpenRecents={()=>setActiveTab('recents')} onOpenProtection={()=>setActiveTab('protection')} density={density} onDensityChange={handleDensityChange}/>} 
   <Navigation activeTab={activeTab} onChangeTab={(tab) => { setNavigationSignal(v => v + 1); setActiveTab(tab); }} spamCallsCount={spamCallsCount} activeRulesCount={activeRulesCount} assistantAlertsCount={3} phoneOnly={phoneOnly}/> 
   <main className={phoneOnly ? "min-h-screen w-full" : "mx-auto w-full max-w-4xl px-3 py-3 pb-28 sm:pb-32"}>
    {activeTab==='dialer'&&<DialerTab contacts={contacts} recentCalls={calls} settings={settings} lookupProfile={handleLookupProfile} onInitiateCall={handleInitiateCall} onOpenCallerDetail={handleOpenCallerDetail} onSaveContact={(n,nm)=>handleUpdateCallerName(n,nm)} selectedSim={selectedSim} onChangeSim={setSelectedSim} initialNumber={dialerInitialNumber} density={density}/>} 
    {activeTab==='recents'&&<RecentsTab calls={calls} rules={rules} whitelist={whitelist} settings={settings} lookupProfile={handleLookupProfile} onInitiateCall={handleInitiateCall} onSelectCall={openCaller} onBlockNumber={handleBlockNumber} onWhitelistNumber={handleWhitelistNumber} onDeleteCall={handleDeleteCall} onClearAllCalls={handleClearAllCalls} onSyncDeviceCalls={handleSyncDeviceData} density={density}/>} 
    {activeTab==='contacts'&&<ContactsTab contacts={contacts} onInitiateCall={handleInitiateCall} onAddContact={handleAddContact} onUpdateContact={handleUpdateContact} onDeleteContact={handleDeleteContact} onToggleFavorite={handleToggleFavorite} recentCalls={calls} density={density} onOpenCallerDetail={handleOpenCallerDetail} privateCallPrefix={settings.privateCallPrefix}/>} 
    {activeTab==='protection'&&<ProtectionTab settings={settings} onUpdateSettings={setSettings} rules={rules} onToggleRule={handleToggleRule} onDeleteRule={handleDeleteRule} onAddRule={handleAddRule} whitelist={whitelist} onRemoveWhitelist={handleRemoveWhitelist} timelineEvents={timelineEvents} onTriggerScreeningDemo={handleTriggerScreeningDemo}/>} 
    {activeTab==='assistant'&&<AssistantTab calls={calls} contacts={contacts} rules={rules} lookupProfile={handleLookupProfile} onInitiateCall={handleInitiateCall} onAddRule={handleAddRule}/>} 
   </main>

  <CallerDetailModal call={selectedCall} calls={calls} contacts={contacts} profile={selectedProfile} isOpen={isCallerModalOpen} onClose={()=>setIsCallerModalOpen(false)} onBlockNumber={handleBlockNumber} onMarkSafe={handleWhitelistNumber} onInitiateCall={(number, name, sim, isPrivate) => { setIsCallerModalOpen(false); handleInitiateCall(number, name, sim, isPrivate); }} onOpenReportModal={n=>{setFastReportNumber(n);setIsFastReportOpen(true)}} onOpenDisputeModal={(n,nm)=>{setDisputeNumber(n);setDisputeName(nm);setIsDisputeOpen(true)}} onUpdateCallerName={handleUpdateCallerName} onAddContact={handleAddContact} onSaveNote={handleSaveNote}/>
  <IncomingCallOverlay
    call={activeIncomingCall}
    autoCancelEnabled={autoCancelEnabled}
    onCancelCall={(reason, block, screeningData) => {
      if (activeIncomingCall?.callId) {
        if (block) handleBlockNumber(activeIncomingCall.number, activeIncomingCall.callerName || activeIncomingCall.number);
        telecomBridge.rejectCall(activeIncomingCall.callId, reason);
      } else {
        telecomBridge.clearStaleCallNotifications();
      }

      if (activeIncomingCall) {
        const transcript = screeningData?.transcript || activeIncomingCall.screeningTranscript;
        const isScreened = Boolean(transcript && transcript.length > 0) || activeIncomingCall.status === 'SCREENING';
        const detectedIntent = screeningData?.intent || activeIncomingCall.screeningDetectedIntent || null;
        const callLogId = activeIncomingCall.callId || `screened-${Date.now()}`;
        const dur = Math.max(10, (transcript?.length || 1) * 5);

        if (isScreened && transcript && transcript.length > 0) {
          const newCallLog: CallLogItem = {
            id: callLogId,
            number: activeIncomingCall.number,
            callerName: activeIncomingCall.callerName || activeIncomingCall.number,
            type: block ? 'BLOCKED_CANCELLED' : 'INCOMING',
            timestamp: Date.now(),
            durationSeconds: dur,
            isSpam: Boolean(activeIncomingCall.isSpam) || Boolean(block),
            spamCategory: activeIncomingCall.spamCategory,
            riskScore: activeIncomingCall.riskScore || (block ? 85 : 20),
            riskLevel: block ? 'HIGH_RISK' : (activeIncomingCall.riskScore > 60 ? 'SUSPICIOUS' : 'SAFE'),
            reportsCount: activeIncomingCall.reportsCount || 0,
            usedAiScreener: true,
            screeningTranscript: transcript,
            screeningDetectedIntent: detectedIntent || undefined,
            screenedAt: Date.now(),
          };

          setCalls(prev => [newCallLog, ...prev]);

          setPostCallState({
            isOpen: true,
            callId: callLogId,
            number: activeIncomingCall.number,
            name: activeIncomingCall.callerName,
            durationSeconds: dur,
            durationStr: `${dur}s`,
            sim: selectedSim,
            isSpam: Boolean(activeIncomingCall.isSpam) || Boolean(block),
            wasSpam: Boolean(activeIncomingCall.isSpam) || Boolean(block),
            usedAiScreener: true,
            screeningTranscript: transcript,
            screeningDetectedIntent: detectedIntent || undefined,
            isGeneratingSummary: true,
          });

          generateScreeningSummary({
            number: activeIncomingCall.number,
            callerName: activeIncomingCall.callerName,
            transcript,
            detectedIntent: detectedIntent || undefined,
            durationSeconds: dur,
            riskScore: activeIncomingCall.riskScore,
            spamCategory: activeIncomingCall.spamCategory,
          }).then(result => {
            setCalls(prev => prev.map(c => c.id === callLogId ? {
              ...c,
              screeningSummaryBullets: result.summaryBullets,
              screeningSummary: result.fullSummary,
              screeningDetectedIntent: result.keyIntent || c.screeningDetectedIntent,
            } : c));

            setPostCallState(prev => prev && prev.callId === callLogId ? {
              ...prev,
              screeningSummaryBullets: result.summaryBullets,
              screeningSummary: result.fullSummary,
              isGeneratingSummary: false,
            } : prev);
          }).catch(err => {
            console.warn('Screening summarization error:', err);
          });
        }
      }

      setActiveIncomingCall(null);
    }}
    onAnswerCall={(screeningData) => {
      if (activeIncomingCall?.callId) {
        telecomBridge.answerCall(activeIncomingCall.callId);
      }
      if (activeIncomingCall) {
        const transcript = screeningData?.transcript || activeIncomingCall.screeningTranscript;
        setActiveCallSession({
          id: activeIncomingCall.callId || `call-${Date.now()}`,
          number: activeIncomingCall.number,
          name: activeIncomingCall.callerName,
          isSpam: Boolean(activeIncomingCall.isSpam),
          spamCategory: activeIncomingCall.spamCategory,
          riskScore: activeIncomingCall.riskScore || 0,
          riskLevel: activeIncomingCall.riskScore > 60 ? 'SUSPICIOUS' : 'SAFE',
          durationSeconds: 0,
          status: 'CONNECTED',
          isMuted: false,
          isSpeaker: false,
          isHeld: false,
          isKeypadOpen: false,
          selectedSim,
          sim: selectedSim,
          usedAiScreener: Boolean(transcript && transcript.length > 0),
          screeningTranscript: transcript,
          screeningDetectedIntent: screeningData?.intent || activeIncomingCall.screeningDetectedIntent || undefined,
        });
      }
      setActiveIncomingCall(null);
    }}
    onScreenCall={(call) => {
      telecomBridge.silenceRinger();
      setActiveIncomingCall(prev => prev ? { ...prev, status: 'SCREENING' } : null);
    }}
    onDismiss={() => {
      if (activeIncomingCall?.callId) {
        telecomBridge.rejectCall(activeIncomingCall.callId, 'Dismissed');
      }
      telecomBridge.clearStaleCallNotifications();
      setActiveIncomingCall(null);
    }}
  />
  <ActiveCallModal session={activeCallSession} onEndCall={handleEndCall} lookupProfile={handleLookupProfile} onAddCall={n=>handleInitiateCall(n)}/>
  <PostCallModal postCall={postCallState} onDismiss={()=>setPostCallState(null)} onAddContact={handleAddContact} onBlockNumber={handleBlockNumber} onReportSpam={handleReportSpam} onSaveNote={(number,note)=>{const c=calls.find(x=>x.number.replace(/\D/g,'')===number.replace(/\D/g,''));if(c)handleSaveNote(c.id,note)}}/>
  <FastReportModal isOpen={isFastReportOpen} initialNumber={fastReportNumber} onClose={()=>setIsFastReportOpen(false)} onSubmitReport={handleReportSpam}/>
  <DisputeModal isOpen={isDisputeOpen} initialNumber={disputeNumber} initialName={disputeName} onClose={()=>setIsDisputeOpen(false)} onSubmitDispute={()=>{setIsDisputeOpen(false);showToast('Dispute request saved for review','success')}}/>
  <DataSourcesModal isOpen={isDataSourcesModalOpen} onClose={()=>setIsDataSourcesModalOpen(false)} onClearAllData={handleClearAllData}/>
  <SystemDiagnosticsModal isOpen={isDiagnosticsModalOpen} onClose={()=>setIsDiagnosticsModalOpen(false)} contacts={contacts} calls={calls} rules={rules} whitelist={whitelist} settings={settings} timelineEvents={timelineEvents} onResetToCleanState={handleClearAllData} onImportAllData={handleImportAllData} isDefaultDialer={isDefaultDialer} onRequestDefaultDialer={handleRequestDefaultDialer}/>
  <PermissionCenterModal isOpen={isPermissionCenterOpen} onClose={()=>setIsPermissionCenterOpen(false)} settings={settings} onUpdateSettings={setSettings} isDefaultDialer={isDefaultDialer} onRequestDefaultDialer={handleRequestDefaultDialer} onSyncContacts={handleSyncDeviceData}/>
  <InstallApkModal isOpen={isInstallModalOpen} onClose={()=>setIsInstallModalOpen(false)} deferredPrompt={deferredPrompt} onTriggerInstall={handleTriggerInstall}/>
  {isDeviceLocked && !activeIncomingCall && !activeCallSession && (
    <LockscreenBarrier
      onUnlockSuccess={() => setIsDeviceLocked(false)}
      onEmergencyCall={(num) => handleInitiateCall(num, 'Emergency Services')}
    />
  )}
  {toastMessage && (
    <div className={`fixed bottom-24 sm:bottom-8 left-1/2 z-[100] -translate-x-1/2 max-w-[90vw] rounded-2xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center space-x-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
      toastMessage.type === 'error'
        ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
        : toastMessage.type === 'success'
        ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
        : 'bg-slate-900/95 border-slate-700/80 text-white'
    }`}>
      <span>{toastMessage.text}</span>
    </div>
  )}
 </div>;
}
