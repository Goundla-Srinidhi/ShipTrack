# Project Approach & Architecture — Build Secure 24

**Team ID:** 58
**Project Name:** ShipTrack
**Team Size:** 4 Members
**Primary Track / Domain:** PS-05 — Logistics

---

## 1. Problem Understanding, Scope & Threat Model

### 1.1 Problem Statement & Real-World Motivation
ShipTrack brings shipment creation, customer tracking history, courier delivery updates, and administrator assignment into one role-oriented workspace. The prototype focuses on clear parcel progress and usable operational workflows. The current build is a browser-only demonstration, not a production logistics service.

### 1.2 Target Users & Personas
* **Customer:** registers/signs in, books a parcel, and views their own shipment history in the UI.
* **Delivery partner:** reviews assigned stops and posts shipment status/location updates.
* **Administrator:** reviews customers and couriers, assigns delivery partners, and monitors all shipments.
* **Trust boundary:** all client state and role selection are untrusted; UI filtering is a demo affordance, not authorization.

### 1.3 Threat Model & Attack Surface
*Document the threat landscape for this system:*
- **Critical Assets:** recipient contact details, shipment routes/status history, account identifiers, and authentication material.
- **Potential Attack Vectors:** localStorage inspection/tampering, role escalation, stored/reflected injection, account takeover, and unauthorized object access.
- **OWASP Top 10 Considerations:** broken access control is not solved by client filtering; production must enforce authentication, RBAC, and per-shipment ownership checks server-side. Rendered user content is escaped; production APIs must validate input, rate-limit login/lookup, and avoid leaking recipient PII.
- **Current limitation:** shipment data, accounts, and session choice are local to one browser and can be changed by the user. Demo PBKDF2 password hashes do not create a trusted authentication boundary. Never use real credentials or personal data in this prototype.

---

## 2. Technical Architecture & Secure System Design

### 2.1 High-Level Architecture Overview
Current milestone: static HTML/CSS/JavaScript client with role-aware customer, courier, and administrator views. Browser localStorage provides seed data and demo persistence; there is no API gateway, shared database, or trusted server. A production design should add an authenticated API and relational database, enforce role and object-level access on each request, and keep credential handling server-side.

### 2.2 Data Flow & Component Interaction
In this prototype, browser form input flows through client-side validation into the UI and localStorage, then renders back into shipment tables and tracking timelines. Every browser value is untrusted; a real deployment must move validation, role checks, assignment rules, and status transitions into the API before writing to durable storage.

### 2.3 Technology Stack Rationale
*Explain the tools selected and why alternatives were rejected:*
- **Backend / API Framework:** None in the prototype; do not expose as production-ready.
- **Frontend / Client:** Vanilla HTML/CSS/JavaScript for a quick, dependency-free interactive demo.
- **Database & Persistence:** Browser localStorage for single-browser demo persistence only.
- **Authentication & Cryptography:** Web Crypto PBKDF2 hashes demo passwords; local browser storage and client-controlled roles remain insecure. Production should use a server-side password KDF (Argon2id/scrypt/bcrypt), secure session cookies, and server-enforced authorization.

### 2.4 Defense-in-Depth Security Controls
*Detail the specific security controls implemented:*
1. **Authentication & Session Security:** demo password hashes use a per-account salt and PBKDF2 via Web Crypto; demo session selection in localStorage is not secure.
2. **Authorization & Access Control:** views filter data by role for usability, but browser code is user-controlled. Add API RBAC and ownership checks before real use.
3. **Input Validation & Sanitization:** required fields, length limits, basic phone/email checks, same-route rejection, and HTML escaping in UI rendering.
4. **Rate Limiting & Abuse Prevention:** not applicable without a server; implement rate limits and abuse monitoring on production authentication and tracking endpoints.
5. **Secrets & Configuration Hygiene:** no service secrets are used in the client. Never put API secrets in frontend code.

---

## 3. Implementation Milestones & 24-Hour Timeline

| Milestone / Phase | Time Window | Key Objectives & Deliverables | Security Verification | Status |
|---|---|---|---|---|
| **Phase 1: Foundation & Setup** | 0h – 4h | Contract onboarding, repo setup, baseline data schemas | Secret scan & baseline check | `Planned` |
| **Phase 2: Core Domain & Auth** | 4h – 12h | Core business logic, secure authentication & authorization | Auth test suite & crypto validation | `Planned` |
| **Phase 3: Security & Hardening**| 12h – 18h | Input validation, rate limiting, error handling, security middleware | SAST scanning & edge case tests | `Planned` |
| **Phase 4: Polish & Deployment**| 18h – 24h | UI polish, live cloud deployment, final docs & commit freeze | Live deployment URL check | `Planned` |
| **ShipTrack prototype: role-based shipment workflows** | 2026-10-05 | Customer booking/tracking/history, courier status updates, admin assignment, responsive UI | Browser smoke checks; confirm production limitations are visible | `Complete — browser smoke passed` |

---

## 4. Architecture Decision Records (ADRs)

### ADR-001: Dependency-free browser prototype
- **Status:** Accepted for the hackathon prototype.
- **Context:** The starter source folder had no application scaffold; the requested workflows needed a working, quickly runnable interface.
- **Options Considered:**
  1. Add a backend and database immediately.
  2. Implement an interactive static client with seeded local data.
- **Decision & Rationale:** Use vanilla HTML/CSS/JavaScript and localStorage for a self-contained demo of the requested customer, courier, and administrator workflows.
- **Security & Performance Trade-offs:** Low setup cost and no third-party runtime dependencies; localStorage, frontend password hashes, and role filtering are not trusted security controls. Do not use real customer data. A production follow-up requires server-side identity, authorization, validation, durable persistence, and audit records.

### ADR-002: Role-specific workspace views
- **Status:** Accepted.
- **Context:** Customers, delivery staff, and administrators have distinct shipment responsibilities.
- **Options Considered:** One shared table for every user; distinct role-specific views over the demo data.
- **Decision & Rationale:** Provide tailored navigation and actions for each role while retaining one shared shipment model and tracking timeline.
- **Security & Performance Trade-offs:** Improves workflow clarity; view filtering is not access control, so production must authorize every API request and shipment object.

---

## 5. Engineering Journal & Real-Time Decision Log

*Maintain this chronological log as your team builds during the 24-hour hackathon.*

### [2026-10-05 12:49 IST] Entry 1: Onboarding & ShipTrack scope
- **Focus:** Record team identity and implement the PS-05 shipment-management prototype.
- **Key Challenges:** Starter repository had no source scaffold; no backend or database was supplied.
- **Resolution:** Begin with a self-contained browser prototype, explicitly mark demo-only storage/authentication, and record production security gaps.

### [2026-10-05 12:53 IST] Entry 2: Role workflow implementation
- **Focus:** Ship customer booking/history/tracking, courier delivery updates, and administrator customer/courier/assignment management.
- **Key Challenges:** Keep the role workflows testable without representing browser-side demo state as production authorization.
- **Resolution:** Add clear demo-mode disclosures, PBKDF2-hashed demo passwords, per-role screens, and shipment status timelines. Browser smoke-tested customer registration/login, booking, admin assignment/courier creation, courier status update, and customer tracking.

### [YYYY-MM-DD HH:MM IST] Entry 2: Implementation Milestone Progress
- **Focus:** 
- **Key Challenges:** 
- **Resolution:** 

---

## 6. Testing, Security Verification & Deployment Record

### 6.1 Testing & Security Verification Strategy
- **Unit & Integration Tests:** Browser smoke-tested registration/login, shipment booking, admin courier creation and assignment, courier status updates, and customer tracking timeline.
- **Static Analysis & Linting:** `node --check src/app.js` passed; VS Code diagnostics show no issues. No dependency or server-side security scanning is applicable to this vanilla browser-only prototype.

### 6.2 Deployment Verification
- **Live Deployment Platform:** (e.g., Vercel, Render, Railway, AWS)
- **Deployment URL:** (Recorded in `metadata/submission.yaml` and `deployment/README.md`)
- **Health Check Endpoint:** (e.g., `/health` or `/api/health`)
