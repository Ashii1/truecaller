import { ContactItem, CallLogItem, IncomingCallState } from '../types';

/**
 * Neighbor Spoof & Ping-Back Shield Engine
 * 
 * 1. Neighbor Spoofing:
 *    Attackers spoof the first 6 digits (area code + exchange) of the victim's phone number
 *    to make the call look like a local neighbor or local business.
 * 
 * 2. Wangiri (1-Ring Ping-Back Scam):
 *    Automated dialers ring for 1-3 seconds and hang up, tricking victims into calling
 *    back premium-rate numbers that charge exorbitant per-minute toll fees.
 */

export interface NeighborSpoofResult {
  isNeighborSpoof: boolean;
  userPrefixMatched?: string;
  confidence: number;
  reason: string;
  warningMessage?: string;
}

export interface PingBackResult {
  isPingBackScam: boolean;
  confidence: number;
  reason: string;
  warningMessage?: string;
}

/**
 * Normalizes digits strictly for prefix comparison
 */
export function extractDigits(num: string): string {
  return (num || '').replace(/\D/g, '');
}

/**
 * Extracts the local neighborhood prefix (area code + central exchange)
 * E.g.
 * US NANP 10-digit: "4155551234" -> "415555" (first 6 digits)
 * US NANP 11-digit: "14155551234" -> "415555"
 * India 10-digit: "9876543210" -> "98765" (first 5 digits circle prefix)
 * India 12-digit: "919876543210" -> "98765"
 */
export function getNeighborhoodPrefix(phone: string): string {
  const digits = extractDigits(phone);
  if (!digits) return '';

  // NANP 11-digit starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1, 7);
  }
  // NANP 10-digit
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return digits.slice(0, 6);
  }
  // India 12-digit starting with 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2, 7);
  }
  // India 10-digit starting with 6-9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return digits.slice(0, 5);
  }

  // Generic fallback: first 5-6 digits
  return digits.slice(0, Math.min(6, Math.max(3, Math.floor(digits.length * 0.6))));
}

/**
 * Checks if incoming number matches the user's neighborhood prefix but is absent from contacts
 */
export function detectNeighborSpoof(
  incomingNumber: string,
  userPhoneNumberOrPrefix: string | undefined,
  contacts: (ContactItem | string)[]
): NeighborSpoofResult {
  if (!incomingNumber) {
    return { isNeighborSpoof: false, confidence: 0, reason: '', warningMessage: '' };
  }

  const incomingDigits = extractDigits(incomingNumber);
  if (incomingDigits.length < 7) {
    return { isNeighborSpoof: false, confidence: 0, reason: '', warningMessage: '' };
  }

  // If already a known saved contact, it's a real person the user knows
  const isSavedContact = (contacts || []).some((c) => {
    const raw = typeof c === 'string' ? c : c.number;
    const cd = extractDigits(raw);
    return cd.length >= 7 && (incomingDigits.endsWith(cd) || cd.endsWith(incomingDigits));
  });

  if (isSavedContact) {
    return { isNeighborSpoof: false, confidence: 0, reason: 'Verified saved contact', warningMessage: '' };
  }

  const userPrefix = userPhoneNumberOrPrefix ? getNeighborhoodPrefix(userPhoneNumberOrPrefix) : '';
  if (!userPrefix || userPrefix.length < 4) {
    return { isNeighborSpoof: false, confidence: 0, reason: '', warningMessage: '' };
  }

  const incomingPrefix = getNeighborhoodPrefix(incomingNumber);

  if (incomingPrefix && userPrefix && incomingPrefix === userPrefix) {
    const reason = `Shares your local prefix (${userPrefix}) but is not saved in contacts. Common neighbor spoofing pattern.`;
    return {
      isNeighborSpoof: true,
      userPrefixMatched: userPrefix,
      confidence: 88,
      reason,
      warningMessage: reason,
    };
  }

  return { isNeighborSpoof: false, confidence: 0, reason: '', warningMessage: '' };
}

/**
 * Detects Wangiri 1-Ring Ping-Back Scam Patterns
 */
export function detectPingBackScam(
  callOrNumber:
    | string
    | {
        number: string;
        type?: string;
        durationSeconds?: number;
        isSpam?: boolean;
        spamCategory?: string;
      },
  durationSeconds?: number,
  missedFlag?: number | boolean
): PingBackResult {
  const call =
    typeof callOrNumber === 'string'
      ? {
          number: callOrNumber,
          durationSeconds: durationSeconds ?? 0,
          type: missedFlag ? 'MISSED' : 'INCOMING',
        }
      : callOrNumber;

  const digits = extractDigits(call.number);
  const isMissedOrDropped =
    call.type === 'MISSED' ||
    Boolean(missedFlag) ||
    (call.durationSeconds !== undefined && call.durationSeconds <= 4 && call.durationSeconds > 0);

  // High risk international prefixes known for Wangiri toll fraud
  // e.g. +232 (Sierra Leone), +247 (Ascension), +269 (Comoros), +216 (Tunisia), +678 (Vanuatu), +685 (Samoa), +881 (Global Satellite)
  const isSuspiciousInternational =
    digits.startsWith('232') ||
    digits.startsWith('247') ||
    digits.startsWith('269') ||
    digits.startsWith('216') ||
    digits.startsWith('678') ||
    digits.startsWith('685') ||
    digits.startsWith('881') ||
    digits.startsWith('882');

  if (isMissedOrDropped && isSuspiciousInternational) {
    const reason = '1-Ring Wangiri Trap: Dropped call from high-risk international prefix. Calling back incurs massive toll charges.';
    return {
      isPingBackScam: true,
      confidence: 96,
      reason,
      warningMessage: reason,
    };
  }

  if (
    (call.type === 'MISSED' || Boolean(missedFlag)) &&
    (call.durationSeconds ?? 0) <= 2 &&
    (call.isSpam || call.spamCategory === 'SCAM')
  ) {
    const reason = '1-Ring Callback Trap: Spammer disconnected immediately to bait a return call.';
    return {
      isPingBackScam: true,
      confidence: 90,
      reason,
      warningMessage: reason,
    };
  }

  return { isPingBackScam: false, confidence: 0, reason: '', warningMessage: '' };
}

/**
 * Standard Carrier Privacy Prefixes for Caller ID Suppression:
 * *67  - North America (NANP US / Canada)
 * #31# - GSM Standard (India, Europe, Latin America, Southeast Asia)
 * 141  - United Kingdom
 * 1831 - Japan
 */
export const PRIVACY_PREFIX_OPTIONS = [
  { code: '*67', region: 'North America (US / Canada / NANP)', sample: '*67 555-123-4567' },
  { code: '#31#', region: 'Worldwide GSM / India / Europe', sample: '#31# 98765 43210' },
  { code: '141', region: 'United Kingdom / Ireland', sample: '141 07911 123456' },
  { code: '*31#', region: 'Australia / New Zealand', sample: '*31# 0412 345 678' },
];

/**
 * Returns the dialed number with private caller ID prefix applied
 */
export function formatPrivateCallNumber(targetNumber: string, prefix = '*67'): string {
  const rawTarget = (targetNumber || '').trim().replace(/[\s\-()]/g, '');
  if (!rawTarget) return '';

  const cleanPrefix = (prefix || '*67').trim();
  // Avoid double prefixing
  if (rawTarget.startsWith(cleanPrefix)) {
    return rawTarget;
  }
  return `${cleanPrefix}${rawTarget}`;
}
