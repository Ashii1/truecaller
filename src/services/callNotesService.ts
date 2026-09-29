/**
 * CallNotesService:
 * Authoritative, lifecycle-safe synchronization service for per-call session notes.
 *
 * Rules:
 * 1. Notes MUST be strictly bound to the exact CallSessionID (CallLogItem.id),
 *    never solely to the phone number, preventing notes from leaking across repeat calls.
 * 2. Notes written during active calls, post-call modals, or in call history are instantly
 *    persisted and survive app minimization, lock/unlock, navigation, and backgrounding.
 */

type NotesListener = (notes: Record<string, string>) => void;

const STORAGE_KEY_V2 = 'vigilshield_call_instance_notes_v2';
const LEGACY_EVENT_KEY = 'vigilshield_call_event_notes_v1';

class CallNotesService {
  private notesCache: Record<string, string> = {};
  private listeners: Set<NotesListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;
    try {
      // Load primary instance-bound notes
      const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
      if (rawV2) {
        this.notesCache = JSON.parse(rawV2) || {};
      }

      // Merge legacy event-keyed notes if not already present
      const rawLegacy = localStorage.getItem(LEGACY_EVENT_KEY);
      if (rawLegacy) {
        const legacyObj = JSON.parse(rawLegacy) || {};
        let modified = false;
        for (const [callId, note] of Object.entries(legacyObj)) {
          if (note && typeof note === 'string' && !this.notesCache[callId]) {
            this.notesCache[callId] = note;
            modified = true;
          }
        }
        if (modified) {
          this.persist();
        }
      }
    } catch (e) {
      console.warn('[CallNotesService] Error loading notes:', e);
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(this.notesCache));
      // Keep legacy synchronized for backward compatibility
      localStorage.setItem(LEGACY_EVENT_KEY, JSON.stringify(this.notesCache));
    } catch (e) {
      console.warn('[CallNotesService] Error persisting notes:', e);
    }
    this.notify();
  }

  private notify() {
    const snapshot = { ...this.notesCache };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  /**
   * Retrieves the exact note attached to this call instance ID.
   */
  public getNoteForCall(callId?: string | null): string {
    if (!callId) return '';
    return this.notesCache[callId] || '';
  }

  /**
   * Saves or updates a note strictly for this call instance ID.
   */
  public saveNoteForCall(callId: string, note: string): void {
    if (!callId) return;
    const trimmed = (note || '').trim();
    if (trimmed) {
      this.notesCache[callId] = trimmed;
    } else {
      delete this.notesCache[callId];
    }
    this.persist();
  }

  /**
   * Deletes note for a specific call session.
   */
  public deleteNoteForCall(callId: string): void {
    if (!callId) return;
    delete this.notesCache[callId];
    this.persist();
  }

  /**
   * Returns all current instance notes.
   */
  public getAllCallNotes(): Record<string, string> {
    return { ...this.notesCache };
  }

  /**
   * Subscribes to note updates.
   */
  public subscribe(listener: NotesListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.notesCache });
    return () => this.listeners.delete(listener);
  }
}

export const callNotesService = new CallNotesService();
