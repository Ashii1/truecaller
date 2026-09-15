import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';
import { 
  PhoneNumberValidationProvider, 
  NormalizedNumberMetadata, 
  ProviderResult 
} from './types';

export class LibPhoneNumberValidationProvider implements PhoneNumberValidationProvider {
  name = 'ITU-T / Google libphonenumber Provider';

  normalize(rawNumber: string, defaultCountry: string = 'US'): ProviderResult<NormalizedNumberMetadata> {
    const cleaned = (rawNumber || '').trim();
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry as CountryCode);

    if (!parsed) {
      // Fallback for unparseable strings
      const digitsOnly = cleaned.replace(/\D/g, '');
      const isLikelyUS = digitsOnly.length === 10;
      const e164 = cleaned.startsWith('+') ? cleaned : isLikelyUS ? `+1${digitsOnly}` : `+${digitsOnly}`;

      return {
        value: {
          e164: e164 || rawNumber,
          countryCode: isLikelyUS ? '1' : '',
          nationalNumber: digitsOnly,
          countryIso: isLikelyUS ? 'US' : 'UNKNOWN',
          numberType: 'UNKNOWN',
          isValid: false,
          isPossible: digitsOnly.length >= 7,
        },
        confidence: 'LOW',
        source: 'libphonenumber-fallback',
        canDisplayToUser: true,
        cacheTtlSeconds: 86400 * 30,
        timestamp: Date.now(),
      };
    }

    let typeMapped: NormalizedNumberMetadata['numberType'] = 'UNKNOWN';
    const parsedType = parsed.getType();
    if (parsedType === 'MOBILE') typeMapped = 'MOBILE';
    else if (parsedType === 'FIXED_LINE') typeMapped = 'FIXED_LINE';
    else if (parsedType === 'VOIP') typeMapped = 'VOIP';
    else if (parsedType === 'TOLL_FREE') typeMapped = 'TOLL_FREE';
    else if (parsedType === 'PAGER') typeMapped = 'PAGER';

    return {
      value: {
        e164: parsed.format('E.164'),
        countryCode: String(parsed.countryCallingCode),
        nationalNumber: parsed.nationalNumber,
        countryIso: parsed.country || 'UNKNOWN',
        numberType: typeMapped,
        region: parsed.country,
        isValid: parsed.isValid(),
        isPossible: parsed.isPossible(),
      },
      confidence: parsed.isValid() ? 'HIGH' : 'MEDIUM',
      source: 'ITU-T E.164 Recommendation Database',
      attribution: 'libphonenumber (Apache 2.0)',
      canDisplayToUser: true,
      cacheTtlSeconds: 86400 * 60, // 60 days
      timestamp: Date.now(),
    };
  }
}
