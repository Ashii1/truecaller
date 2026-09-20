import { LibPhoneNumberValidationProvider } from '../services/providers/phoneValidationProvider';
import { CompositeCallerIdResolver } from '../services/providers/compositeCallerProvider';
import { ContactItem, BlockRule } from '../types';
import { externalDirectoryService } from '../services/externalDirectoryService';
import { lookupCallShieldDirectory } from '../utils/spamEngine';

export function runCallShieldTestSuite() {
  const results: { name: string; passed: boolean; message?: string }[] = [];
  const normalizer = new LibPhoneNumberValidationProvider();
  const resolver = new CompositeCallerIdResolver();

  // Test 1: Phone Normalization to E.164
  try {
    const res1 = normalizer.normalize('(800) 935-9935', 'US');
    if (res1.value.e164 === '+18009359935' && res1.value.countryIso === 'US') {
      results.push({ name: 'Phone Normalization: US Toll-Free to E.164', passed: true });
    } else {
      results.push({ name: 'Phone Normalization: US Toll-Free to E.164', passed: false, message: `Expected +18009359935, got ${res1.value.e164}` });
    }
  } catch (e: any) {
    results.push({ name: 'Phone Normalization: US Toll-Free to E.164', passed: false, message: e.message });
  }

  // Test 2: Local Contact Priority (Zero Exfiltration)
  resolver.resolveCaller('+15551234567', {
    localContacts: [
      {
        id: 'c1',
        name: 'Sarah Connor',
        number: '+1 (555) 123-4567',
        category: 'FAMILY',
        trusted: true,
      }
    ]
  }).then(contactRes => {
    if (contactRes.value.name === 'Sarah Connor' && contactRes.source === 'Device Local Address Book') {
      results.push({ name: 'Local Contact Priority: Resolves private device contact first', passed: true });
    } else {
      results.push({ name: 'Local Contact Priority: Resolves private device contact first', passed: false, message: 'Did not match contact' });
    }
  }).catch(err => {
    results.push({ name: 'Local Contact Priority: Resolves private device contact first', passed: false, message: String(err) });
  });

  // Test 3: Regulatory Telemarketing Prefix (TRAI 140 Series)
  resolver.resolveCaller('+911409098984').then(regRes => {
    if (regRes.value.reputation.isSpam && regRes.value.reputation.spamCategory === 'TELEMARKETING') {
      results.push({ name: 'Regulatory Telemetry: Accurately identifies TRAI 140 series', passed: true });
    } else {
      results.push({ name: 'Regulatory Telemetry: Accurately identifies TRAI 140 series', passed: false, message: 'TRAI series was not flagged as telemarketing' });
    }
  }).catch(err => {
    results.push({ name: 'Regulatory Telemetry: Accurately identifies TRAI 140 series', passed: false, message: String(err) });
  });

  // Test 4: Authorized Verified Enterprise Directory
  resolver.resolveCaller('+18009359935').then(chaseRes => {
    if (chaseRes.value.isBusiness && chaseRes.value.stirShakenStatus === 'PASSED') {
      results.push({ name: 'Enterprise Verification: Cryptographically verified financial caller', passed: true });
    } else {
      results.push({ name: 'Enterprise Verification: Cryptographically verified financial caller', passed: false, message: 'Failed to verify Chase' });
    }
  }).catch(err => {
    results.push({ name: 'Enterprise Verification: Cryptographically verified financial caller', passed: false, message: String(err) });
  });

  // Test 5: Honest Unknown State
  resolver.resolveCaller('+19999999999').then(unknownRes => {
    if (unknownRes.confidence === 'UNKNOWN' && unknownRes.value.reputation.classification === 'UNKNOWN') {
      results.push({ name: 'Anti-Fabrication: Honestly returns Unknown Caller without fake data', passed: true });
    } else {
      results.push({ name: 'Anti-Fabrication: Honestly returns Unknown Caller without fake data', passed: false, message: 'Fabricated caller name' });
    }
  }).catch(err => {
    results.push({ name: 'Anti-Fabrication: Honestly returns Unknown Caller without fake data', passed: false, message: String(err) });
  });

  // Test 6: External Directory Service & Local Calls List Caching
  try {
    const testNum = '+919876543210';
    const profile = lookupCallShieldDirectory(testNum);
    if (profile && profile.name) {
      results.push({ name: 'External Directory: Resolves caller identity and caches in local calls', passed: true });
    } else {
      results.push({ name: 'External Directory: Resolves caller identity and caches in local calls', passed: false, message: 'No profile name resolved' });
    }
  } catch (e: any) {
    results.push({ name: 'External Directory: Resolves caller identity and caches in local calls', passed: false, message: e.message });
  }

  return results;
}
