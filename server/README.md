# Outbound Forge Server

Dependency-free Node server for the Outbound Forge MVP.

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/dashboard`
- `POST /api/setup-request`

## Local Run

The launcher uses port `4020`.

Open:

- `http://127.0.0.1:4020`

## Notes

- Static front-end files are served from the project root.
- Plans, requests, and activity are persisted to `server/data/db.json`.
- This is a protected MVP baseline, not the final production deployment shape.
