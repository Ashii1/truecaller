import { ContactItem, CallLogItem, CallShieldDirectoryProfile } from '../types';
import { isGenericOrPhoneNumber, PUBLIC_DIRECTORY_DATABASE } from './publicDirectory';

const CHAR_TO_T9: Record<string, string> = {
  a: '2', b: '2', c: '2',
  d: '3', e: '3', f: '3',
  g: '4', h: '4', i: '4',
  j: '5', k: '5', l: '5',
  m: '6', n: '6', o: '6',
  p: '7', q: '7', r: '7', s: '7',
  t: '8', u: '8', v: '8',
  w: '9', x: '9', y: '9', z: '9',
};

export function stringToT9(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => CHAR_TO_T9[ch] || '')
    .join('');
}

export function matchesT9Query(name: string, queryDigits: string): boolean {
  if (!queryDigits) return true;
  const words = name.toLowerCase().split(/\s+/);
  
  // Check if any word starts with or contains the T9 sequence
  for (const word of words) {
    const t9 = stringToT9(word);
    if (t9.includes(queryDigits)) {
      return true;
    }
  }

  // Also check full name concatenated
  const fullT9 = stringToT9(name);
  return fullT9.includes(queryDigits);
}

export interface SmartSearchResult {
  matchingContacts: ContactItem[];
  matchingRecents: CallLogItem[];
  possibleCaller?: CallShieldDirectoryProfile | null;
}

export function smartDialerSearch(
  input: string,
  contacts: ContactItem[],
  recentCalls: CallLogItem[],
  lookupProfileFn: (num: string) => CallShieldDirectoryProfile
): SmartSearchResult {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return {
      matchingContacts: [],
      matchingRecents: [],
      possibleCaller: null,
    };
  }

  const digitsOnly = cleanInput.replace(/\D/g, '');
  const isNumeric = /^[0-9*#+]+$/.test(cleanInput);

  // 1. Matching Contacts
  const matchingContacts = contacts.filter((c) => {
    // Number match
    const cDigits = c.number.replace(/\D/g, '');
    if (digitsOnly && cDigits.includes(digitsOnly)) return true;

    // Text query match
    if (!isNumeric && c.name.toLowerCase().includes(cleanInput.toLowerCase())) {
      return true;
    }

    // T9 match (e.g. 564 -> JOHN)
    if (isNumeric && digitsOnly.length >= 2) {
      if (matchesT9Query(c.name, digitsOnly)) {
        return true;
      }
    }

    return false;
  }).slice(0, 5);

  // 2. Matching Recents (Only if at least 3 digits typed or valid text search, and only calls with valid caller identity)
  const seenNumbers = new Set(matchingContacts.map((c) => c.number.replace(/\D/g, '')));
  const matchingRecents: CallLogItem[] = [];

  if (digitsOnly.length >= 3 || (!isNumeric && cleanInput.length >= 2)) {
    for (const call of recentCalls) {
      const callDigits = call.number.replace(/\D/g, '');
      if (!callDigits || seenNumbers.has(callDigits)) continue;

      const hasRealName = call.callerName && !isGenericOrPhoneNumber(call.callerName, call.number);
      const matchesDigits = digitsOnly.length >= 3 && callDigits.startsWith(digitsOnly);
      const matchesName = hasRealName && call.callerName!.toLowerCase().includes(cleanInput.toLowerCase());
      const matchesT9 = isNumeric && digitsOnly.length >= 3 && hasRealName && matchesT9Query(call.callerName!, digitsOnly);

      if (matchesDigits || matchesName || matchesT9) {
        matchingRecents.push(call);
        seenNumbers.add(callDigits);
        if (matchingRecents.length >= 3) break;
      }
    }
  }

  // 3. Possible Caller Lookup from public directories (strictly only if full 10+ digits or exact curated shortcode)
  let possibleCaller: CallShieldDirectoryProfile | null = null;
  const isCuratedShortCode = Boolean(PUBLIC_DIRECTORY_DATABASE[cleanInput] || (digitsOnly && PUBLIC_DIRECTORY_DATABASE[digitsOnly]));
  if (digitsOnly.length >= 10 || isCuratedShortCode) {
    const profile = lookupProfileFn(cleanInput);
    if (
      profile &&
      profile.name &&
      !isGenericOrPhoneNumber(profile.name, cleanInput)
    ) {
      possibleCaller = profile;
    }
  }

  return {
    matchingContacts,
    matchingRecents,
    possibleCaller,
  };
}
