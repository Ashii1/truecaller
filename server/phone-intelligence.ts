import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneIntelligenceResult = {
  found: boolean;
  source: string;
  e164: string;
  name?: string;
  carrier?: string;
  lineType?: string;
  country?: string;
  region?: string;
  city?: string;
  valid?: boolean;
  active?: boolean | null;
  spammer?: boolean | null;
  recentAbuse?: boolean | null;
  fraudScore?: number | null;
  risky?: boolean | null;
  confidence?: number;
};

/**
 * Server-side IPQualityScore adapter.
 *
 * The API key is deliberately read only from the server environment and is
 * never exposed to Android/web clients. If no key is configured, this returns
 * null so the application continues to use its local/community database.
 */
export async function lookupWithIpqs(rawNumber: string): Promise<PhoneIntelligenceResult | null> {
  const key = process.env.IPQS_API_KEY?.trim();
  if (!key) return null;

  const parsed = parsePhoneNumberFromString(String(rawNumber || '').trim(), 'US')
    || parsePhoneNumberFromString(`+${String(rawNumber || '').replace(/\D/g, '')}`);
  const e164 = parsed?.isValid()
    ? parsed.format('E.164')
    : `+${String(rawNumber || '').replace(/\D/g, '')}`;
  if (e164.length < 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const url = `https://www.ipqualityscore.com/api/json/phone/${encodeURIComponent(key)}/${encodeURIComponent(e164)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = await response.json() as Record<string, any>;
    if (data.success !== true) return null;

    const fraudScore = typeof data.fraud_score === 'number' ? data.fraud_score : null;
    const spammer = typeof data.spammer === 'boolean' ? data.spammer : null;
    const recentAbuse = typeof data.recent_abuse === 'boolean' ? data.recent_abuse : null;
    const risky = typeof data.risky === 'boolean' ? data.risky : null;

    return {
      found: true,
      source: 'IPQualityScore Phone Validation',
      e164: data.formatted || e164,
      name: data.name && data.name !== 'N/A' ? String(data.name) : undefined,
      carrier: data.carrier && data.carrier !== 'N/A' ? String(data.carrier) : undefined,
      lineType: data.line_type && data.line_type !== 'N/A' ? String(data.line_type) : undefined,
      country: data.country && data.country !== 'N/A' ? String(data.country) : undefined,
      region: data.region && data.region !== 'N/A' ? String(data.region) : undefined,
      city: data.city && data.city !== 'N/A' ? String(data.city) : undefined,
      valid: typeof data.valid === 'boolean' ? data.valid : undefined,
      active: typeof data.active === 'boolean' ? data.active : null,
      spammer,
      recentAbuse,
      fraudScore,
      risky,
      confidence: fraudScore === null ? 50 : Math.max(0, Math.min(100, 100 - fraudScore)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
