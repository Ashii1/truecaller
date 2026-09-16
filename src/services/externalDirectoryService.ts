/**
 * ExternalDirectoryService
 * Fetches live caller names from public API endpoints, maintains a multi-tiered
 * cache, and synchronizes accurate caller identities directly into the local 'calls' list.
 */

import { CallLogItem } from '../types';
import { resolveFromPublicDirectory } from '../utils/publicDirectory';
import { normalizePhoneNumber, resolveNumberMetadata } from '../utils/spamEngine';

export interface ExternalCallerResult {
  number: string;
  normalizedNumber: string;
  callerName: string;
  carrier?: string;
  location?: string;
  lineType?: string;
  isSpam: boolean;
  spamCategory?: string;
  spamScore: number;
  isVerified?: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  cachedAt: number;
}

const LOCAL_STORAGE_CACHE_KEY = 'vigilshield_external_directory_cache';
const CALLS_STORAGE_KEY = 'vigilshield_calls';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class ExternalDirectoryService {
  private memoryCache: Map<string, ExternalCallerResult> = new Map();
  private pendingRequests: Map<string, Promise<ExternalCallerResult>> = new Map();
  private isStorageLoaded = false;

  constructor() {
    this.loadPersistentCache();
  }

  /**
   * Load persistent cache from localStorage
   */
  private loadPersistentCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
      if (raw) {
        const parsed: Record<string, ExternalCallerResult> = JSON.parse(raw);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, item]) => {
          if (item && now - item.cachedAt < CACHE_TTL_MS) {
            this.memoryCache.set(key, item);
          }
        });
      }
      this.isStorageLoaded = true;
    } catch (e) {
      console.warn('Failed to load ExternalDirectoryCache from localStorage:', e);
    }
  }

  /**
   * Save memory cache to localStorage
   */
  private persistCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, ExternalCallerResult> = {};
      this.memoryCache.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to persist ExternalDirectoryCache to localStorage:', e);
    }
  }

  /**
   * Retrieves an already cached caller identity if available and valid
   */
  public getCachedCaller(phoneNumber: string): ExternalCallerResult | null {
    if (!this.isStorageLoaded) {
      this.loadPersistentCache();
    }
    const cleanKey = phoneNumber.replace(/\D/g, '');
    const norm = normalizePhoneNumber(phoneNumber);

    const hit = this.memoryCache.get(cleanKey) || this.memoryCache.get(norm);
    if (!hit) return null;

    if (Date.now() - hit.cachedAt > CACHE_TTL_MS) {
      this.memoryCache.delete(cleanKey);
      this.memoryCache.delete(norm);
      this.persistCache();
      return null;
    }

    return hit;
  }

  /**
   * Saves a caller result into memory and persistent cache
   */
  public setCachedCaller(phoneNumber: string, result: ExternalCallerResult): void {
    const cleanKey = phoneNumber.replace(/\D/g, '');
    const norm = normalizePhoneNumber(phoneNumber);

    this.memoryCache.set(cleanKey, result);
    this.memoryCache.set(norm, result);
    this.persistCache();
  }

  /**
   * Queries existing local 'calls' list to check if an accurate caller name is already cached
   */
  public getCallerNameFromLocalCalls(phoneNumber: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const rawCalls = localStorage.getItem(CALLS_STORAGE_KEY);
      if (!rawCalls) return null;

      const calls: CallLogItem[] = JSON.parse(rawCalls);
      const digits = phoneNumber.replace(/\D/g, '');
      const clean10 = digits.length >= 10 ? digits.slice(-10) : digits;

      const matched = calls.find((c) => {
        const cDigits = (c.number || '').replace(/\D/g, '');
        return cDigits === digits || (clean10 && cDigits.endsWith(clean10));
      });

      if (
        matched &&
        matched.callerName &&
        matched.callerName.trim() !== '' &&
        matched.callerName.replace(/\D/g, '') !== digits &&
        !matched.callerName.toLowerCase().includes('unknown') &&
        !matched.callerName.toLowerCase().includes('caller (cellular)')
      ) {
        return matched.callerName;
      }
    } catch (e) {
      console.warn('Error reading caller name from local calls:', e);
    }
    return null;
  }

  /**
   * Caches and synchronizes the resolved caller name directly in the local 'calls' list.
   * This immediately elevates the display accuracy of recents and call logs.
   */
  public cacheResultInLocalCalls(
    phoneNumber: string,
    callerName: string,
    meta?: {
      carrier?: string;
      location?: string;
      isSpam?: boolean;
      riskScore?: number;
      spamCategory?: any;
      isVerifiedBusiness?: boolean;
    }
  ): boolean {
    if (typeof window === 'undefined' || !phoneNumber || !callerName) return false;

    try {
      const raw = localStorage.getItem(CALLS_STORAGE_KEY);
      if (!raw) return false;

      const calls: CallLogItem[] = JSON.parse(raw);
      const digits = phoneNumber.replace(/\D/g, '');
      const clean10 = digits.length >= 10 ? digits.slice(-10) : digits;

      let hasModifications = false;
      const updatedCalls = calls.map((c) => {
        const cDigits = (c.number || '').replace(/\D/g, '');
        const isMatch = cDigits === digits || (clean10.length >= 7 && cDigits.endsWith(clean10));

        if (isMatch) {
          // Check if the callerName needs improvement
          const currentIsGeneric =
            !c.callerName ||
            c.callerName === c.number ||
            c.callerName.replace(/\D/g, '') === digits ||
            c.callerName.toLowerCase().includes('unknown') ||
            c.callerName.toLowerCase().includes('caller (cellular)');

          if (currentIsGeneric || c.callerName !== callerName) {
            hasModifications = true;
            return {
              ...c,
              callerName,
              carrier: meta?.carrier || c.carrier,
              location: meta?.location || c.location,
              isSpam: meta?.isSpam !== undefined ? meta.isSpam : c.isSpam,
              riskScore: meta?.riskScore !== undefined ? meta.riskScore : c.riskScore,
              spamCategory: meta?.spamCategory !== undefined ? meta.spamCategory : c.spamCategory,
              isVerifiedBusiness:
                meta?.isVerifiedBusiness !== undefined ? meta.isVerifiedBusiness : c.isVerifiedBusiness,
            };
          }
        }
        return c;
      });

      if (hasModifications) {
        localStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(updatedCalls));

        // Dispatch a custom event so React components (like App.tsx) can re-render immediately
        const event = new CustomEvent('vigilshield_calls_updated', {
          detail: updatedCalls,
        });
        window.dispatchEvent(event);
        return true;
      }
    } catch (e) {
      console.warn('Failed to cache caller result in local calls list:', e);
    }
    return false;
  }

  /**
   * Fetches live caller names from a public API endpoint.
   * If network fails or is rate-limited, safely falls back to crowd-sourced public directory.
   */
  public async fetchLiveCallerName(
    phoneNumber: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ExternalCallerResult> {
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    const norm = normalizePhoneNumber(phoneNumber);

    // 1. Return cached if available and not forced
    if (!options?.forceRefresh) {
      const cached = this.getCachedCaller(phoneNumber);
      if (cached) return cached;
    }

    // 2. Prevent duplicate concurrent requests for the same number
    if (this.pendingRequests.has(cleanDigits)) {
      return this.pendingRequests.get(cleanDigits)!;
    }

    const requestPromise = (async (): Promise<ExternalCallerResult> => {
      const meta = resolveNumberMetadata(phoneNumber);
      let liveResult: ExternalCallerResult | null = null;

      // 3. Attempt live lookup from public API endpoints
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        // We attempt a public telephone verification and directory lookup endpoint
        const encodedPhone = encodeURIComponent(norm.startsWith('+') ? norm : `+${cleanDigits}`);
        const publicEndpoint = `https://api.veriphone.io/v2/verify?phone=${encodedPhone}`;

        const response = await fetch(publicEndpoint, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data && data.status === 'success') {
            const detectedCarrier = data.carrier || meta.carrier;
            const detectedRegion = data.phone_region || meta.location;
            const lineType = data.phone_type || 'Mobile';

            // Resolve name from public directory or data
            const resolvedPublic = resolveFromPublicDirectory(phoneNumber, detectedRegion, detectedCarrier);
            const liveName = data.caller_name || data.company || resolvedPublic.name;

            liveResult = {
              number: phoneNumber,
              normalizedNumber: norm,
              callerName: liveName,
              carrier: detectedCarrier,
              location: detectedRegion,
              lineType: lineType,
              isSpam: resolvedPublic.isSpam,
              spamCategory: resolvedPublic.spamCategory,
              spamScore: resolvedPublic.spamScore,
              isVerified: resolvedPublic.isVerified,
              confidence: 'HIGH',
              source: 'Public Directory API (Live Veriphone & Telecom Node)',
              cachedAt: Date.now(),
            };
          }
        }
      } catch {
        // Fall through on network errors, CORS restrictions, or timeouts
      }

      // 4. Fallback to public crowd-sourced directory resolution
      if (!liveResult) {
        const publicRecord = resolveFromPublicDirectory(phoneNumber, meta.location, meta.carrier);
        liveResult = {
          number: phoneNumber,
          normalizedNumber: norm,
          callerName: publicRecord.name,
          carrier: publicRecord.carrier || meta.carrier,
          location: publicRecord.location || meta.location,
          lineType: publicRecord.lineType || 'Mobile',
          isSpam: publicRecord.isSpam,
          spamCategory: publicRecord.spamCategory,
          spamScore: publicRecord.spamScore,
          isVerified: publicRecord.isVerified,
          confidence: publicRecord.isVerified ? 'HIGH' : 'MEDIUM',
          source: 'Public Directory Registry (Community Verified)',
          cachedAt: Date.now(),
        };
      }

      // 5. Store in persistent cache
      this.setCachedCaller(phoneNumber, liveResult);

      // 6. Cache into the local 'calls' list to improve display accuracy
      this.cacheResultInLocalCalls(phoneNumber, liveResult.callerName, {
        carrier: liveResult.carrier,
        location: liveResult.location,
        isSpam: liveResult.isSpam,
        riskScore: liveResult.spamScore,
        spamCategory: liveResult.spamCategory,
        isVerifiedBusiness: liveResult.isVerified,
      });

      return liveResult;
    })();

    this.pendingRequests.set(cleanDigits, requestPromise);
    try {
      const res = await requestPromise;
      return res;
    } finally {
      this.pendingRequests.delete(cleanDigits);
    }
  }

  /**
   * Batch enriches any calls in the local calls list that have missing or generic caller names
   */
  public async batchEnrichLocalCalls(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CALLS_STORAGE_KEY);
      if (!raw) return;

      const calls: CallLogItem[] = JSON.parse(raw);
      const uniqueNumbers = Array.from(
        new Set(
          calls
            .filter((c) => {
              const digits = c.number.replace(/\D/g, '');
              return (
                !c.callerName ||
                c.callerName === c.number ||
                c.callerName.replace(/\D/g, '') === digits ||
                c.callerName.toLowerCase().includes('unknown')
              );
            })
            .map((c) => c.number)
        )
      );

      for (const num of uniqueNumbers.slice(0, 10)) {
        await this.fetchLiveCallerName(num);
      }
    } catch (e) {
      console.warn('Batch call enrichment error:', e);
    }
  }
}

export const externalDirectoryService = new ExternalDirectoryService();
