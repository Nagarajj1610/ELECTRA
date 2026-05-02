# ELECTRA — Indian Election Intelligence Assistant

> AI-powered civic assistant helping Indian citizens — especially first-time voters — understand elections, check eligibility, bust myths, and find their polling booth. Built for the **Prompt Wars Challenge** using Google Antigravity.

[![Deployed on Cloud Run](https://img.shields.io/badge/Cloud%20Run-Deployed-blue?logo=google-cloud)](https://electra-303550323430.us-central1.run.app)
[![Tests](https://img.shields.io/badge/Tests-23%20Passing-brightgreen?logo=vitest)](/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](/)
[![Node](https://img.shields.io/badge/Node-22%2B-green?logo=node.js)](/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](/)

---

## 🎯 Challenge Vertical

**Election Process Education** — ELECTRA addresses the gap in accessible, accurate election information for Indian citizens. Millions of first-time voters lack guidance on registration, eligibility, and the voting process. ELECTRA solves this with a conversational AI that cites actual Indian law (Article 324, Article 326, RPA 1950/1951), guides users step-by-step through the election process, and works in both English and Hindi.

**Target Persona:** First-time Indian voter — overwhelmed, uninformed, needs hand-holding through the entire process from eligibility → registration → polling day → results.

---

## ✨ Features

| Feature | Description | Google Service |
|---|---|---|
| 💬 **AI Civic Chat** | Streaming Q&A citing Indian law, stateless + full history | Gemini 2.0 Flash |
| 🗺️ **Guided Journey Mode** | 10-step structured walkthrough for first-time voters | Gemini 2.0 Flash |
| ✅ **Eligibility Checker** | Voter eligibility by state, age, citizenship (Article 326) | Zod + Rule Engine |
| 📅 **Election Timeline** | 10-stage interactive roadmap — click any stage for AI explanation | Static + Cache |
| 🗺️ **Booth Finder** | Pincode → constituency lookup + Google Maps embed | Maps JS + Geocoding API |
| 🎯 **Adaptive Quiz** | Gemini-generated, difficulty scales with your score | Gemini 2.0 Flash |
| 🔍 **Myth Buster** | AI fact-checker returning TRUE / FALSE / MISLEADING | Gemini JSON mode |
| 🌐 **Bilingual** | Full English ↔ Hindi with dynamic lang attribute switching | Cloud Translation API v3 |
| 📊 **Admin Dashboard** | Aggregated analytics — queries, myths busted, top questions | Cloud Logging |
| 📈 **Progress Tracker** | Tracks 8 civic topics explored, shows Voter Readiness Score | localStorage |
| 🔒 **Secure by Design** | Helmet CSP, Zod, rate limiting, zero disk writes, no key exposure | — |

---

## 🏗️ Architecture

ELECTRA follows a **strict layered architecture**: Routes → Services → Utils → Helpers. Each layer has one responsibility. No business logic lives in route handlers.

```
┌─────────────────────────────────────────────────────────┐
│            Browser (Vanilla JS + Tailwind CDN)           │
│   Chat │ Timeline │ Eligibility │ Map │ Quiz │ Myths     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│                Express 4 on Cloud Run                    │
│           Helmet │ CORS │ Rate Limit │ Compression       │
├──────────────────────────────────────────────────────────┤
│  ROUTES (server.ts) — validate input, call service, respond
│  ├── POST /api/chat        → [service] gemini.chatStream()
│  ├── POST /api/eligibility → [service] eligibility.check()
│  ├── GET  /api/timeline    → [service] timeline.get() (cached 1hr)
│  ├── POST /api/quiz        → [service] gemini.generateQuiz() (cached 10min)
│  ├── POST /api/mythbust    → [service] gemini.mythBust()
│  ├── POST /api/translate   → [service] translate.translateText()
│  ├── POST /api/maps/lookup → [service] maps.lookupConstituency()
│  ├── GET  /api/admin/stats → [service] admin.getStats()
│  └── GET  /api/health      → 200 OK
├──────────────────────────────────────────────────────────┤
│  SERVICES — all business logic isolated here             │
│  gemini.ts │ translate.ts │ maps.ts │ eligibility.ts     │
│  timeline.ts │ admin.ts │ logger.ts                      │
├──────────────────────────────────────────────────────────┤
│  UTILS / SHARED                                          │
│  utils/helpers.ts │ errors/AppError.ts                   │
│  constants.ts │ prompts/index.ts │ config/env.ts         │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Gemini API   Cloud Translation   Cloud Logging
     Maps API       NodeCache          (No PII ever)
```

**Key design decisions:**
- All API keys stay on the server — Maps key is injected into `index.html` at serve time, never exposed via an endpoint
- Everything generated in-memory — zero disk writes, zero persistent user data
- Stateless chat — client sends full history each turn, no server-side sessions
- App refuses to start if any required env var is missing (validated via Zod at boot)

---

## 🔧 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 22 `--experimental-strip-types` | Zero compile step — no tsc needed |
| Framework | Express 4 | Lightweight, battle-tested |
| AI | Gemini 2.0 Flash | Streaming SSE, JSON mode, function calling |
| Translation | Cloud Translation API v3 | Native Hindi ↔ English at scale |
| Maps | Maps JS API + Geocoding API | Booth finder + pincode→constituency |
| Logging | Winston → Cloud Logging | Structured analytics, no PII |
| Caching | NodeCache | Quiz 10min · Geocoding 24hr · Timeline 1hr |
| Validation | Zod | Runtime schema validation + TypeScript type inference |
| Security | Helmet CSP + express-rate-limit | Defense in depth |
| Testing | Vitest + Supertest | Unit + integration + regression + failure simulation |
| Deployment | Google Cloud Run | Serverless, auto-scaling, asia-south1 |

---

## 🔐 Security Model

All external API calls are proxied through the backend — no API keys are ever sent to the browser.

| Concern | Implementation |
|---|---|
| Key exposure | Maps API key injected server-side into HTML at serve time — never a JSON endpoint |
| Input validation | Zod schemas on every route — rejects malformed, oversized, or missing input |
| XSS / injection | Helmet strict CSP + body size limit (50kb) |
| Rate limiting | 100 req/15min global · 10 msg/min chat |
| Secret management | All keys via Cloud Run env vars — never hardcoded, never in git |
| Data privacy | Zero disk writes · Zero PII logged · In-memory counters only |
| Admin access | `x-admin-password` header — compared with `crypto.timingSafeEqual` |
| AI safety | Gemini safety settings set to BLOCK_MEDIUM_AND_ABOVE for all harm categories |
| Error handling | Typed `AppError` class · Global error handler middleware · `err: unknown` narrowing |
| Startup guard | Zod validates all required env vars at boot — process exits if any missing |

---

## 🧪 Testing

23 tests across unit, integration, regression, and failure simulation suites:

```
src/__tests__/
  ├── api.test.ts         ← [integration] all routes, happy path + edge cases
  ├── security.test.ts    ← [unit] XSS payloads, rate limit, auth rejection
  └── regression.test.ts  ← [regression] full flow + failure simulation
```

**Coverage:**
- ✅ `[unit]` Every API route — happy path
- ✅ `[unit]` Eligibility edge cases: age 17, 18, non-citizen
- ✅ `[unit]` XSS payloads rejected with 400
- ✅ `[unit]` Admin endpoint rejects missing/wrong password
- ✅ `[unit]` Myth buster returns valid `TRUE|FALSE|MISLEADING` enum
- ✅ `[unit]` Quiz returns exactly 5 valid structured questions
- ✅ `[integration]` Full chat round-trip with mocked Gemini
- ✅ `[integration]` `/api/health` → 200
- ✅ `[integration]` Rate limit triggers 429 at 11th chat request
- ✅ `[regression]` Full flow: chat → eligibility → quiz → mythbust → timeline
- ✅ `[regression]` Gemini failure → graceful fallback, not 500
- ✅ `[regression]` App boots successfully with all required env vars present

---

## ⚙️ Environment Variables

Validated at startup via Zod — app will not start if any required variable is missing.

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `MAPS_API_KEY` | ✅ | Google Maps JavaScript + Geocoding API key |
| `GOOGLE_CLOUD_PROJECT` | ✅ | GCP project ID (Cloud Translation + Logging) |
| `ADMIN_PASSWORD` | ✅ | Password for `/api/admin/stats` |
| `NODE_ENV` | ✅ | `production` or `development` |
| `PORT` | ❌ | Default 8080 — Cloud Run sets this automatically |

---

## 📁 Project Structure

```
/electra
  /src
    server.ts              ← Express app entry — routes, middleware, error handler
    gemini.ts              ← Gemini service — chat, quiz, mythbust (isolated)
    translate.ts           ← Cloud Translation API v3 service
    maps.ts                ← Maps + Geocoding API service
    logger.ts              ← Winston → Cloud Logging sink (no PII)
    admin.ts               ← Admin dashboard — in-memory counters only
    constants.ts           ← ALL named constants, enums, TTL values
    /config
      env.ts               ← Zod env schema — validates at boot, exits if invalid
    /services
      eligibility.ts       ← Voter eligibility rule engine (Article 326, RPA 1950)
      timeline.ts          ← Election stages data + caching
    /errors
      AppError.ts          ← Typed error class — statusCode + errorCode fields
    /utils
      helpers.ts           ← Shared pure functions — zero duplication
    /prompts
      index.ts             ← ALL Gemini system prompts as named exports
    /types
      index.ts             ← Zod schemas + inferred TypeScript types
    /__tests__
      api.test.ts          ← Integration tests
      security.test.ts     ← Security + rate limit tests
      regression.test.ts   ← Regression + failure simulation tests
  /public
    index.html             ← Complete frontend — single file, Tailwind CDN
  package.json
  tsconfig.json            ← strict: true, noImplicitAny: true
  .env.example             ← Placeholder keys only — never real values
  .gitignore               ← Excludes .env, node_modules, dist
  Dockerfile               ← node:22-slim, no build step
  README.md
```

---

## 🚀 Setup & Deployment

### 1. Enable Google Cloud APIs

```bash
gcloud services enable \
  generativelanguage.googleapis.com \
  translate.googleapis.com \
  maps.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com
```

### 2. Install & Configure

```bash
npm install
cp .env.example .env
# Fill in your API keys in .env
```

### 3. Run Locally

```bash
npm run dev
# App runs at http://localhost:8080
```

### 4. Run Tests

```bash
npm test
# Expected: 23 tests passing across 3 test files
```

### 5. Deploy to Cloud Run

```bash
gcloud run deploy electra \
  --source . \
  --region=asia-south1 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --set-env-vars="GEMINI_API_KEY=YOUR_KEY,MAPS_API_KEY=YOUR_KEY,ADMIN_PASSWORD=YOUR_PASS,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,NODE_ENV=production"
```

---

## 💡 Assumptions

- Eligibility rules follow the Representation of the People Act 1950 and Article 326 of the Constitution of India
- Polling booth data uses pincode-to-constituency mapping via Maps Geocoding API + Gemini knowledge
- Quiz difficulty adapts based on cumulative session score — client sends score each request, no server sessions
- All Gemini responses validated against Zod schemas before serving — malformed responses trigger graceful fallbacks, never 500 errors
- Admin dashboard resets on server restart — in-memory only by design, no database dependency
- Maps API key is restricted in Google Cloud Console to this app's domain (HTTP referrer restriction)

---

## 📜 License

MIT — Built for the **Prompt Wars Challenge** 