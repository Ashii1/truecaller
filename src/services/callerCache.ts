/**
 * CallerCache (Issue 27)
 * Multi-tier caching architecture:
 * Tier 1: In-Memory Map (Instantaneous synchronous access for incoming calls)
 * Tier 2: Local Storage Persistence (Survives app restarts)
 * Tier 3: Network Backend Synchronization
 */

export interface CachedCaller {
  number: string; // Normalized E.164
  name: string;
  type: 'CONTACT' | 'BUSINESS' | 'USER_PROFILE' | 'TELEMARKETER' | 'SPAM' | 'UNKNOWN';
  source: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  risk: number;
  updatedAt: number;
  expiresAt: number;
  isVerified?: boolean;
  businessName?: string;
  category?: string;
  carrier?: string;
  location?: string;
}

const CACHE_STORAGE_KEY = 'vigilshield_caller_cache_v2';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class CallerCacheService {
  private memoryCache: Map<string, CachedCaller> = new Map();
  private isLoadedFromStorage = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, CachedCaller> = JSON.parse(raw);
        const now = Date.now();
        Object.entries(parsed).forEach(([key, item]) => {
          if (item && item.expiresAt > now) {
            this.memoryCache.set(key, item);
          }
        });
      }
      this.isLoadedFromStorage = true;
    } catch (e) {
      console.warn('Failed to load CallerCache from storage:', e);
    }
  }

  private persistToStorage() {
    if (typeof window === 'undefined') return;
    try {
      const obj: Record<string, CachedCaller> = {};
      this.memoryCache.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('Failed to persist CallerCache to storage:', e);
    }
  }

  /**
   * Retrieves caller from cache. Returns null if not found or expired.
   */
  public get(e164: string): CachedCaller | null {
    if (!this.isLoadedFromStorage) {
      this.loadFromStorage();
    }
    const cleanKey = (e164 || '').trim();
    const entry = this.memoryCache.get(cleanKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(cleanKey);
      this.persistToStorage();
      return null;
    }

    return entry;
  }

  /**
   * Caches a legitimate caller identity record
   */
  public set(entry: Omit<CachedCaller, 'expiresAt'> & { ttlMs?: number }): void {
    const cleanKey = (entry.number || '').trim();
    if (!cleanKey) return;

    const ttl = entry.ttlMs || DEFAULT_TTL_MS;
    const fullEntry: CachedCaller = {
      ...entry,
      expiresAt: Date.now() + ttl,
    };

    this.memoryCache.set(cleanKey, fullEntry);
    this.persistToStorage();
  }

  public delete(e164: string): void {
    const cleanKey = (e164 || '').trim();
    this.memoryCache.delete(cleanKey);
    this.persistToStorage();
  }

  public clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_STORAGE_KEY);
    }
  }

  public size(): number {
    return this.memoryCache.size;
  }

  public getAll(): CachedCaller[] {
    return Array.from(this.memoryCache.values());
  }
}

export const callerCache = new CallerCacheService();
