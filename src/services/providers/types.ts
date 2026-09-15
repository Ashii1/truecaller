import { 
  SpamCategory, 
  RiskLevel, 
  CallClassification 
} from '../../types';

export type ConfidenceRating = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface ProviderResult<T> {
  value: T;
  confidence: ConfidenceRating;
  source: string;
  attribution?: string;
  canDisplayToUser: boolean;
  cacheTtlSeconds: number;
  timestamp: number;
}

export interface NormalizedNumberMetadata {
  e164: string;
  countryCode: string;
  nationalNumber: string;
  countryIso: string;
  numberType: 'MOBILE' | 'FIXED_LINE' | 'VOIP' | 'TOLL_FREE' | 'PAGER' | 'UNKNOWN';
  carrier?: string;
  region?: string;
  timeZone?: string;
  isValid: boolean;
  isPossible: boolean;
}

export interface BusinessEntity {
  name: string;
  category: string;
  website?: string;
  address?: string;
  city?: string;
  isVerified: boolean;
  verificationSource?: string;
  lastVerifiedAt?: number;
}

export interface ReputationMetric {
  riskScore: number;       // 0 - 100
  classification: CallClassification;
  spamCategory?: SpamCategory;
  reportCount: number;
  recentReportCount: number;
  uniqueReporters: number;
  explanation: string;
  isSpam: boolean;
}

export interface CallerIdentityEntity {
  name: string;
  isBusiness: boolean;
  businessDetails?: BusinessEntity;
  reputation: ReputationMetric;
  metadata: NormalizedNumberMetadata;
  stirShakenStatus?: 'PASSED' | 'FAILED' | 'UNKNOWN';
}

// 1. Phone Number Validation & Metadata Provider Interface
export interface PhoneNumberValidationProvider {
  name: string;
  normalize(rawNumber: string, defaultCountry?: string): ProviderResult<NormalizedNumberMetadata>;
}

// 2. Business Directory Provider Interface
export interface BusinessDirectoryProvider {
  name: string;
  lookupBusiness(e164: string): Promise<ProviderResult<BusinessEntity | null>>;
}

// 3. Spam Reputation Provider Interface
export interface SpamReputationProvider {
  name: string;
  evaluateReputation(e164: string): Promise<ProviderResult<ReputationMetric>>;
}

// 4. Verification Provider Interface
export interface VerificationProvider {
  name: string;
  verifyIdentity(e164: string, claimedName: string): Promise<ProviderResult<{ isVerified: boolean; badge: string }>>;
}

// 5. Composite Unified Caller Data Provider
export interface CallerDataProvider {
  name: string;
  resolveCaller(rawNumber: string): Promise<ProviderResult<CallerIdentityEntity>>;
}
