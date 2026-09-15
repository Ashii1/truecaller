import { CallLogItem, SmsItem, WhitelistEntry } from '../types';
import { screenEvent, saveCustomDirectoryName } from './spamEngine';
import { BlockRule, ShieldSettings } from '../types';

/**
 * Parses vCard (.vcf) format into Contacts / Whitelist
 */
export function parseVCard(vcfText: string): WhitelistEntry[] {
  const entries: WhitelistEntry[] = [];
  const cards = vcfText.split(/BEGIN:VCARD/i).slice(1);

  for (const card of cards) {
    const fnMatch = card.match(/FN:(.+)/i);
    const nMatch = card.match(/N:(.+)/i);
    const telMatches = [...card.matchAll(/TEL[^:]*:(.+)/gi)];

    const name = fnMatch ? fnMatch[1].trim() : (nMatch ? nMatch[1].replace(/;/g, ' ').trim() : 'Contact');
    for (const tel of telMatches) {
      const rawNum = tel[1].trim();
      if (rawNum) {
        entries.push({
          id: `vcf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name,
          value: rawNum,
          notes: 'Imported from device vCard (.vcf)',
          createdAt: Date.now(),
        });
      }
    }
  }

  return entries;
}

/**
 * Parses CSV call log files
 * Expected headers or columns: number/phone, name/caller, type (in/out/missed/blocked), timestamp/date, duration
 */
export function parseCallLogCsv(
  csvText: string,
  rules: BlockRule[],
  whitelist: WhitelistEntry[],
  settings: ShieldSettings
): CallLogItem[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
  const numIdx = headers.findIndex((h) => h.includes('number') || h.includes('phone') || h.includes('tel'));
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('caller'));
  const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('direction'));
  const durIdx = headers.findIndex((h) => h.includes('dur'));
  const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('time'));

  const parsedItems: CallLogItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
    if (row.length === 0) continue;

    const rawNumber = numIdx !== -1 && row[numIdx] ? row[numIdx] : row[0] || '';
    if (!rawNumber) continue;

    const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : 'Unknown';
    const rawType = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toUpperCase() : 'INCOMING';
    const duration = durIdx !== -1 && row[durIdx] ? parseInt(row[durIdx], 10) || 0 : 0;
    const dateVal = dateIdx !== -1 && row[dateIdx] ? new Date(row[dateIdx]).getTime() || (Date.now() - i * 3600000) : (Date.now() - i * 3600000);

    let type: CallLogItem['type'] = 'INCOMING';
    if (rawType.includes('OUT')) type = 'OUTGOING';
    else if (rawType.includes('MISS')) type = 'MISSED';
    else if (rawType.includes('BLOCK') || rawType.includes('CANCEL') || rawType.includes('REJECT')) type = 'BLOCKED_CANCELLED';

    // Screen each imported call with Spam Engine!
    const screenRes = screenEvent({
      type: 'CALL',
      sender: rawNumber,
      rules,
      whitelist,
      settings,
    });

    parsedItems.push({
      id: `imported-call-${Date.now()}-${i}`,
      number: rawNumber,
      callerName: screenRes.callerName || name,
      type: screenRes.isBlocked ? 'BLOCKED_CANCELLED' : type,
      timestamp: dateVal,
      durationSeconds: duration,
      isSpam: screenRes.isBlocked,
      spamCategory: screenRes.category,
      spamReason: screenRes.reason,
      riskScore: screenRes.riskScore,
      reportsCount: screenRes.reportsCount,
      carrier: screenRes.carrier,
      location: screenRes.location,
    });
  }

  return parsedItems;
}

/**
 * Parses XML call logs (e.g. from Android 'SMS Backup & Restore' or 'Super Backup')
 * Format: <call number="..." duration="..." date="..." type="..." contact_name="..." />
 */
export function parseCallLogXml(
  xmlText: string,
  rules: BlockRule[],
  whitelist: WhitelistEntry[],
  settings: ShieldSettings
): CallLogItem[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const callElements = xmlDoc.getElementsByTagName('call');
  const parsedItems: CallLogItem[] = [];

  for (let i = 0; i < callElements.length; i++) {
    const el = callElements[i];
    const number = el.getAttribute('number') || '';
    if (!number) continue;

    const contactName = el.getAttribute('contact_name') || el.getAttribute('name') || '';
    const dateStr = el.getAttribute('date');
    const timestamp = dateStr ? parseInt(dateStr, 10) || Date.now() - i * 3600000 : Date.now() - i * 3600000;
    const duration = parseInt(el.getAttribute('duration') || '0', 10) || 0;
    const rawType = el.getAttribute('type') || '1';

    let type: CallLogItem['type'] = 'INCOMING';
    if (rawType === '2' || rawType.toLowerCase().includes('out')) type = 'OUTGOING';
    else if (rawType === '3' || rawType.toLowerCase().includes('miss')) type = 'MISSED';
    else if (rawType === '5' || rawType === '6' || rawType.toLowerCase().includes('reject') || rawType.toLowerCase().includes('block')) type = 'BLOCKED_CANCELLED';

    // Screen each call with Truecaller Spam Engine
    const screenRes = screenEvent({
      type: 'CALL',
      sender: number,
      rules,
      whitelist,
      settings,
    });

    const isSpam = screenRes.isBlocked;

    parsedItems.push({
      id: `xml-call-${Date.now()}-${i}`,
      number,
      callerName: screenRes.callerName || contactName || number,
      type: isSpam ? 'BLOCKED_CANCELLED' : type,
      timestamp,
      durationSeconds: duration,
      isSpam,
      labelVerdict: isSpam ? 'SPAM' : 'NOT_SPAM',
      spamCategory: screenRes.category,
      spamReason: screenRes.reason,
      riskScore: screenRes.riskScore,
      reportsCount: screenRes.reportsCount,
      carrier: screenRes.carrier,
      location: screenRes.location,
    });
  }

  return parsedItems;
}

/**
 * Extracts and screens phone numbers from any freeform pasted text
 * (e.g. copied from phone call history, dialer, text messages, or a list of numbers)
 */
export function parseRawNumbersText(
  rawText: string,
  rules: BlockRule[],
  whitelist: WhitelistEntry[],
  settings: ShieldSettings
): CallLogItem[] {
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\+?\d{7,15}/;
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const itemsToProcess: { number: string; explicitName?: string }[] = [];
  const processedNumbers = new Set<string>();

  // First pass: line-by-line check for number + name pairs
  for (const line of lines) {
    const match = line.match(phoneRegex);
    if (match) {
      const num = match[0].trim();
      const digits = num.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15 && !processedNumbers.has(num)) {
        processedNumbers.add(num);
        // Look for text outside the phone match as a potential caller name
        const textWithoutNum = line.replace(num, '').replace(/^[,\-–—:\t\s]+|[,\-–—:\t\s]+$/g, '').trim();
        if (textWithoutNum && textWithoutNum.length >= 2 && !/^\d+$/.test(textWithoutNum)) {
          // User gave a specific caller name (e.g. from Truecaller!)
          saveCustomDirectoryName(num, textWithoutNum);
          itemsToProcess.push({ number: num, explicitName: textWithoutNum });
        } else {
          itemsToProcess.push({ number: num });
        }
      }
    }
  }

  // Fallback: If no lines matched line-by-line, scan entire text for all numbers
  if (itemsToProcess.length === 0) {
    const globalPhoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\+?\d{7,15}/g;
    const allMatches: string[] = rawText.match(globalPhoneRegex) || [];
    allMatches.forEach((m: string) => {
      const trimmed = m.trim();
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15 && !processedNumbers.has(trimmed)) {
        processedNumbers.add(trimmed);
        itemsToProcess.push({ number: trimmed });
      }
    });
  }

  const parsedItems: CallLogItem[] = [];

  itemsToProcess.forEach(({ number: num, explicitName }, index) => {
    // Screen each extracted number
    const screenRes = screenEvent({
      type: 'CALL',
      sender: num,
      rules,
      whitelist,
      settings,
    });

    const isSpam = screenRes.isBlocked;
    const finalName = explicitName || screenRes.callerName || num;

    parsedItems.push({
      id: `pasted-call-${Date.now()}-${index}`,
      number: num,
      callerName: finalName,
      type: isSpam ? 'BLOCKED_CANCELLED' : 'INCOMING',
      timestamp: Date.now() - (index + 1) * (1000 * 60 * 18), // staggered times
      durationSeconds: isSpam ? 0 : Math.floor(Math.random() * 180) + 15,
      isSpam,
      labelVerdict: isSpam ? 'SPAM' : 'NOT_SPAM',
      spamCategory: screenRes.category,
      spamReason: screenRes.reason,
      riskScore: screenRes.riskScore,
      reportsCount: screenRes.reportsCount,
      carrier: screenRes.carrier,
      location: screenRes.location,
    });
  });

  return parsedItems;
}

/**
 * Parses JSON call log or SMS export
 */
export function parseJsonBackup(
  jsonText: string,
  rules: BlockRule[],
  whitelist: WhitelistEntry[],
  settings: ShieldSettings
): { calls: CallLogItem[]; sms: SmsItem[]; whitelist: WhitelistEntry[] } {
  try {
    const data = JSON.parse(jsonText);
    const calls: CallLogItem[] = [];
    const sms: SmsItem[] = [];
    const wl: WhitelistEntry[] = [];

    if (Array.isArray(data.calls)) {
      data.calls.forEach((c: any, idx: number) => {
        const num = c.number || c.sender || '';
        if (num) {
          const res = screenEvent({ type: 'CALL', sender: num, rules, whitelist, settings });
          calls.push({
            id: c.id || `call-${Date.now()}-${idx}`,
            number: num,
            callerName: c.callerName || c.name || res.callerName || num,
            type: c.type || (res.isBlocked ? 'BLOCKED_CANCELLED' : 'INCOMING'),
            timestamp: c.timestamp || Date.now() - idx * 600000,
            durationSeconds: c.durationSeconds || 0,
            isSpam: res.isBlocked || !!c.isSpam,
            spamCategory: res.category || c.spamCategory,
            spamReason: res.reason || c.spamReason,
            riskScore: res.riskScore || c.riskScore || 0,
            reportsCount: res.reportsCount || c.reportsCount || 0,
            carrier: res.carrier,
            location: res.location,
          });
        }
      });
    }

    if (Array.isArray(data.sms)) {
      data.sms.forEach((s: any, idx: number) => {
        const sender = s.sender || s.number || '';
        const body = s.body || s.message || '';
        const res = screenEvent({ type: 'SMS', sender, messageBody: body, rules, whitelist, settings });
        sms.push({
          id: s.id || `sms-${Date.now()}-${idx}`,
          sender,
          senderName: s.senderName || sender,
          body,
          timestamp: s.timestamp || Date.now() - idx * 600000,
          isSpam: res.isBlocked || !!s.isSpam,
          category: res.isBlocked ? 'SPAM' : s.category || 'INBOX',
          riskScore: res.riskScore || 0,
          spamReason: res.reason,
          extractedUrls: s.extractedUrls || [],
        });
      });
    }

    if (Array.isArray(data.whitelist)) {
      wl.push(...data.whitelist);
    }

    return { calls, sms, whitelist: wl };
  } catch {
    return { calls: [], sms: [], whitelist: [] };
  }
}
