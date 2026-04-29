# Outbound Forge

Outbound Forge is a local MVP for planning cold email infrastructure with a protected browser UI and a built-in Node server.

## What Works

- authenticated access to the app and API
- session cookies with server-side session tracking
- rate-limited login and baseline security headers
- setup request submission from the browser
- generated domain and mailbox recommendations on the server
- daily sending capacity and monthly infrastructure cost estimates
- recent request and activity history persisted to a local JSON data file
- plan history shown in the dashboard instead of only the latest result
- browser draft saving for planner inputs
- one-click copy/export of the generated plan summary
- rollout status management for saved plans
- checklist completion tracking for DNS, mailbox, and warmup tasks
- selectable saved plans so ops can reopen and continue older setups

## Current Limits

- data is persisted to a local JSON file, not a production database
- no real mailbox or domain provisioning yet
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

Double-click or run:

- `E:\AKELA\codex\forgeai-gym-coach\start-outbound.cmd`
- `E:\AKELA\codex\forgeai-gym-coach\start-outbound-forge.cmd`

Before the first run:

1. copy `.env.example` to `.env`
2. set your own username, password, and session secret

Then open `http://127.0.0.1:4020`.

To stop the local server quickly:

- `E:\AKELA\codex\forgeai-gym-coach\stop-outbound.cmd`

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

This app now has a proper in-app protection baseline, but public security still requires:

- HTTPS in front of the app
- secrets set through environment variables
- a real reverse proxy or platform-level deployment setup
- eventually a database-backed auth/session layer if this grows beyond a small protected MVP

## Local Data Path

Saved plans, requests, and activity now live at:

- `E:\AKELA\codex\forgeai-gym-coach\server\data\db.json`
