import { CallLogItem } from '../types';
import { normalizePhoneNumber } from './spamEngine';

/** Stable grouping key: ignores spaces, punctuation and local formatting differences. */
export function callGroupKey(number: string): string {
  const normalized = normalizePhoneNumber(number || '');
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export interface CallGroup {
  key: string;
  number: string;
  name: string;
  calls: CallLogItem[];
  latest: CallLogItem;
  missedCount: number;
  totalCount: number;
}

export function groupCallsByNumber(calls: CallLogItem[]): CallGroup[] {
  const map = new Map<string, CallGroup>();
  for (const call of calls) {
    const key = callGroupKey(call.number);
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.calls.push(call);
      existing.totalCount += 1;
      if (call.type === 'MISSED') existing.missedCount += 1;
      if (call.timestamp > existing.latest.timestamp) {
        existing.latest = call;
        existing.number = call.number || existing.number;
        if (call.callerName && call.callerName !== call.number) existing.name = call.callerName;
      }
    } else {
      map.set(key, {
        key,
        number: call.number,
        name: call.callerName || call.number || 'Unknown caller',
        calls: [call],
        latest: call,
        missedCount: call.type === 'MISSED' ? 1 : 0,
        totalCount: 1,
      });
    }
  }
  return [...map.values()]
    .map(group => ({ ...group, calls: [...group.calls].sort((a, b) => b.timestamp - a.timestamp) }))
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}
