# CLAUDE.md — MailOutreach Codebase Guide

## Project Overview

MailOutreach (internally also called "Outbound Forge") is a single-user protected web MVP for cold outreach research. It has two core workflows:

1. **Manual** — user submits a company name, website, and brief → server fetches the site, audits it, and returns findings + a 3-email sequence.
2. **Autonomous** — user defines a niche and location → server queries Bing RSS, qualifies discovered businesses as prospects, and batch-generates reports.

Data persists to a local JSON file. There is no database, no build step, and no external framework.

---

## Repository Layout

```
/
├── index.html              # Main SPA shell (all UI sections inline)
├── app.js                  # Frontend JS — event handlers, rendering, API calls
├── styles.css              # All styling
├── service-worker.js       # PWA offline cache registration
├── manifest.webmanifest    # PWA manifest
├── .env.example            # Template for required env vars
├── run-server.sh           # Linux/macOS launch script
├── run-server.cmd          # Windows CMD launch script
├── start-outbound-forge.*  # Windows launcher wrappers
├── server/
│   ├── package.json        # Node package (ESM, no deps beyond built-ins)
│   └── src/
│       ├── index.js        # HTTP server: routing, auth, session management
│       └── store.js        # All data logic, report building, autonomous runs
├── docs/
│   ├── architecture.md     # Current and planned architecture
│   ├── api-contract.md     # Documented API endpoints
│   ├── data-model.md       # Entity definitions
│   ├── platform-strategy.md
│   └── workspace-layout.md
├── deploy/
│   ├── bootstrap-ubuntu.sh
│   ├── nginx-outbound-forge.conf
│   ├── outbound-forge.service
│   ├── deploy-example.sh
│   └── rsync-exclude.txt
└── apps/, packages/        # Placeholder dirs for future mobile/shared code
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 (ESM modules — `"type": "module"`) |
| HTTP server | Node built-in `http` module (no Express, no Fastify) |
| Frontend | Vanilla HTML, CSS, plain JS — no bundler, no framework |
| Data persistence | `server/data/db.json` (written synchronously via `fs.writeFileSync`) |
| Authentication | In-memory session store + HMAC-signed cookies |
| Prospect discovery | Bing RSS feed (`/search?format=rss`) |
| Deployment target | DigitalOcean droplet behind Nginx + systemd |

No npm dependencies beyond Node built-ins. No TypeScript. No build pipeline.

---

## Running the Server

```bash
# Copy env template and fill in values
cp .env.example .env

# Start (Linux/macOS)
./run-server.sh

# Or directly
node server/src/index.js
```

Server listens on `http://localhost:4020` by default. If `AUTH_PASSWORD` is not set, a random password is generated and printed to the console at startup.

### Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | HTTP port (default: `4020`) | No |
| `AUTH_USERNAME` | Login username | No (default: `admin`) |
| `AUTH_PASSWORD` | Login password | Yes for production |
| `AUTH_SESSION_SECRET` | HMAC key for session tokens | Yes for production |
| `NODE_ENV` | Set to `production` behind HTTPS | No |
| `COOKIE_SECURE` | Set to `true` only when served over HTTPS | No |

`.env` is loaded by the server at startup; existing `process.env` values take priority over `.env` entries.

---

## API Endpoints

All endpoints under `/api/` except auth routes require a valid session cookie (`outbound_forge_session`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check — public, no auth |
| `POST` | `/api/auth/login` | Authenticate → set session cookie |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/auth/session` | Check if current session is valid |
| `GET` | `/api/dashboard` | Full dashboard payload |
| `POST` | `/api/setup-request` | Submit manual report brief |
| `POST` | `/api/autonomous-runs` | Queue an autonomous prospect discovery run |
| `GET` | `/api/plans/:id` | Fetch a single report by ID |
| `PATCH` | `/api/plans/:id/status` | Update report workflow status |
| `PATCH` | `/api/plans/:id/checklist/:itemId` | Toggle a checklist item |
| `GET` | `/api/autonomous-runs/:id` | Fetch a single autonomous run |

Static files (HTML, JS, CSS) are served from the project root for authenticated requests. Unauthenticated GET requests to any path return the inline login page.

---

## Data Model

All data lives in `server/data/db.json` with this shape:

```json
{
  "profile": { "productName": "MailOutreach", "supportEmail": "..." },
  "requests": [],
  "reports": [],
  "runs": [],
  "activity": []
}
```

### Report fields (key ones)

- `id`, `createdAt`, `companyName`, `websiteUrl`, `location`
- `cta`, `auditMode` — one of `Agency | SEO | Social | Mixed`
- `painPoints` — string array
- `reportRequirements` — string array (drives custom report sections)
- `sourceUrls` / `sourceSnapshots` — optional additional URLs fetched for context
- `websiteSnapshot` — fetched page data (title, description, h1, CTA/trust signals)
- `intentSignals`, `findings`, `customSections`, `executiveSummary`
- `outreachSequence` — 3-element array: `{ step, subject, body }`
- `status` — one of `Researching | Drafted | Reviewing | Ready to Send | Live`
- `checklist` — array of `{ id, label, completed, completedAt }`
- `autonomousRunId`, `discoveredFromQuery` — set when created by an autonomous run

### Autonomous Run fields

- `id`, `createdAt`, `campaignName`, `niche`, `location`, `cta`, `auditMode`
- `targetCount` — capped to 1–10
- `status` — one of `Queued | Running | Completed | Completed with Errors | Failed`
- `discoveredProspects`, `reportIds`, `logs`, `errors`

### IDs

All IDs are generated as `${prefix}_${Date.now()}_${random6chars}`.

---

## Core Logic (server/src/store.js)

`store.js` owns all business logic. Key functions:

- **`submitSetupRequest(payload)`** — manual flow entry point. Calls `buildReportRecord` which fetches the website + optional source URLs, runs analysis, builds findings/sequence, persists.
- **`createAutonomousRun(payload)`** — queues a run and fires `processAutonomousRun` asynchronously via `setTimeout(..., 0)`.
- **`processAutonomousRun(runId)`** — discovers prospects from Bing RSS, qualifies each (reachability + niche/location token matching), builds a full report per prospect.
- **`fetchPageSnapshot(url)`** — fetches a URL with a 12 s timeout, extracts title/description/h1, and scans for CTA and trust keywords.
- **`discoverProspects(query, count)`** — hits Bing RSS, parses `<item>` elements, filters blocked domains.
- **`updatePlanStatus` / `updateChecklistItem`** — mutate the in-memory `db` object and call `persistDb()` (synchronous write).

### Blocked domains

Social media and aggregator domains are filtered out of autonomous discovery: LinkedIn, Facebook, Instagram, TikTok, X/Twitter, YouTube, Yelp, Crunchbase, Wikipedia, etc.

---

## Frontend (app.js + index.html)

- Single-page app: `index.html` contains all sections.
- `app.js` is loaded as a plain `<script>` (not a module). All state is module-level variables.
- Dashboard polling: when an autonomous run is active, `app.js` polls `/api/dashboard` every 5 s via `setTimeout`.
- Draft persistence: manual and autonomous form contents are saved to `localStorage` automatically on every `input` event.
- Key localStorage keys: `mailoutreach-form-draft`, `mailoutreach-autonomous-draft`.
- Export: `buildExportText()` builds a plain-text copy of the current report for clipboard.

---

## Authentication & Security

- Sessions are stored in a `Map` in memory — they reset on server restart.
- Session tokens: 32-byte random + HMAC-SHA256 signature, stored as `{token}.{sig}` in a `HttpOnly; SameSite=Strict` cookie.
- Session TTL: 8 hours.
- Rate limits (in-memory, per IP):
  - Global: 300 requests / 5 min
  - Login: 10 attempts / 15 min
- Security headers applied to every response: `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP`, CSP.
- Password comparison uses `crypto.timingSafeEqual` to prevent timing attacks.

---

## Deployment

Production deployment uses:
- **Nginx** as a reverse proxy (TLS termination, proxy to `localhost:4020`)
- **systemd** to manage the Node process
- **rsync** to sync project files to the droplet

Key files in `deploy/`:
- `bootstrap-ubuntu.sh` — installs Node, creates systemd service
- `nginx-outbound-forge.conf` — Nginx config
- `outbound-forge.service` — systemd unit
- `deploy-example.sh` — rsync command template

App is deployed to `/opt/outbound-forge` on the server. Set all secrets in `/opt/outbound-forge/.env`.

---

## No Tests, No Linter

There is currently no test suite and no linting/formatting configuration. When making changes:

- Verify behaviour manually by running the server and exercising the affected flow in a browser.
- Follow the existing code style: 2-space indentation, double quotes, no semicolons at end of statements in server code (the server code uses semicolons — match the existing style in whatever file you're editing).
- Do not introduce npm dependencies without discussing the trade-off; the project is intentionally zero-dependency.

---

## Conventions

- **ESM throughout**: server code uses `import`/`export`. Never use `require()`.
- **No framework**: routing is a sequence of `if` checks in `index.js`. Keep new endpoints in the same pattern.
- **Synchronous DB writes**: `persistDb()` calls `fs.writeFileSync`. This is intentional for the MVP; do not add async file I/O without careful reasoning.
- **All store functions that mutate state must call `persistDb()`** before returning.
- **Report IDs use the `report_` prefix**, run IDs use `run_`, request IDs use `request_`, checklist items use `task_`, activity events use `activity_`.
- **`normalizeReport`** and **`normalizeRun`** must be called on any record before it is returned to the client or stored.
- **Blocked domain list** lives at the top of `store.js`. Add new domains there if autonomous discovery needs to skip additional sources.
- **Content Security Policy** in `index.js` allows `unsafe-inline` for scripts and styles. Adding external scripts requires updating the CSP header.

---

## Known Limitations (as of 2026-06)

- Sessions are in-memory only — server restart logs everyone out.
- Single-user only — no multi-account support.
- JSON file storage — not suitable for concurrent writes or large data sets.
- Autonomous discovery uses only Bing RSS — no authenticated platform APIs.
- No HTTPS termination inside the Node server — must run behind Nginx or similar.
- No email sending — the app generates outreach copy but does not send it.
