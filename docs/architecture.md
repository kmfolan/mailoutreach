# Outbound Forge Architecture

## Current Shape

The current MVP is intentionally simple:

- static front end served from the project root
- built-in Node HTTP server in `server/src/index.js`
- protected login gate with server-side sessions
- local persisted data in `server/data/db.json`

## Near-Term Target

The next useful architecture step is:

1. front end remains simple and server-rendered/static
2. API remains a Node service
3. data moves from JSON file to Postgres
4. deployment moves behind HTTPS on DigitalOcean

## Planned Production Split

### 1. Web App

- dashboard
- setup request form
- plan history
- admin/operator review

### 2. API Layer

- authentication and session handling
- setup request intake
- infrastructure planning logic
- audit/event history

### 3. Data Layer

- users
- plans
- requests
- activities
- future provisioning jobs

### 4. Integration Layer

- DNS provider
- domain registrar
- Google Workspace or Microsoft 365
- optional sequencer integrations

## Product Boundary

The key decision still ahead:

- planning tool only
- or planning plus real infrastructure provisioning

That choice will determine how much of the production architecture needs to be built next.
