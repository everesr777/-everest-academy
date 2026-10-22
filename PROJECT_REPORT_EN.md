# Everest Academy — Trading Courses Platform (Project Case Study)

## Overview
A full-stack, production-ready **e-Learning & Trading Courses Platform** for teaching Forex & financial markets trading to Arabic-speaking users, built RTL-first with full English localization. The system is a **monorepo** with three applications:

1. **Student App** — React 18 + Vite + Tailwind CSS
2. **Admin Panel** — React 18 + Vite + Tailwind CSS
3. **API Backend** — Node.js + Express + SQLite (sql.js / Turso-compatible)

**Production**: Backend deployed on Railway (Dockerfile), front-ends on Hostinger behind a custom `api.php` reverse proxy, video streaming through a CDN (Bunny.net via tus-js-client resumable uploads).

---

## Tech Stack
- **Frontend (Student):** React 18, React Router 6, Vite 5, Tailwind CSS, RTL + AR/EN i18n, SWR cache layer, Pull-to-Refresh
- **Admin UI:** React 18, Vite, Tailwind, jsPDF (PDF reports), tus-js-client (resumable video upload)
- **Backend:** Node.js, Express 4, sql.js + @libsql/client (Turso), bcryptjs, express-rate-limit, nodemailer (OTP + email recovery), node-cron (scheduled tasks), multer, Gemini AI + Groq REST API
- **Testing:** Node built-in test runner (15+ unit tests for settlement engine), login sanitization tests

---

## Key Features

### Student Experience
- **Dual sign-up**: self-registration (external) **and** "Create Account for Another User" (sponsored).
- **Email verification via OTP**, resend, forgot/reset password flows.
- **Course platform**: catalog, free courses, video lessons, in-lesson quizzes, progress tracking, leaderboard of top quiz performers.
- **Multiple payment gateways**: InstaPay, Vodafone Cash, bank card, plus a combined checkout with payment-proof upload.
- **E-Money wallet** with top-up using commissions/earnings.
- **Affiliate / MLM system**:
  - Per-user referral codes and a full referral network tree (closure table).
  - Progressive ranks: Star → Executive → Executive Star → Team Leader → Senior Leader → Regional Leader → Everest Elite → Everest Master → Everest Legend → Everest Ambassador.
  - **Automated weekly rank promotion** and **weekly commission payout** (E-Money) based on the last qualified rank.
- **Top Sellers / Rankings pages** + **"Our Leaders"** top-10 homepage snapshot.
- **AI Assistant** chatbot (Gemini + Groq) answering platform/course questions.
- **Screen protection overlay** to prevent content sharing/capture.
- WhatsApp float/contact, in-app customer service, notifications bell (unread badges).
- Offline-friendly: SWR caching + pull-to-refresh for faster mobile UX.

### Admin Panel
- **RBAC**: Admin / Manager roles with role management.
- **Course Builder**: chapters, lessons, quizzes, and resumable video upload to CDN (Bunny).
- **Approvals**: pending student registrations, account upgrade requests, membership renewals.
- **User management**: student search/filter, ID-card review, registration-source breakdown (external vs. created).
- **Ranks management**: editable thresholds/bonuses, per-member progress, manual payouts.
- **Weekly Settlement module**:
  - Configurable day / hour / timezone / minimum direct-sales threshold.
  - Auto-run scheduler (30s poll) or manual trigger.
  - Deduplication and double-commission protection (unique claims + defense-in-depth), full history log.
- **Payments**: InstaPay / Vodafone / Card gateway settings, transaction history, top-up ledger.
- **Dashboards & tools**: feedbacks/reviews moderation, activity feed, admin logs, pricing, membership, Gemini keys, PDF export.

### Backend / API Design
- REST API under `/api` with **session-based authentication** (multi-device token CSV).
- Layered middleware: `sessionAuth` + `adminAuth` (student vs. admin access control).
- **Security hardening**: rate limiting, login input sanitization (strips invisible Unicode: ZWSP / Bidi / NBSP), bcrypt password hashing, OTP validation, session-expiry cleanup.
- **SQLite persistence** with 10-minute auto-save snapshots + remote Turso mode.
- **Weekly settlement engine** as a dedicated service (`weeklySettlement`) with atomic week claiming, weekly sales recording on approved enrollment, network counting via closure table, and leaderboard snapshot + sales reset — fully unit-tested (15 tests).

---

## Architecture Highlights
```
Student/Admin React Apps (Hostinger)  →  api.php proxy  →  Railway API backend
                                                                   |
                                              SQLite / Turso (local + autosave)
```
- Monorepo with a single Docker deployment (backend-only build to keep Railway/CI deterministic).
- `hostinger-update/` staging folder holds the exact upload set (`user/`, `admin/`, `api.php`).
- Resumable CDN uploads (tus) for large video content.

---

## Production & Reliability Work Done
- Debugged and fixed cross-browser auth issues (Chrome autofill, Safari autofill/state bugs, Edge/Brave) with CDP-driven E2E verification.
- Fixed SQL argument-count mismatch breaking registration on production (users INSERT).
- Reworked Railway Dockerfile to build backend only, stabilizing deployments.
- Built/verified an SWR caching layer and measured cache hits to cut `/api/courses` requests to 0 on repeat visits.
- Weekly settlement rescheduled (Friday 23:00 Africa/Cairo) with settings-driven live updates — no redeploy needed.

---

## Deployment & Ops
- **Backend:** Railway, Docker, auto-deploy on git push (`main`).
- **Front-ends:** Hostinger static hosting + `api.php` proxy for `/api/*` and `/uploads/*`.
- **Videos:** Bunny CDN (tus resumable upload).
- **Monitoring:** detailed server logs, settlement run history, auto-save DB backups.

---

## Most CV-worthy bullets
- Full-stack ownership from **architecture to production** of a live MLM + eLearning platform.
- Designed an **original weekly settlement engine** (rank promotion + commission payout + anti-duplication) with 15 passing unit tests.
- Built a **network/referral tree system** using closure tables and recursive upline walks.
- Cross-browser E2E debugging and **production incident fixes** under real traffic.
- Strong, modern stack: React, Express, SQLite, Turso, Vite, Tailwind, AI assistants (Gemini/Groq), Redis-style cache strategies, CDN integrations.