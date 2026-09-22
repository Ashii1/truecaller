import { 
  BlockRule, 
  WhitelistEntry, 
  ShieldSettings, 
  PermissionStatus, 
  CallLogItem, 
  SmsItem 
} from '../types';

export const INITIAL_SETTINGS: ShieldSettings = {
  masterEnabled: true,
  firewallMode: 'MAXIMUM',
  tempProtection: 'DISABLED',
  scamShieldEnabled: true,
  smartCallScreeningEnabled: true,
  autoCancelSpamCalls: true,
  cancelDelaySeconds: 3,
  playRingtone: true,
  blockUnknownNumbers: false,
  blockPrivateHidden: true,
  blockInternational: false,
  blockShortcodes: false,
  aggressiveSmsFilter: true,
  aiAnalysisEnabled: true,
  dropCallInstantly: true,
  autoSyncDatabase: true,
  lastSyncedTimestamp: Date.now(),
  sensitivity: 'STRICT',
  communityDatabaseVersion: 'v2026.09-telecom-engine',
  neighborSpoofEnabled: true,
  pingBackShieldEnabled: true,
  userPhoneNumber: '',
  privateCallPrefix: '*67',
  powerButtonEndsCall: false,
  volumeButtonSilencesRinger: true,
  volumeButtonAction: 'MUTE_RINGER',
  ringerMode: 'NORMAL',
  vibrateOnCallConnected: true,
  flipToSilence: true,
  flashAlertOnIncomingCall: false,
};

export const INITIAL_PERMISSIONS: PermissionStatus = {
  callScreeningRole: false,
  defaultSmsRole: false,
  readContacts: false,
  postNotifications: false,
};

// Pure Production Defaults - Zero Mock Data
export const INITIAL_WHITELIST: WhitelistEntry[] = [];

// Regulatory baseline rules (TRAI statutory telemarketing allocations) with zero fake hit counts
export const INITIAL_RULES: BlockRule[] = [
  {
    id: 'rule-trai-140',
    value: '140',
    matchType: 'PREFIX',
    targetType: 'BOTH',
    category: 'TELEMARKETING',
    label: 'TRAI Telemarketing Series (140 Series)',
    notes: 'Official statutory series designated for commercial telemarketing and promotional voice calls.',
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

// Production Defaults: Zero Mock Calls, Zero Fake SMS, Zero Synthetic Clusters
export const INITIAL_CALLS: CallLogItem[] = [];
export const INITIAL_SMS: SmsItem[] = [];
export const INITIAL_SPAM_CLUSTERS: any[] = [];
