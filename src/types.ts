export type MatchType = 'EXACT' | 'PREFIX' | 'REGEX' | 'KEYWORD';
export type TargetType = 'CALL' | 'SMS' | 'BOTH';
export type DisplayDensity = 'compact' | 'comfortable';
export type SpamCategory = 'SPAM' | 'TELEMARKETING' | 'ROBOCALL' | 'PHISHING' | 'SCAM' | 'DEBT_COLLECTOR' | 'IMPERSONATOR' | 'CUSTOM';
export type ActionTaken = 'BLOCKED' | 'DROPPED' | 'QUARANTINED' | 'ALLOWED';
export type SensitivityLevel = 'MODERATE' | 'STRICT' | 'AGGRESSIVE';
export type CallDirection = 'INCOMING' | 'OUTGOING' | 'MISSED' | 'BLOCKED_CANCELLED';
export type CallClassification = 'SAFE' | 'UNKNOWN' | 'SUSPICIOUS' | 'SPAM' | 'SCAM' | 'VERIFIED';
export type RiskLevel = 'SAFE' | 'UNKNOWN' | 'SUSPICIOUS' | 'HIGH_RISK';
export type FirewallMode = 'STANDARD' | 'STRICT' | 'CUSTOM' | 'MAXIMUM';
export type TemporaryProtectionMode = 'DISABLED' | 'TWO_HOURS' | 'UNTIL_TOMORROW';
export type TrustedCategory = 'FAMILY' | 'FRIENDS' | 'WORK' | 'DOCTOR' | 'SCHOOL' | 'DELIVERY' | 'SERVICES';
export type TabId = 'dialer' | 'recents' | 'contacts' | 'protection' | 'assistant' | 'home' | 'calls' | 'intelligence' | 'search' | 'profile';
export interface ContactItem { id:string; name:string; number:string; avatarColor?:string; category:'FAVORITE'|'FAMILY'|'WORK'|'BUSINESS'|'GENERAL'|'PERSONAL'; isFavorite?:boolean; isVerifiedBusiness?:boolean; businessCategory?:string; website?:string; notes?:string; trusted:boolean; totalCallsCount?:number; lastCallTimestamp?:number; }
export interface ActiveCallSession { id:string; number:string; name:string; isSpam:boolean; spamCategory?:SpamCategory; riskScore:number; riskLevel:RiskLevel; durationSeconds:number; status:'DIALING'|'CONNECTED'|'MUTED'|'HELD'; isMuted:boolean; isSpeaker:boolean; isHeld:boolean; isKeypadOpen:boolean; selectedSim?:'SIM 1 (Personal)'|'SIM 2 (Work)'; sim?:string; isVerifiedBusiness?:boolean; riskWarningUpdated?:boolean; warningDismissed?:boolean; notes?:string; isPrivateCall?:boolean; usedAiScreener?:boolean; screeningTranscript?:ScreeningTranscriptEntry[]; screeningDetectedIntent?:string; }
export interface CallRecordingItem {
  id: string;
  callId?: string;
  number: string;
  callerName?: string;
  timestamp: number;
  durationSeconds: number;
  folderPath: string; // e.g. "Internal Storage/Recordings/CallShield/"
  fileName: string;   // e.g. "REC_9876543210_20260916_1224.wav"
  fileSizeBytes: number;
  mimeType: string;
  dataUri: string;
  quality: string;    // "48 kHz Studio Lossless"
}

export interface PostCallState { isOpen:boolean; callId:string; number:string; name:string; durationSeconds:number; durationStr?:string; sim?:string; isSpam?:boolean; wasSpam?:boolean; alreadyClassified?:boolean; notes?:string; usedAiScreener?:boolean; screeningTranscript?:ScreeningTranscriptEntry[]; screeningSummaryBullets?:string[]; screeningSummary?:string; screeningDetectedIntent?:string; isGeneratingSummary?:boolean; }
export interface SecurityTimelineEvent { id:string; timestamp:number; timeStr:string; title:string; description:string; severity:'INFO'|'WARNING'|'BLOCK'|'SAFE'; matchedNumber?:string; }
export interface CallLogItem { id:string; number:string; callerName:string; type:CallDirection; timestamp:number; durationSeconds:number; isSpam:boolean; spamCategory?:SpamCategory; spamReason?:string; riskScore:number; riskLevel?:RiskLevel; classification?:CallClassification; confidence?:number; identificationSource?:string; userAction?:'NONE'|'BLOCKED'|'MARKED_SAFE'|'DISPUTED'|'REPORTED'; aiSummary?:string; riskSignals?:string[]; rawSource?:'device_os'|'imported_file'|'web_contact_picker'|'test_pipeline'; reportsCount:number; carrier?:string; location?:string; isVerifiedBusiness?:boolean; isContact?:boolean; labelVerdict?:'SPAM'|'NOT_SPAM'; repeatCount?:number; explainReason?:string; notes?:string; recordingUri?:string; isNeighborSpoof?:boolean; isPingBackScam?:boolean; isPrivateCall?:boolean; usedAiScreener?:boolean; screeningTranscript?:ScreeningTranscriptEntry[]; screeningSummaryBullets?:string[]; screeningSummary?:string; screeningDetectedIntent?:string; screenedAt?:number; sim?:string; }
export interface ProtectionScoreBreakdown { score:number; rating:'Excellent'|'Good'|'Fair'|'At Risk'; factors:{label:string;impact:string;isPositive:boolean}[]; explanation:string; }
export interface SpamWaveAlert { id:string; detectedAt:number; callCount:number; timeframeMinutes:number; pattern:string; sampleNumbers:string[]; status:'ACTIVE'|'DISMISSED'|'BLOCKED'; }
export type SmartBlockChoice = 'THIS_NUMBER'|'SIMILAR_NUMBERS'|'ENTIRE_SERIES'|'ALL_HIGH_RISK';
export interface WeeklyReport { weekRange:string; spamDetected:number; blockedCount:number; highRiskCount:number; newRulesCount:number; topCategory:string; improvementPercent:number; }
export interface Milestone { id:string; title:string; description:string; achieved:boolean; dateAchieved?:string; icon:string; }
export interface SmsItem { id:string; sender:string; senderName:string; body:string; timestamp:number; isSpam:boolean; category:'INBOX'|'TRANSACTIONS'|'SPAM'; riskScore:number; spamReason?:string; extractedUrls?:string[]; reviewed?:boolean; }
export interface BlockRule { id:string; value:string; matchType:MatchType; targetType:TargetType; category:SpamCategory; label:string; notes?:string; enabled:boolean; hitCount:number; createdAt:number; visualPattern?:string; }
export interface WhitelistEntry { id:string; value:string; name:string; notes?:string; createdAt:number; }
export interface TrustedContact { id:string; name:string; number:string; category:TrustedCategory; notes?:string; createdAt:number; }
export interface SpamReport { id:string; number:string; category:string; description:string; timestamp:number; reporter?:string; status:'PENDING'|'VERIFIED'|'DISPUTED'; }
export interface DisputeRequest { id:string; number:string; requesterName:string; email:string; reason:string; timestamp:number; status:'UNDER_REVIEW'|'APPROVED'|'REJECTED'; }
export interface SpamCluster { id:string; prefix:string; label:string; count:number; sampleNumbers:string[]; riskScore:number; blocked:boolean; }
export interface ProtectionLog { id:string; timestamp:number; type:'CALL'|'SMS'; sender:string; senderName?:string; messageBody?:string; actionTaken:ActionTaken; matchedRuleId?:string; matchedReason:string; riskScore:number; riskLevel?:RiskLevel; spamCategory:SpamCategory; flaggedKeywords?:string[]; reviewed?:boolean; }
export interface CallShieldDirectoryProfile { number:string; name:string; spamScore:number; riskLevel?:RiskLevel; isSpam:boolean; spamReportsCount:number; spamCategory?:SpamCategory; spamReason?:string; topTags:string[]; carrier:string; location:string; lineType:'Mobile'|'Landline'|'VoIP'|'Toll-Free'|'Telemarketing Series'|'Unknown'; isVerified:boolean; source?:string; userVote?:'SPAM'|'SAFE'; communityComments:{author:string;text:string;date:string}[]; reportBreakdown?:{telemarketingPercent:number;scamPercent:number;robocallPercent:number}; authorizedSources?:string[]; businessCategory?:string; circle?:string; country?:string; }
export type VolumeButtonAction = 'MUTE_RINGER' | 'REJECT_CALL';
export interface ShieldSettings { masterEnabled:boolean; firewallMode:FirewallMode; tempProtection:TemporaryProtectionMode; tempProtectionExpiresAt?:number; scamShieldEnabled:boolean; smartCallScreeningEnabled:boolean; autoCancelSpamCalls:boolean; cancelDelaySeconds:number; blockUnknownNumbers:boolean; blockPrivateHidden:boolean; blockInternational:boolean; blockShortcodes:boolean; aggressiveSmsFilter:boolean; aiAnalysisEnabled:boolean; dropCallInstantly:boolean; playRingtone:boolean; autoSyncDatabase:boolean; lastSyncedTimestamp:number; sensitivity:SensitivityLevel; communityDatabaseVersion:string; neighborSpoofEnabled?:boolean; pingBackShieldEnabled?:boolean; userPhoneNumber?:string; privateCallPrefix?:string; powerButtonEndsCall?:boolean; volumeButtonSilencesRinger?:boolean; volumeButtonAction?:VolumeButtonAction; ringerMode?:'NORMAL'|'VIBRATE'|'SILENT'; vibrateOnCallConnected?:boolean; flipToSilence?:boolean; flashAlertOnIncomingCall?:boolean; }
export interface PermissionStatus { callScreeningRole:boolean; defaultSmsRole:boolean; readContacts:boolean; postNotifications:boolean; callLogAccess?:boolean; overlayDrawAccess?:boolean; }
export interface ScreeningResult { isBlocked:boolean; action:ActionTaken; reason:string; riskScore:number; category:SpamCategory; callerName?:string; reportsCount:number; carrier?:string; location?:string; lineType?:string; topTags?:string[]; matchedRule?:BlockRule; flaggedKeywords?:string[]; extractedUrls?:string[]; }
export interface ScreeningTranscriptEntry { id:string; sender:'assistant'|'caller'|'user'; text:string; timestamp:number; }
export interface IncomingCallState { active:boolean; callId?:string; number:string; callerName:string; carrier:string; location:string; lineType?:string; topTags?:string[]; isSpam:boolean; isVerifiedBusiness?:boolean; spamCategory?:SpamCategory; spamReason?:string; riskScore:number; spamScore?:number; reportsCount:number; countdown:number; status:'RINGING'|'CANCELLED'|'ANSWERED'|'DECLINED'|'SCREENING'; isNeighborSpoof?:boolean; isPingBackScam?:boolean; screeningTranscript?:ScreeningTranscriptEntry[]; screeningDetectedIntent?:string; isRingerSilenced?:boolean; spoofWarning?:string; isPingBackMuted?:boolean; viewMode?:'popup'|'fullscreen'; }
