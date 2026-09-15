export type MatchType = 'EXACT' | 'PREFIX' | 'REGEX' | 'KEYWORD';
export type TargetType = 'CALL' | 'SMS' | 'BOTH';
export type SpamCategory = 
  | 'SPAM' 
  | 'TELEMARKETING' 
  | 'ROBOCALL' 
  | 'PHISHING' 
  | 'SCAM' 
  | 'DEBT_COLLECTOR' 
  | 'IMPERSONATOR'
  | 'CUSTOM';

export type ActionTaken = 'BLOCKED' | 'DROPPED' | 'QUARANTINED' | 'ALLOWED';
export type SensitivityLevel = 'MODERATE' | 'STRICT' | 'AGGRESSIVE';
export type CallDirection = 'INCOMING' | 'OUTGOING' | 'MISSED' | 'BLOCKED_CANCELLED';

// 6-State Call Security Classification System
export type CallClassification = 
  | 'SAFE' 
  | 'UNKNOWN' 
  | 'SUSPICIOUS' 
  | 'SPAM' 
  | 'SCAM' 
  | 'VERIFIED';

// 4-Tier Risk Indicator System (for backward compatibility)
export type RiskLevel = 'SAFE' | 'UNKNOWN' | 'SUSPICIOUS' | 'HIGH_RISK';

// Smart Call Firewall Modes
export type FirewallMode = 'STANDARD' | 'STRICT' | 'CUSTOM' | 'MAXIMUM';

// Temporary Protection Mode
export type TemporaryProtectionMode = 'DISABLED' | 'TWO_HOURS' | 'UNTIL_TOMORROW';

// Trusted Caller Categories
export type TrustedCategory = 'FAMILY' | 'FRIENDS' | 'WORK' | 'DOCTOR' | 'SCHOOL' | 'DELIVERY' | 'SERVICES';

export type TabId = 'dialer' | 'recents' | 'contacts' | 'protection' | 'assistant' | 'home' | 'calls' | 'intelligence' | 'search' | 'profile';

export interface ContactItem {
  id: string;
  name: string;
  number: string;
  avatarColor?: string;
  category: 'FAVORITE' | 'FAMILY' | 'WORK' | 'BUSINESS' | 'GENERAL' | 'PERSONAL';
  isFavorite?: boolean;
  isVerifiedBusiness?: boolean;
  businessCategory?: string;
  website?: string;
  notes?: string;
  trusted: boolean;
  totalCallsCount?: number;
  lastCallTimestamp?: number;
}

export interface ActiveCallSession {
  id: string;
  number: string;
  name: string;
  isSpam: boolean;
  spamCategory?: SpamCategory;
  riskScore: number;
  riskLevel: RiskLevel;
  durationSeconds: number;
  status: 'DIALING' | 'CONNECTED' | 'MUTED' | 'HELD';
  isMuted: boolean;
  isSpeaker: boolean;
  isHeld: boolean;
  isKeypadOpen: boolean;
  selectedSim?: 'SIM 1 (Personal)' | 'SIM 2 (Work)';
  sim?: string;
  isVerifiedBusiness?: boolean;
  riskWarningUpdated?: boolean;
  warningDismissed?: boolean;
  notes?: string;
}

export interface PostCallState {
  isOpen: boolean;
  callId: string;
  number: string;
  name: string;
  durationSeconds: number;
  durationStr?: string;
  sim?: string;
  isSpam?: boolean;
  wasSpam?: boolean;
  alreadyClassified?: boolean;
}

export interface SecurityTimelineEvent {
  id: string;
  timestamp: number;
  timeStr: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'BLOCK' | 'SAFE';
  matchedNumber?: string;
}

export interface CallLogItem {
  id: string;
  number: string;
  callerName: string;
  type: CallDirection;
  timestamp: number;
  durationSeconds: number;
  isSpam: boolean;
  spamCategory?: SpamCategory;
  spamReason?: string;
  riskScore: number; // 0 - 100
  riskLevel?: RiskLevel;
  classification?: CallClassification;
  confidence?: number; // 0 - 100 %
  identificationSource?: string; // e.g. "Device Contacts", "Authorized Carrier Directory", "Community Consensus"
  userAction?: 'NONE' | 'BLOCKED' | 'MARKED_SAFE' | 'DISPUTED' | 'REPORTED';
  aiSummary?: string;
  riskSignals?: string[];
  rawSource?: 'device_os' | 'imported_file' | 'web_contact_picker' | 'test_pipeline';
  reportsCount: number;
  carrier?: string;
  location?: string;
  isVerifiedBusiness?: boolean;
  isContact?: boolean;
  labelVerdict?: 'SPAM' | 'NOT_SPAM';
  repeatCount?: number;
  explainReason?: string;
}

export interface ProtectionScoreBreakdown {
  score: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'At Risk';
  factors: { label: string; impact: string; isPositive: boolean }[];
  explanation: string;
}

export interface SpamWaveAlert {
  id: string;
  detectedAt: number;
  callCount: number;
  timeframeMinutes: number;
  pattern: string;
  sampleNumbers: string[];
  status: 'ACTIVE' | 'DISMISSED' | 'BLOCKED';
}

export type SmartBlockChoice = 'THIS_NUMBER' | 'SIMILAR_NUMBERS' | 'ENTIRE_SERIES' | 'ALL_HIGH_RISK';

export interface WeeklyReport {
  weekRange: string;
  spamDetected: number;
  blockedCount: number;
  highRiskCount: number;
  newRulesCount: number;
  topCategory: string;
  improvementPercent: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  dateAchieved?: string;
  icon: string;
}

export interface SmsItem {
  id: string;
  sender: string;
  senderName: string;
  body: string;
  timestamp: number;
  isSpam: boolean;
  category: 'INBOX' | 'TRANSACTIONS' | 'SPAM';
  riskScore: number;
  spamReason?: string;
  extractedUrls?: string[];
  reviewed?: boolean;
}

export interface BlockRule {
  id: string;
  value: string;
  matchType: MatchType;
  targetType: TargetType;
  category: SpamCategory;
  label: string;
  notes?: string;
  enabled: boolean;
  hitCount: number;
  createdAt: number;
  visualPattern?: string; // e.g. "98765•••••"
}

export interface WhitelistEntry {
  id: string;
  value: string;
  name: string;
  notes?: string;
  createdAt: number;
}

export interface TrustedContact {
  id: string;
  name: string;
  number: string;
  category: TrustedCategory;
  notes?: string;
  createdAt: number;
}

export interface SpamReport {
  id: string;
  number: string;
  category: string;
  description: string;
  timestamp: number;
  reporter?: string;
  status: 'PENDING' | 'VERIFIED' | 'DISPUTED';
}

export interface DisputeRequest {
  id: string;
  number: string;
  requesterName: string;
  email: string;
  reason: string;
  timestamp: number;
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
}

export interface SpamCluster {
  id: string;
  prefix: string;
  label: string;
  count: number;
  sampleNumbers: string[];
  riskScore: number;
  blocked: boolean;
}

export interface ProtectionLog {
  id: string;
  timestamp: number;
  type: 'CALL' | 'SMS';
  sender: string;
  senderName?: string;
  messageBody?: string;
  actionTaken: ActionTaken;
  matchedRuleId?: string;
  matchedReason: string;
  riskScore: number; // 0 - 100
  riskLevel?: RiskLevel;
  spamCategory: SpamCategory;
  flaggedKeywords?: string[];
  reviewed?: boolean;
}

export interface TruecallerDirectoryProfile {
  number: string;
  name: string;
  spamScore: number; // 0 - 100
  riskLevel?: RiskLevel;
  isSpam: boolean;
  spamReportsCount: number;
  spamCategory?: SpamCategory;
  spamReason?: string;
  topTags: string[];
  carrier: string;
  location: string;
  lineType: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Telemarketing Series' | 'Unknown';
  isVerified: boolean;
  userVote?: 'SPAM' | 'SAFE';
  communityComments: { author: string; text: string; date: string }[];
  reportBreakdown?: {
    telemarketingPercent: number;
    scamPercent: number;
    robocallPercent: number;
  };
  authorizedSources?: string[];
}

export interface ShieldSettings {
  masterEnabled: boolean;
  firewallMode: FirewallMode;
  tempProtection: TemporaryProtectionMode;
  tempProtectionExpiresAt?: number;
  scamShieldEnabled: boolean;
  smartCallScreeningEnabled: boolean;
  autoCancelSpamCalls: boolean; // Auto-Hangup & Cancel before ringing
  cancelDelaySeconds: number; // 0 for instant, or 1-3 seconds to display HUD
  blockUnknownNumbers: boolean;
  blockPrivateHidden: boolean;
  blockInternational: boolean;
  blockShortcodes: boolean;
  aggressiveSmsFilter: boolean;
  aiAnalysisEnabled: boolean;
  dropCallInstantly: boolean;
  playRingtone: boolean;
  autoSyncDatabase: boolean;
  lastSyncedTimestamp: number;
  sensitivity: SensitivityLevel;
  communityDatabaseVersion: string;
}

export interface PermissionStatus {
  callScreeningRole: boolean;
  defaultSmsRole: boolean;
  readContacts: boolean;
  postNotifications: boolean;
  callLogAccess?: boolean;
  overlayDrawAccess?: boolean;
}

export interface ScreeningResult {
  isBlocked: boolean;
  action: ActionTaken;
  reason: string;
  riskScore: number;
  category: SpamCategory;
  callerName?: string;
  reportsCount: number;
  carrier?: string;
  location?: string;
  lineType?: string;
  topTags?: string[];
  matchedRule?: BlockRule;
  flaggedKeywords?: string[];
  extractedUrls?: string[];
}

export interface IncomingCallState {
  active: boolean;
  number: string;
  callerName: string;
  carrier: string;
  location: string;
  lineType?: string;
  topTags?: string[];
  isSpam: boolean;
  isVerifiedBusiness?: boolean;
  spamCategory?: SpamCategory;
  spamReason?: string;
  riskScore: number;
  spamScore?: number;
  reportsCount: number;
  countdown: number;
  status: 'RINGING' | 'CANCELLED' | 'ANSWERED' | 'DECLINED';
}
