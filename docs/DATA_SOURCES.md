# VigilShield: Caller ID & Reputation Data Sources Specification

This document provides a comprehensive, legally compliant, and technically rigorous inventory of every legitimate data source used by the **VigilShield** platform for caller identification, business directory resolution, spam detection, and number validation.

VigilShield strictly adheres to:
1. **Zero Scraping Policy**: We do not scrape search engines, social media networks, or proprietary caller ID services.
2. **Zero Address Book Upload**: User contact books are never uploaded or synced to our servers. All contact-matching occurs strictly on the local client device.
3. **Multi-Source Confidence**: Caller identity is resolved by synthesizing independent signals, each with explicit confidence weighting, cryptographic validation, and transparent attribution.

---

## 1. Data Sources Master Matrix

| Source Identifier | Data Type | Official Provider / Standard | Auth & Protocol | Pricing / Limits | Geographic Scope | Update Frequency | Confidence Rating | Cache TTL | Attribution Required |
|---|---|---|---|---|---|---|---|---|---|
| `stir_shaken` | Cryptographic Caller ID Verification | ATIS-1000074 / FCC STIR-SHAKEN Framework | X.509 PKI / SIP `Identity` Header / RFC 8224 | Free (Carrier OS Level) | US, Canada, expanding global | Real-time per call | **Highest (99%)** | None (Ephemeral per call) | Yes (e.g. "Carrier Verified") |
| `cnam_carrier` | Calling Name Delivery | Telecommunications Operators / SS7 TCAP / Line Information Database (LIDB) | Carrier Interconnect / Authorized Gateway API | B2B Carrier Tariff ($0.002 - $0.005 / dip) | North America / Regional Carriers | Real-time / Daily | **High (85-95%)** | 7 days | No |
| `trai_ucc_registry` | Commercial Telemarketing Blacklist & Header Allocations | Telecom Regulatory Authority of India (TRAI UCC Regulations 2018) | Public CSV / XML Mirror & Carrier Gateway | Free public regulatory data | India (+91) | Weekly batch update | **Very High (98%)** | 30 days | Yes ("TRAI Registered Telemarketer") |
| `ftc_dnc_robocall` | Reported Nuisance Callers & Do Not Call Telemetry | US Federal Trade Commission (FTC) Robocall Data | Open Data API / S3 Data Sync | Public Domain / Free API | United States (+1) | Daily (Weekdays) | **High (85%)** | 7 days | Yes ("US FTC Consumer Complaint Data") |
| `opencorporates` | Official Business Registration & Corporate Identity | OpenCorporates Public Registry Database | REST API / API Key | Open Database License (ODbL) / Commercial Tier | Global (140+ jurisdictions) | Bi-weekly | **High (90%)** | 30 days | Yes ("OpenCorporates Registry") |
| `itu_e164_allocations` | Numbering Plan, Carrier Blocks & Geographic Ranges | ITU-T E.164 National Numbering Plans & libphonenumber | Public Standard / Library Embedded | Free / Apache 2.0 | Global (All country codes) | Monthly | **Highest (99%)** | 90 days | No |
| `openstreetmap_nominatim`| Geographic Location & Municipal Boundary Resolution | OpenStreetMap Foundation | HTTPS REST API / User-Agent Policy | Free (1 req/sec strict rate limit) / Self-hosted ODbL | Global | Monthly | **Medium (75%)** | 60 days | Yes ("© OpenStreetMap contributors") |
| `user_claimed_profile` | Self-Claimed Personal or Business Profile | VigilShield Verified Identity System | SMS OTP / Carrier SIM Auth | Platform Feature | Global | Real-time | **High (90-98%)** (when OTP verified) | 24 hours | Yes ("VigilShield Verified") |
| `community_reports` | Crowdsourced Spam / Scam / Harassment Reports | VigilShield Distributed Community Telemetry | Authenticated Client API (HMAC-SHA256) | Internal Platform Service | Global | Real-time streaming | **Weighted (40-95%)** (based on reporter reputation) | 1 hour | Yes ("Community Reports") |
| `device_local_contacts` | Personal Contacts | Local OS Contact Store (`navigator.contacts`, Android ContactsContract, iOS CNContactStore) | Device Permission (Local Sandbox) | Free (Device OS) | Local to device | Instant local lookup | **Absolute (100%)** | Local only (Never transmitted) | Local label |

---

## 2. Detailed Technical Breakdown & Legal Frameworks

### 2.1 STIR / SHAKEN Cryptographic Verification (`stir_shaken`)
- **Specification**: RFC 8224, RFC 8588, ATIS-1000074.
- **How it Works**: Originating service providers cryptographically sign a JSON Web Token (`PASSporT`) placed into the SIP `Identity` header. Terminating providers verify the certificate chain against the Secure Telephone Identity Governance Authority (STI-GA).
- **Attestation Levels**:
  - **Full Attestation (A)**: The carrier knows the customer and verifies their right to use the caller number (e.g. verified enterprise or mobile subscriber).
  - **Partial Attestation (B)**: The carrier knows the customer initiating the call, but cannot verify if they own the specific phone number.
  - **Gateway Attestation (C)**: The carrier received the call from an international gateway or untrusted third-party trunk and cannot verify caller identity.
- **Platform Handling**: On Android 10+ devices, `android.telecom.CallScreeningService` provides `Call.Details.getCallerVerificationStatus()`, exposing `CALLER_VERIFICATION_STATUS_PASSED` or `FAILED`.

### 2.2 Authorized Regulatory Directories (`trai_ucc_registry`, `ftc_dnc_robocall`)
- **Regulatory Foundation**: TRAI mandated that all commercial voice calls in India use the `140` prefix or `160` series for transactional communications. Any promotional call originating outside these licensed series is an illegal spoofing attempt.
- **Allowed Usage**: Caching of prefix ranges (e.g. `+91140XXXXXXX`) in local SQLite databases for instant sub-millisecond call-screening decisions without external network calls.

### 2.3 Community Spam Telemetry & Anti-Abuse (`community_reports`)
- **Anti-Poisoning Architecture**:
  - To prevent competitor vandalism or smear campaigns, a single report NEVER classifies a number as spam.
  - Reporters accumulate a **Trust Score (0.00 to 1.00)** based on reporting consistency, account tenure, phone number verification, and absence of dispute reversals.
  - Reports undergo **Half-Life Time Decay (30 days)**: complaints older than 90 days lose 87.5% of their weight unless corroborated by ongoing call activity.
  - **Sudden Burst Detection**: If an unverified number receives 50 reports within 15 minutes, the system triggers a temporary "Suspicious Spike" alert while rate-limiting further automated actions until human or heuristic audit.

### 2.4 User Profile & Business Verification System
- **Verification Tiers**:
  1. **Tier 0 (Unverified)**: User-entered name. Displayed as `"Unverified User-Submitted Name"` with low confidence.
  2. **Tier 1 (Phone Verified)**: The owner confirmed possession via one-time SMS verification code or carrier SIM auth.
  3. **Tier 2 (Enterprise Verified)**: The business verified registration documents (DUNS number, VAT/GST registration, corporate email domain matching company website). Displayed with a green or cyan **Verified Organization Badge**.

---

## 3. Provider Abstraction Architecture

The application implements a decoupled, swappable provider interface in `src/services/providers/`:

```
                    ┌────────────────────────┐
                    │ CallerIdentityPipeline │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ LocalContacts│        │ SQLite/Cache │        │ CompositeAPI │
│   Provider   │        │   Provider   │        │   Provider   │
└──────────────┘        └──────────────┘        └───────┬──────┘
                                                        │
                        ┌───────────────────────────────┴───────────────┐
                        ▼                                               ▼
              ┌──────────────────┐                            ┌──────────────────┐
              │ RegulatoryPrefix │                            │ CommunityReport  │
              │     Provider     │                            │     Provider     │
              └──────────────────┘                            └──────────────────┘
```

Every provider implements the standardized `IProvider` contract returning:
- Value
- Confidence level (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
- Legal attribution string
- Cache directive (TTL, canDisplayToUser)
- Timestamp
