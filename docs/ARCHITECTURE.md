# CallShield: System Architecture & Engineering Specification

This document details the production architecture, data models, API contracts, security mechanisms, platform differences, and caller identification pipelines for **CallShield**.

---

## A. System Architecture Diagram

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT PLATFORMS                                     |
|                                                                                         |
|  +---------------------------+  +----------------------------+  +--------------------+  |
|  |     Android Native OS     |  |       iOS Native OS        |  |  React Web / PWA   |  |
|  | - CallScreeningService    |  | - CXCallDirectoryProvider  |  | - Modern Dialer    |  |
|  | - Local Room SQLite Cache |  | - CoreData / SQLite Cache  |  | - T9 Search        |  |
|  | - STIR/SHAKEN Verification|  | - Periodic Extension Sync  |  | - Web Contacts API |  |
|  | - Background Worker Sync  |  | - System Settings Blocklist|  | - Offline Cache    |  |
|  +-------------+-------------+  +-------------+--------------+  +---------+----------+  |
+----------------┼------------------------------┼---------------------------┼-------------+
                 │                              │                           │
                 ▼                              ▼                           ▼
+-----------------------------------------------------------------------------------------+
|                                API GATEWAY & EDGE SECURITY                              |
| - Rate Limiter (Token Bucket / IP + Device ID)                                           |
| - HMAC Request Signing & CSRF Prevention                                                |
| - Zero Address-Book Upload Guard (Rejects payload containing address-book dumps)         |
+-------------------------------------------+---------------------------------------------+
                                            │
                                            ▼
+-----------------------------------------------------------------------------------------+
|                               BACKEND SERVICES (EXPRESS/NODE)                           |
|                                                                                         |
|  +-----------------------+  +-----------------------+  +-----------------------------+  |
|  | Caller Identity       |  | Reputation Engine     |  | Business Directory          |  |
|  | - Multi-Source Merger |  | - Time-Decay Scoring  |  | - Enterprise Verification   |  |
|  | - Confidence Scoring  |  | - Reporter Trust Rank |  | - Official Registry Mapping |  |
|  | - Disagreement Resolver| | - Cluster Pattern ML  |  | - Verified Badging Audits   |  |
|  +-----------+-----------+  +-----------+-----------+  +--------------+--------------+  |
|              │                          │                             │                 |
|  +-----------+-----------+  +-----------+-----------+  +--------------+--------------+  |
|  | Number Normalization  |  | Community Reports     |  | Abuse & Fraud Detection     |  |
|  | - E.164 / ITU Plan    |  | - Category Voting     |  | - Sybil Attack Prevention   |  |
|  | - Geographic Range    |  | - Dispute Management  |  | - Poisoning Detection       |  |
|  +-----------------------+  +-----------------------+  +-----------------------------+  |
+-------------------------------------------+---------------------------------------------+
                                            │
                                            ▼
+-----------------------------------------------------------------------------------------+
|                               PERSISTENCE & CACHE TIER                                  |
| - PostgreSQL / SQLite Relational Database (PhoneNumbers, Profiles, Reputation, Reports) |
| - Redis In-Memory Cache (Sub-5ms Query Cache for High-Frequency Telephony Lookups)      |
| - Local Device SQLite / IndexedDB (Offline Operation & Local Firewall Rules)            |
+-----------------------------------------------------------------------------------------+
```

---

## B. Data-Source Map

```
                            Incoming Call (+18005550199)
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      [Level 1: Local Device]                       [Level 2: Backend Cloud]
   1. User Local Contacts Store                  1. STIR/SHAKEN Attestation
      (100% Trust, Never Uploaded)               2. Carrier Verified CNAM
   2. Local Firewall Block Rules                 3. Regulatory Registries (TRAI/FTC)
      (Exact, Prefix, Regex, Ranges)             4. Verified Enterprise Profiles
   3. Device SQLite Identity Cache               5. Community Telemetry (Time-Decayed)
      (Offline Sub-millisecond Lookup)           6. Number Metadata (ITU E.164)
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
                           Multi-Provider Resolver
                            Confidence Calculation
                               Final Risk Score
                                 [0 to 100]
```

---

## C. Database Schema Specification

### 1. `phone_numbers`
```sql
CREATE TABLE phone_numbers (
    id VARCHAR(36) PRIMARY KEY,
    e164_number VARCHAR(20) NOT NULL UNIQUE,
    country_code VARCHAR(5) NOT NULL,
    national_number VARCHAR(15) NOT NULL,
    country_iso VARCHAR(2) NOT NULL,
    region VARCHAR(64),
    number_type VARCHAR(24), -- 'MOBILE', 'FIXED_LINE', 'VOIP', 'TOLL_FREE'
    carrier VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_phone_numbers_e164 ON phone_numbers(e164_number);
CREATE INDEX idx_phone_numbers_prefix ON phone_numbers(country_code, national_number);
```

### 2. `caller_profiles`
```sql
CREATE TABLE caller_profiles (
    id VARCHAR(36) PRIMARY KEY,
    phone_number_id VARCHAR(36) NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    display_name VARCHAR(128) NOT NULL,
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    business_name VARCHAR(128),
    profession VARCHAR(64),
    job_title VARCHAR(64),
    category VARCHAR(48) NOT NULL,
    photo_url TEXT,
    website TEXT,
    location VARCHAR(128),
    verification_status VARCHAR(24) DEFAULT 'UNVERIFIED', -- 'UNVERIFIED', 'PHONE_VERIFIED', 'ENTERPRISE_VERIFIED'
    identity_confidence VARCHAR(16) DEFAULT 'LOW',       -- 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'
    source VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_caller_profiles_phone ON caller_profiles(phone_number_id);
```

### 3. `business_profiles`
```sql
CREATE TABLE business_profiles (
    id VARCHAR(36) PRIMARY KEY,
    phone_number_id VARCHAR(36) NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    business_name VARCHAR(128) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description TEXT,
    address TEXT,
    city VARCHAR(64),
    region VARCHAR(64),
    country VARCHAR(2),
    website TEXT,
    logo_url TEXT,
    opening_hours JSONB,
    verified BOOLEAN DEFAULT FALSE,
    verification_source VARCHAR(64),
    last_verified_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_business_profiles_phone ON business_profiles(phone_number_id);
```

### 4. `reputations`
```sql
CREATE TABLE reputations (
    phone_number_id VARCHAR(36) PRIMARY KEY REFERENCES phone_numbers(id) ON DELETE CASCADE,
    risk_score INTEGER NOT NULL DEFAULT 0,       -- 0 to 100
    spam_score INTEGER NOT NULL DEFAULT 0,
    scam_score INTEGER NOT NULL DEFAULT 0,
    fraud_score INTEGER NOT NULL DEFAULT 0,
    telemarketing_score INTEGER NOT NULL DEFAULT 0,
    robocall_score INTEGER NOT NULL DEFAULT 0,
    safe_score INTEGER NOT NULL DEFAULT 100,
    report_count INTEGER NOT NULL DEFAULT 0,
    unique_reporter_count INTEGER NOT NULL DEFAULT 0,
    recent_report_count INTEGER NOT NULL DEFAULT 0, -- reports within last 14 days
    positive_feedback_count INTEGER NOT NULL DEFAULT 0,
    negative_feedback_count INTEGER NOT NULL DEFAULT 0,
    last_reported_at TIMESTAMP WITH TIME ZONE,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reputations_risk ON reputations(risk_score);
```

### 5. `reports`
```sql
CREATE TABLE reports (
    id VARCHAR(36) PRIMARY KEY,
    phone_number_id VARCHAR(36) NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    report_type VARCHAR(32) NOT NULL, -- 'SPAM', 'SCAM', 'TELEMARKETING', 'ROBOCALL', 'SAFE'
    category VARCHAR(48) NOT NULL,
    comment TEXT,
    confidence NUMERIC(3,2) DEFAULT 0.50,
    status VARCHAR(24) DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISPUTED', 'DISMISSED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reports_phone_user ON reports(phone_number_id, user_id);
```

---

## D. REST API Architecture (`/v1/*`)

| Endpoint | Method | Description | Security / Rate Limit |
|---|---|---|---|
| `/v1/phone-numbers/:number` | GET | Normalized number lookup + country plan details | Anonymous (60/min), Auth (300/min) |
| `/v1/caller-profile/:number` | GET | Comprehensive caller ID + confidence score | Rate-limited (Anti-enumeration) |
| `/v1/reputation/:number` | GET | Reputation metrics, risk score, report counts | Cached 15m |
| `/v1/business/:number` | GET | Verified business registration info | Cached 24h |
| `/v1/reports` | POST | Submit community spam/scam report | Auth required, anti-abuse checks |
| `/v1/caller-corrections` | POST | User reports incorrect caller name | Signed user token |
| `/v1/business-verification` | POST | Business registers for identity badge | Enterprise portal authentication |
| `/v1/number-feedback` | POST | Post-call binary feedback ("Safe" / "Spam") | One per unique call event |
| `/v1/block-rules` | GET/POST | Manage user's cloud-synced block rules | User Bearer JWT |
| `/v1/block-rules/:id` | DELETE | Remove block rule | User Bearer JWT |
| `/v1/user/protection-stats` | GET | Honest caller stats (screened, blocked, etc.) | User Bearer JWT |

---

## E. Real-Time Caller Identification Flow (16-Step Pipeline)

1. **Incoming Ring**: Mobile OS detects incoming network signaling (SIP INVITE or GSM Setup).
2. **OS Delegation**: Android `CallScreeningService` or iOS `CallDirectory` handles event.
3. **Number Extraction**: Raw incoming caller string extracted (`+18005550199` or private withheld).
4. **Normalization**: Canonical E.164 parsing via `libphonenumber`.
5. **Local Contact Check**: Check on-device address book. If match found: **ALLOW** immediately, label with contact name, bypass cloud.
6. **Local Firewall Check**: Test against local pattern rules (Exact, Prefix 140, Suffix, Regex, Private). If match: **REJECT/SILENCE** immediately.
7. **Local SQLite Cache**: Lookup pre-synced top 50,000 national spam signatures.
8. **Network Pre-Check**: Check if network available and if response latency budget permits (< 150ms).
9. **STIR/SHAKEN Check**: Read OS attestation header (PASSED = Full Attestation).
10. **Directory Synthesis**: Combine business profile, carrier CNAM, and regulatory register.
11. **Time-Decayed Reputation Score**: Calculate risk score [0 - 100].
12. **Confidence Assignment**: Rate identity confidence (High, Medium, Low, Unknown).
13. **Firewall Policy Action**: Evaluate user mode (Standard, Strict, Custom, Maximum). Action: `ALLOW`, `WARN`, `SILENCE`, or `BLOCK`.
14. **Screen Rendering**: Display high-contrast banner with reason (e.g. "Reported by 48 users").
15. **Call Log Record**: Log call event to local SQLite database.
16. **Post-Call Feedback**: Present user with "Not Spam", "Block", or "Add Contact" prompt.

---

## F. Reputation & Scoring Algorithm

The risk score $R$ is calculated on a scale of $0$ to $100$:

$$R = \min\left(100, \; w_b \cdot S_{burst} + \sum_{i=1}^{n} w_i \cdot T_i \cdot e^{-\lambda \Delta t_i} - B_{verified}\right)$$

Where:
- $T_i$: Base weight of report $i$ based on category (e.g., Scam = 35, Fraud = 30, Telemarketing = 15).
- $w_i$: Reporter trust score $(0.1 \le w_i \le 1.0)$.
- $e^{-\lambda \Delta t_i}$: Exponential time decay with half-life $t_{1/2} = 30$ days $(\lambda = \frac{\ln 2}{30 \times 86400})$.
- $S_{burst}$: Burst penalty multiplier $(1.0 \le S_{burst} \le 2.5)$ triggered when call velocity exceeds 30 reports/hr.
- $B_{verified}$: Negative risk offset for cryptographically verified enterprise callers $(-80)$.

**Score Bands**:
- `0 - 19`: **Very Safe** (Verified business, trusted carrier attestation, or clean tenure).
- `20 - 39`: **Low Risk** (Occasional uncorroborated report, stable personal number).
- `40 - 59`: **Unknown** (Insufficient independent telemetry).
- `60 - 74`: **Suspicious** (Recent reports of persistent marketing or robocall signatures).
- `75 - 89`: **High Risk** (Corroborated telemarketing or debt-collector spam).
- `90 - 100`: **Severe Risk** (Confirmed phishing, bank impersonation, or Wangiri fraud).

---

## G. Android vs iOS Capability Comparison

| Feature | Android (API 29+ / Android 10+) | iOS (CallKit / iOS 14+) |
|---|---|---|
| **Real-time screening hook** | `CallScreeningService` executes code for every call | `CXCallDirectoryProvider` writes pre-compiled database to OS |
| **Real-time network lookup** | Permitted within ~1-2 second OS deadline | **Not allowed**. Extension runs out-of-process in background |
| **Call blocking decision** | Real-time: Can reject, silence, or skip call log | Pre-computed: OS blocks numbers listed in extension database |
| **Caller ID Labeling** | In-call full screen HUD or floating overlay | Native OS Phone screen displays text label underneath number |
| **STIR/SHAKEN status** | Accessible via `Call.Details.getCallerVerificationStatus()` | Managed internally by iOS carrier profiles |
| **Memory limit** | Standard app sandbox (~192MB) | Strict extension limit: **< 5 MB RAM** |

---

## H. Permission Matrix

| Permission | Android Identifier | iOS Identifier | Purpose | Optional / Required |
|---|---|---|---|---|
| **Call Screening Role** | `RoleManager.ROLE_CALL_SCREENING` | `CXCallDirectoryManager` | Core call screening and automated blocking | **Required** for auto-blocking |
| **Contacts** | `android.permission.READ_CONTACTS` | `NSContactsUsageDescription` | Local contact matching to prioritize friends/family | **Optional** (App works without) |
| **Phone State** | `android.permission.READ_PHONE_STATE` | CallKit Framework | Identify SIM slot for Dual-SIM cards | **Optional** |
| **Call Log** | `android.permission.READ_CALL_LOG` | CallKit Call History API | Populate in-app Recents call history | **Optional** (Internal history kept) |
| **Notifications** | `android.permission.POST_NOTIFICATIONS` | `UNUserNotificationCenter` | Alert user when high-risk scam was silently blocked | **Optional** |
| **Microphone** | `android.permission.RECORD_AUDIO` | `NSMicrophoneUsageDescription` | Legal call recording when explicitly activated by user | **Optional** (Explicit user action) |

---

## I. Privacy & Data Retention Plan

1. **Address Book Exemption**: Address book contacts are processed exclusively within client memory. No contact names, numbers, or emails are ever sent to CallShield servers.
2. **Hashing in Transit**: Number queries can be transmitted using k-anonymity (prefix-hashed SHA-256) where client queries `SHA256(e164)[:8]` and receives a small bucket of candidates to filter locally.
3. **Data Deletion**: Users can delete their profile, dispute reports, or wipe local cache at any time via the Privacy Center.
4. **Audit Trails**: All business verification approvals and rule modifications are logged with immutable cryptographic timestamps.
