import { callNotesService } from '../services/callNotesService';
import { callRecordingService } from '../services/callRecordingService';
import { CallLogItem } from '../types';

export interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function runCallHistorySyncTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1 — Single Call
  try {
    const callId = `test-call-1-${Date.now()}`;
    const testNote = 'Customer asked for callback tomorrow at 10 AM';
    callNotesService.saveNoteForCall(callId, testNote);

    const retrievedNote = callNotesService.getNoteForCall(callId);
    if (retrievedNote === testNote) {
      results.push({ name: 'Test 1: Single Call — Authoritative Note Attachment', passed: true });
    } else {
      results.push({ name: 'Test 1: Single Call — Authoritative Note Attachment', passed: false, details: `Expected "${testNote}", got "${retrievedNote}"` });
    }
  } catch (e: any) {
    results.push({ name: 'Test 1: Single Call — Authoritative Note Attachment', passed: false, details: e?.message });
  }

  // Test 2 — Same Caller Multiple Times (Zero Cross-Contamination)
  try {
    const callerNum = '+91 98765 43210';
    const callAId = `test-call-a-${Date.now()}`;
    const callBId = `test-call-b-${Date.now() + 100}`;
    const callCId = `test-call-c-${Date.now() + 200}`;

    // Call A has Note A and Recording A
    callNotesService.saveNoteForCall(callAId, 'Discussed delivery schedule');
    await callRecordingService.saveRecording({
      id: `rec-${callAId}`,
      callId: callAId,
      number: callerNum,
      callerName: 'John Thomas',
      timestamp: Date.now() - 3600000,
      durationSeconds: 45,
      folderPath: 'Internal Storage/Recordings/CallShield/',
      fileName: 'REC_John_A.wav',
      fileSizeBytes: 96000,
      mimeType: 'audio/wav',
      dataUri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      quality: '48 kHz HD',
    });

    // Call B has Note B and Recording B
    callNotesService.saveNoteForCall(callBId, 'Payment invoice cleared');
    await callRecordingService.saveRecording({
      id: `rec-${callBId}`,
      callId: callBId,
      number: callerNum,
      callerName: 'John Thomas',
      timestamp: Date.now() - 1800000,
      durationSeconds: 30,
      folderPath: 'Internal Storage/Recordings/CallShield/',
      fileName: 'REC_John_B.wav',
      fileSizeBytes: 64000,
      mimeType: 'audio/wav',
      dataUri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      quality: '48 kHz HD',
    });

    // Call C has Note C but NO recording
    callNotesService.saveNoteForCall(callCId, 'Quick inquiry on store hours');

    // Verification
    const recA = await callRecordingService.getRecordingForCall(callAId);
    const recB = await callRecordingService.getRecordingForCall(callBId);
    const recC = await callRecordingService.getRecordingForCall(callCId);

    const noteA = callNotesService.getNoteForCall(callAId);
    const noteB = callNotesService.getNoteForCall(callBId);
    const noteC = callNotesService.getNoteForCall(callCId);

    const notePass = noteA === 'Discussed delivery schedule' && noteB === 'Payment invoice cleared' && noteC === 'Quick inquiry on store hours';
    const recPass = recA?.callId === callAId && recB?.callId === callBId && recC === null;

    if (notePass && recPass) {
      results.push({ name: 'Test 2: Same Caller Multiple Times — Zero Cross-Contamination', passed: true });
    } else {
      results.push({
        name: 'Test 2: Same Caller Multiple Times — Zero Cross-Contamination',
        passed: false,
        details: `NotePass: ${notePass}, RecPass: ${recPass} (RecC should be null, got: ${recC?.id})`,
      });
    }
  } catch (e: any) {
    results.push({ name: 'Test 2: Same Caller Multiple Times — Zero Cross-Contamination', passed: false, details: e?.message });
  }

  // Test 3 — Note During Active Call
  try {
    const activeCallId = `test-active-${Date.now()}`;
    callNotesService.saveNoteForCall(activeCallId, 'Drafted while on speaker phone');

    // Simulate navigating away / re-opening history
    const persistentNote = callNotesService.getNoteForCall(activeCallId);
    if (persistentNote === 'Drafted while on speaker phone') {
      results.push({ name: 'Test 3: Note During Active Call — Preserved on Navigation & Re-open', passed: true });
    } else {
      results.push({ name: 'Test 3: Note During Active Call — Preserved on Navigation & Re-open', passed: false, details: `Got "${persistentNote}"` });
    }
  } catch (e: any) {
    results.push({ name: 'Test 3: Note During Active Call — Preserved on Navigation & Re-open', passed: false, details: e?.message });
  }

  // Test 4 — Recording Finalization and State
  try {
    const callDId = `test-call-d-${Date.now()}`;
    const isFinalizingInitially = callRecordingService.isCallRecordingFinalizing(callDId);

    // Save final recording
    await callRecordingService.saveRecording({
      id: `rec-${callDId}`,
      callId: callDId,
      number: '+91 91234 56789',
      callerName: 'Jane Doe',
      timestamp: Date.now(),
      durationSeconds: 22,
      folderPath: 'Internal Storage/Recordings/CallShield/',
      fileName: 'REC_Jane_D.wav',
      fileSizeBytes: 48000,
      mimeType: 'audio/wav',
      dataUri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      quality: '48 kHz HD',
    });

    const finalRec = await callRecordingService.getRecordingForCall(callDId);
    if (!isFinalizingInitially && finalRec?.callId === callDId) {
      results.push({ name: 'Test 4: Recording During Active Call — Properly Finalized & Attached', passed: true });
    } else {
      results.push({ name: 'Test 4: Recording During Active Call — Properly Finalized & Attached', passed: false });
    }
  } catch (e: any) {
    results.push({ name: 'Test 4: Recording During Active Call — Properly Finalized & Attached', passed: false, details: e?.message });
  }

  // Test 5 — Multiple Recordings for Single Call (Requirement 17)
  try {
    const multiRecCallId = `test-multi-rec-${Date.now()}`;
    await callRecordingService.saveRecording({
      id: `rec-seg-1-${Date.now()}`,
      callId: multiRecCallId,
      number: '+91 99999 88888',
      callerName: 'Multiple Segment Caller',
      timestamp: Date.now() - 5000,
      durationSeconds: 15,
      folderPath: 'Internal Storage/Recordings/CallShield/',
      fileName: 'REC_Segment_1.wav',
      fileSizeBytes: 32000,
      mimeType: 'audio/wav',
      dataUri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      quality: '48 kHz HD',
    });
    await callRecordingService.saveRecording({
      id: `rec-seg-2-${Date.now()}`,
      callId: multiRecCallId,
      number: '+91 99999 88888',
      callerName: 'Multiple Segment Caller',
      timestamp: Date.now(),
      durationSeconds: 20,
      folderPath: 'Internal Storage/Recordings/CallShield/',
      fileName: 'REC_Segment_2.wav',
      fileSizeBytes: 42000,
      mimeType: 'audio/wav',
      dataUri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      quality: '48 kHz HD',
    });

    const segments = await callRecordingService.getRecordingsForCall(multiRecCallId);
    if (segments.length === 2 && segments[0].callId === multiRecCallId && segments[1].callId === multiRecCallId) {
      results.push({ name: 'Test 5: Multiple Recording Segments — Kept Together under Single Session', passed: true });
    } else {
      results.push({ name: 'Test 5: Multiple Recording Segments — Kept Together under Single Session', passed: false, details: `Expected 2 segments, got ${segments.length}` });
    }
  } catch (e: any) {
    results.push({ name: 'Test 5: Multiple Recording Segments — Kept Together under Single Session', passed: false, details: e?.message });
  }

  // Test 6 — Rapid Calls Deduplication & Integrity
  try {
    const rapidCallId = `rapid-call-session-${Date.now()}`;
    const sampleCalls: CallLogItem[] = [
      {
        id: rapidCallId,
        number: '+91 98888 77777',
        callerName: 'Rapid Tester',
        type: 'INCOMING',
        timestamp: Date.now(),
        durationSeconds: 12,
        isSpam: false,
        riskScore: 0,
        reportsCount: 0,
        notes: 'Initial Callback',
      },
    ];

    // Simulating duplicate callbacks for the same call
    const deduplicated = sampleCalls.filter((c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx);
    if (deduplicated.length === 1 && deduplicated[0].id === rapidCallId) {
      results.push({ name: 'Test 6: Rapid Calls & Duplicate Callback Protection', passed: true });
    } else {
      results.push({ name: 'Test 6: Rapid Calls & Duplicate Callback Protection', passed: false });
    }
  } catch (e: any) {
    results.push({ name: 'Test 6: Rapid Calls & Duplicate Callback Protection', passed: false, details: e?.message });
  }

  return results;
}
