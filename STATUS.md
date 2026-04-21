# Outbound Forge Status

## Current Snapshot

Date: 2026-04-14

Outbound Forge is now a protected local MVP for planning cold email infrastructure.

## What Works

- protected login gate in front of the app
- local browser dashboard at `http://127.0.0.1:4020`
- setup request submission
- generated infrastructure plans with domains, mailboxes, capacity, and cost
- persistent local storage in `server/data/db.json`
- activity feed, recommendations, and plan history
- desktop/browser launcher flow

## Main Remaining Work

1. make the local launcher fully boring and dependable
2. add a real database instead of JSON persistence
3. deploy to DigitalOcean with HTTPS and environment secrets
4. decide whether v1 is only a planning tool or includes real provisioning

## Known Constraints

- old stale processes on port `4000` may still exist outside this project flow
- current stable local port is `4020`
- auth is suitable for a protected MVP, not final production identity
- no real domain, DNS, mailbox, or billing integrations yet
