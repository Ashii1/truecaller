import express from 'express';
import { lookupWithIpqs } from './server/phone-intelligence';

/**
 * Installs a provider enrichment layer before the existing Express server is
 * loaded. This keeps the provider API key server-side and leaves the existing
 * local/community lookup as the fallback when the provider has no result.
 */
const originalGet = express.application.get;

express.application.get = function patchedGet(this: any, pathOrSetting: any, ...handlers: any[]) {
  if (typeof pathOrSetting === 'string' && pathOrSetting === '/api/lookup' && handlers.length > 0) {
    const originalHandler = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function enrichedLookup(req: any, res: any, next: any) {
      const query = String(req.query?.q || '').trim();
      if (query) {
        const external = await lookupWithIpqs(query);
        if (external?.found) {
          const riskScore = external.fraudScore ?? (external.spammer || external.recentAbuse ? 90 : 0);
          const spam = Boolean(external.spammer || external.recentAbuse || (external.fraudScore ?? 0) >= 90);
          return res.json({
            found: true,
            profile: {
              number: external.e164,
              name: external.name || 'Unknown Caller',
              classification: spam ? 'SPAM' : 'UNKNOWN',
              category: spam ? 'Spam / Abuse' : 'Unclassified Line',
              isVerified: false,
              riskScore,
              reportsCount: 0,
              confidence: external.confidence ?? 50,
              source: external.source,
              carrier: external.carrier || null,
              lineType: external.lineType || null,
              country: external.country || null,
              region: external.region || null,
              city: external.city || null,
              valid: external.valid ?? null,
              active: external.active ?? null,
              spammer: external.spammer ?? null,
              recentAbuse: external.recentAbuse ?? null,
            },
          });
        }
      }
      return originalHandler(req, res, next);
    };
  }

  return originalGet.call(this, pathOrSetting, ...handlers);
};

await import('./server');
