# MailOutreach

MailOutreach is a protected outreach-research MVP with two workflows:

- manual report drafting from a specific company and website
- autonomous prospect discovery by niche and location

It can discover public business websites from search results, audit the site, build a fluid client report, and draft a 3-email outreach sequence.

## What Works

- authenticated access to the app and API
- session cookies with server-side session tracking
- rate-limited login and baseline security headers
- manual client brief submission from the browser
- autonomous search runs by niche, location, CTA, and report requirements
- public search-based prospect discovery with source filtering and qualification
- quick website snapshot fetching for the main URL and optional enriched source URLs
- generated findings, custom report sections, intent-style signals, and a 3-email sequence
- fluid report structure driven by each client's own report requirements
- saved report history in the dashboard instead of only the latest result
- queued and completed autonomous run tracking
- workflow status management for saved reports
- checklist completion tracking for review and send-readiness
- browser draft saving for both manual and autonomous forms
- one-click copy/export of the current report and sequence

## Current Limits

- autonomous discovery currently relies on public search and website access, not private platform APIs
- it does not yet directly scrape authenticated LinkedIn, Facebook, or Google Maps sessions
- data is persisted to a local JSON file, not a production database
- no multi-user accounts yet
- no HTTPS termination inside this Node server itself
- sessions are still in memory, so login sessions reset on server restart

## Required Environment Variables For Real Use

- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `AUTH_SESSION_SECRET`
- `NODE_ENV=production` when deployed behind HTTPS
- `COOKIE_SECURE=true` only when the app is actually served behind HTTPS

If `AUTH_PASSWORD` is not set locally, the server will generate a temporary password and print it to the console at startup.

## Quick Start

Before the first run:

1. copy `.env.example` to `.env`
2. set your own username, password, and session secret

Then run:

- `E:\AKELA\codex\forgeai-gym-coach\start-outbound-forge.cmd`

And open:

- `http://127.0.0.1:4020`

For local use, keep:

- `NODE_ENV=development`
- `COOKIE_SECURE=false`

## Run With The Bundled Node Runtime

```powershell
$env:AUTH_USERNAME='admin'
$env:AUTH_PASSWORD='replace-this'
$env:AUTH_SESSION_SECRET='replace-with-a-long-random-secret'
$env:PORT='4020'
& 'E:\AKELA\codex\forgeai-gym-coach\tools\node-v22.20.0-win-x64\node.exe' 'E:\AKELA\codex\forgeai-gym-coach\server\src\index.js'
```

Then open `http://127.0.0.1:4020`.

## Public Deployment Note

This app has a solid protected MVP baseline, but public security still requires:

- HTTPS in front of the app
- secrets set through environment variables
- a real reverse proxy or platform-level deployment setup
- eventually a database-backed auth/session layer if this grows beyond a small protected MVP

## Local Data Path

Saved reports, autonomous runs, requests, and activity live at:

- `E:\AKELA\codex\forgeai-gym-coach\server\data\db.json`
