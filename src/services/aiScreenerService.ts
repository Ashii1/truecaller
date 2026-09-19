import { ScreeningTranscriptEntry } from '../types';

export interface ScreenerSummaryResult {
  summaryBullets: string[];
  fullSummary: string;
  keyIntent?: string;
  source: string;
}

export interface ScreenerSummaryRequest {
  number: string;
  callerName?: string;
  transcript: ScreeningTranscriptEntry[];
  detectedIntent?: string;
  durationSeconds?: number;
  riskScore?: number;
  spamCategory?: string;
}

/**
 * Generates a short, high-fidelity bulleted summary of spoken content
 * for calls that used the AI voice screener.
 * Uses the server-side Gemini API (/api/screened-call-summary) with an intelligent
 * fallback engine to guarantee offline/local resilience.
 */
export async function generateScreeningSummary(
  params: ScreenerSummaryRequest
): Promise<ScreenerSummaryResult> {
  const { number, callerName, transcript, detectedIntent, durationSeconds, riskScore, spamCategory } = params;

  try {
    const res = await fetch('/api/screened-call-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number,
        callerName,
        transcript,
        detectedIntent,
        durationSeconds: durationSeconds || Math.max(12, transcript.length * 5),
        riskScore,
        spamCategory,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.summaryBullets) && data.summaryBullets.length > 0) {
        return {
          summaryBullets: data.summaryBullets,
          fullSummary: data.fullSummary || data.summaryBullets.join(' '),
          keyIntent: data.keyIntent || detectedIntent,
          source: data.source || 'gemini_ai_screener',
        };
      }
    }
  } catch (e) {
    console.warn('Network call to /api/screened-call-summary failed, using local summarizer:', e);
  }

  // Robust Client-Side Fallback Summarizer
  return generateLocalScreeningSummary(params);
}

/**
 * Intelligent local heuristic summarizer that extracts key spoken content
 * from the transcript into 2-4 concise bullets.
 */
export function generateLocalScreeningSummary(
  params: ScreenerSummaryRequest
): ScreenerSummaryResult {
  const { callerName, transcript, detectedIntent, riskScore } = params;
  const callerLines = (transcript || []).filter((t) => t.sender === 'caller').map((t) => t.text.trim());
  const assistantLines = (transcript || []).filter((t) => t.sender === 'assistant' || t.sender === 'user').map((t) => t.text.trim());
  const combinedCaller = callerLines.join(' ');

  const bullets: string[] = [];

  // Bullet 1: Identity of speaker
  if (/card fraud|bank|unauthorized transaction/i.test(combinedCaller)) {
    bullets.push('Caller claimed to represent bank card fraud prevention regarding an urgent transaction alert.');
  } else if (/courier|delivery|package|parcel|shipment/i.test(combinedCaller)) {
    bullets.push('Caller identified as a courier delivery agent regarding a parcel awaiting recipient signature.');
  } else if (/utility|contractor|maintenance|neighborhood/i.test(combinedCaller)) {
    bullets.push('Caller presented as a local utility contractor offering unscheduled local service/inspection.');
  } else if (callerName && !/unknown/i.test(callerName)) {
    bullets.push(`Caller identified themselves as or on behalf of ${callerName}.`);
  } else if (callerLines.length > 0) {
    bullets.push('Unverified caller connected and engaged with the automated AI screener.');
  } else {
    bullets.push('Call was answered by the AI screener; no audible caller speech was recorded.');
  }

  // Bullet 2: Spoken Intent & Claims
  const amountMatch = combinedCaller.match(/\$[\d,]+|\b\d+\s?dollars\b/i);
  if (amountMatch) {
    bullets.push(`Spoke regarding an unverified transaction amount of ${amountMatch[0]} and requested immediate confirmation.`);
  } else if (/signature/i.test(combinedCaller)) {
    bullets.push('Informed the recipient that an in-person physical signature is required for delivery.');
  } else if (/meeting|discussion|follow-up/i.test(combinedCaller)) {
    bullets.push('Stated the purpose was a follow-up inquiry regarding an existing scheduled appointment or discussion.');
  } else if (callerLines[0]) {
    const cleanSnippet = callerLines[0].length > 95 ? callerLines[0].slice(0, 92) + '...' : callerLines[0];
    bullets.push(`Stated purpose: "${cleanSnippet}"`);
  }

  // Bullet 3: Interaction outcome / security flag
  if (assistantLines.some((l) => /remove|later|meeting|text message/i.test(l))) {
    bullets.push('Assistant delivered user reply preference; caller acknowledged and concluded the exchange.');
  } else if ((riskScore || 0) >= 70 || /fraud|scam/i.test(detectedIntent || '')) {
    bullets.push('AI screener captured high-risk impersonation speech signals and preserved spoken transcript.');
  } else {
    bullets.push('Screening completed with transcript preserved alongside call log history.');
  }

  return {
    summaryBullets: bullets,
    fullSummary: bullets.join(' '),
    keyIntent: detectedIntent || 'Voice Screener Spoken Content',
    source: 'on_device_heuristic_screener',
  };
}

export interface CallerDialogueRequest {
  callerNumber: string;
  callerName?: string;
  callerLatestSpeech: string;
  transcript: ScreeningTranscriptEntry[];
  riskScore?: number;
  spamCategory?: string;
}

export interface CallerDialogueResponse {
  aiAssistantSpeech: string;
  detectedIntent: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedUserReplies: string[];
  source: string;
}

/**
 * Sends caller speech to the server-side Gemini conversational assistant.
 * Returns dynamic, intelligent spoken response and contextually tailored suggested replies.
 */
export async function getAiCallerDialogue(
  req: CallerDialogueRequest
): Promise<CallerDialogueResponse> {
  try {
    const res = await fetch('/api/caller-assistant/dialogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.aiAssistantSpeech) {
        return {
          aiAssistantSpeech: data.aiAssistantSpeech,
          detectedIntent: data.detectedIntent || 'Spoken Screening',
          riskLevel: data.riskLevel || 'LOW',
          suggestedUserReplies: Array.isArray(data.suggestedUserReplies) ? data.suggestedUserReplies : [],
          source: data.source || 'gemini_conversational_assistant',
        };
      }
    }
  } catch (err) {
    console.warn('Network call to /api/caller-assistant/dialogue failed, using local dialogue fallback:', err);
  }

  // Fallback if network or server unavailable
  const lower = (req.callerLatestSpeech || '').toLowerCase();
  let aiSpeech = "Thank you. Could you please specify who is calling and what this is regarding?";
  let intent = "Identity Inquiry";
  let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let suggested = [
    "I'll take the call now.",
    "Please send a text message.",
    "The recipient is currently unavailable.",
  ];

  if (/delivery|package|courier|fedex|ups|amazon|dhl|parcel/i.test(lower)) {
    aiSpeech = "Thanks for letting us know. Please leave the package at the front door or with reception.";
    intent = "Parcel Delivery Arrival";
    suggested = ["Leave it by the door.", "Give it to reception.", "I'll be there in 2 minutes."];
  } else if (/bank|fraud|unauthorized|card|account|security alert|credit/i.test(lower)) {
    aiSpeech = "The cardholder does not confirm account credentials on incoming calls. Please state your reference ticket.";
    intent = "Bank Transaction Verification";
    risk = 'HIGH';
    suggested = ["I'll call the bank directly.", "Which account is this?", "Block and report number."];
  } else if (/loan|rate|mortgage|insurance|offer|crypto/i.test(lower)) {
    aiSpeech = "We are not interested in commercial solicitations. Please remove this number from your list.";
    intent = "Telemarketing Promotion";
    risk = 'HIGH';
    suggested = ["Do not call again.", "Remove my number.", "Hang up."];
  }

  return {
    aiAssistantSpeech: aiSpeech,
    detectedIntent: intent,
    riskLevel: risk,
    suggestedUserReplies: suggested,
    source: 'local_conversational_fallback',
  };
}
