import { parsePhoneNumberFromString, CountryCode, PhoneNumber } from 'libphonenumber-js';

export interface NormalizedPhone {
  e164: string;
  nationalNumber: string;
  countryCode: string;
  countryIso: string;
  isValid: boolean;
  isPossible: boolean;
  formatted: string;
  type: 'MOBILE' | 'FIXED_LINE' | 'VOIP' | 'TOLL_FREE' | 'PAGER' | 'UNKNOWN';
}

class PhoneNumberNormalizerService {
  /**
   * Normalizes any input telephone number string using libphonenumber-js.
   * Handles international prefixes (+91, +1), national prefixes (0), and regional formatting.
   */
  public normalize(raw: string, defaultCountry: string = 'US'): NormalizedPhone {
    const cleaned = (raw || '').trim();
    if (!cleaned) {
      return {
        e164: '',
        nationalNumber: '',
        countryCode: '',
        countryIso: defaultCountry.toUpperCase(),
        isValid: false,
        isPossible: false,
        formatted: '',
        type: 'UNKNOWN',
      };
    }

    try {
      const parsed = parsePhoneNumberFromString(cleaned, defaultCountry.toUpperCase() as CountryCode);
      if (parsed) {
        let typeMapped: NormalizedPhone['type'] = 'UNKNOWN';
        const parsedType = parsed.getType();
        if (parsedType === 'MOBILE') typeMapped = 'MOBILE';
        else if (parsedType === 'FIXED_LINE') typeMapped = 'FIXED_LINE';
        else if (parsedType === 'VOIP') typeMapped = 'VOIP';
        else if (parsedType === 'TOLL_FREE') typeMapped = 'TOLL_FREE';
        else if (parsedType === 'PAGER') typeMapped = 'PAGER';

        return {
          e164: parsed.format('E.164'),
          nationalNumber: parsed.nationalNumber,
          countryCode: String(parsed.countryCallingCode),
          countryIso: parsed.country || defaultCountry.toUpperCase(),
          isValid: parsed.isValid(),
          isPossible: parsed.isPossible(),
          formatted: parsed.formatInternational(),
          type: typeMapped,
        };
      }
    } catch {
      // Fallback below
    }

    // Fallback for emergency or special service numbers (e.g. 911, 100, 198, 140 series)
    const digitsOnly = cleaned.replace(/\D/g, '');
    const isPrefixedWithPlus = cleaned.startsWith('+');
    const e164 = isPrefixedWithPlus ? `+${digitsOnly}` : digitsOnly.length === 10 ? `+1${digitsOnly}` : `+${digitsOnly}`;

    return {
      e164: e164 || cleaned,
      nationalNumber: digitsOnly,
      countryCode: digitsOnly.length === 10 ? '1' : '',
      countryIso: defaultCountry.toUpperCase(),
      isValid: false,
      isPossible: digitsOnly.length >= 3,
      formatted: cleaned,
      type: 'UNKNOWN',
    };
  }

  /**
   * Returns canonical E.164 string (+1234567890)
   */
  public toE164(raw: string, defaultCountry: string = 'US'): string {
    return this.normalize(raw, defaultCountry).e164;
  }

  /**
   * Compares two numbers for semantic equality according to regional numbering rules.
   * Accurately matches:
   * "+91 98765 43210", "+919876543210", and "9876543210"
   */
  public isEqual(rawA: string, rawB: string, defaultCountry: string = 'US'): boolean {
    if (!rawA || !rawB) return false;
    if (rawA.trim() === rawB.trim()) return true;

    const normA = this.normalize(rawA, defaultCountry);
    const normB = this.normalize(rawB, defaultCountry);

    if (normA.e164 && normB.e164 && normA.e164 === normB.e164) {
      return true;
    }

    // Compare national numbers if both are valid
    if (normA.nationalNumber && normB.nationalNumber && normA.nationalNumber === normB.nationalNumber) {
      return true;
    }

    // Compare raw digit extraction (e.g. 10-digit suffix matching)
    const digitsA = rawA.replace(/\D/g, '');
    const digitsB = rawB.replace(/\D/g, '');
    if (digitsA === digitsB) return true;

    if (digitsA.length >= 10 && digitsB.length >= 10) {
      return digitsA.slice(-10) === digitsB.slice(-10);
    }

    return false;
  }

  /**
   * Formats a phone number cleanly for human display
   */
  public formatDisplay(raw: string, defaultCountry: string = 'US'): string {
    const norm = this.normalize(raw, defaultCountry);
    return norm.formatted || raw;
  }

  /**
   * Checks if number is an emergency or high-priority service number
   */
  public isSpecialOrEmergency(raw: string): boolean {
    const digits = (raw || '').replace(/\D/g, '');
    return ['911', '112', '999', '100', '101', '102', '108', '198', '121'].includes(digits);
  }
}

export const phoneNumberNormalizer = new PhoneNumberNormalizerService();
