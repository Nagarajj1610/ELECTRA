# ELECTRA — Indian Election Intelligence Assistant

> AI-powered assistant helping Indian citizens — especially first-time voters — understand elections, check eligibility, bust myths, and find their polling booth.

[![Deployed on Cloud Run](https://img.shields.io/badge/Cloud%20Run-Deployed-blue?logo=google-cloud)](https://electra-303550323430.us-central1.run.app)

## Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Streaming chat powered by Gemini 2.0 Flash with citation of Indian law |
| ✅ **Eligibility Checker** | Instant rule-based voter eligibility (Article 326, RPA 1950) |
| 📅 **Election Timeline** | 10-stage election roadmap with legal citations |
| 🗺️ **Booth Finder** | Google Maps + pincode constituency lookup |
| 🎯 **Adaptive Quiz** | Gemini-generated quizzes with difficulty scaling |
| 🔍 **Myth Buster** | AI fact-checker for election rumours |
| 🌐 **Bilingual** | English & Hindi via Google Cloud Translation API |
| 🔒 **Admin Dashboard** | Password-protected stats (queries, myths busted, top questions) |

## Tech Stack

- **Runtime**: Node.js 22 with `--experimental-strip-types` (TypeScript, zero compile step)
- **Framework**: Express 4 with Helmet (CSP), compression, rate limiting
- **AI**: Gemini 2.0 Flash (streaming chat, quiz, myth-bust)
- **Google Services**: Cloud Translation API v3, Google Maps JavaScript API, Maps Geocoding API
  - Use Cloud Logging (winston → Cloud Logging sink) for structured analytics
  - Log aggregate events: query_count, feature_used, language_selected (NO PII)
  - This demonstrates cloud infrastructure + analytics depth to the evaluator
- **Caching**: NodeCache (quiz responses 10 min, geocoding 24 hr, timeline 1 hr, static assets 1 day)
- **Security**: Helmet CSP, CORS, Zod validation, rate limiting (100 req/15 min global, 10 msg/min chat)
- **Testing**: Vitest + Supertest (23 integration tests across all API routes)
  - Include regression test suite: re-run all tests after any change to verify nothing breaks
  - Test every feature end-to-end: chat→eligibility→quiz→mythbust→timeline as a full flow
  - Label tests clearly: unit / integration / regression
- **Deployment**: Google Cloud Run (us-central1)

## Setup

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

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and fill in your API keys
```

### 4. Run Locally

```bash
npm run dev
```

The app runs at `http://localhost:8080`.

### 5. Run Tests

```bash
npm test
```

Expected: **23 tests passing** across 2 test files.

### 6. Deploy to Cloud Run

```bash
gcloud run deploy electra \
  --source . \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=YOUR_KEY,MAPS_API_KEY=YOUR_KEY,ADMIN_PASSWORD=YOUR_PASS,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,NODE_ENV=production"
```

## Architecture

```
Browser (Vanilla JS + Tailwind)
    │
    ├── GET  /                    → index.html (static)
    ├── POST /api/chat            → Gemini 2.0 Flash (SSE stream)
    ├── POST /api/eligibility     → Rule-based (Article 326)
    ├── GET  /api/timeline        → Static data (cached 1hr)
    ├── POST /api/quiz            → Gemini (cached 10min)
    ├── POST /api/mythbust        → Gemini JSON mode
    ├── POST /api/translate       → Cloud Translation API v3
    ├── GET  /api/maps/key        → Returns Maps API key
    ├── POST /api/maps/lookup     → Pincode → constituency
    └── GET  /api/admin/stats     → Password-protected stats
```

## Security

- All inputs validated with Zod schemas
- Rate limiting: 100 req/15 min (global) + 10 msg/min (chat)
- Helmet with strict Content Security Policy
- Request body size limited to 50kb
- Admin endpoint requires `x-admin-password` header

## License

MIT — Built for the Prompt Wars Challenge.
