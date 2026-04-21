# DigitalOcean Deployment Checklist

## Goal

Deploy Outbound Forge as a protected MVP behind HTTPS.

## Recommended First Deployment

- one small Ubuntu droplet
- Nginx in front of the Node app
- Node app listening on an internal port such as `4020`
- HTTPS via Let's Encrypt

## Environment Variables

- `PORT`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `AUTH_SESSION_SECRET`
- `NODE_ENV=production`
- `COOKIE_SECURE=true`

## First Steps

1. Create the droplet
2. Point a domain or subdomain at it
3. Install Node on the server
4. Copy the project to the server
5. Run the app behind a process manager such as `pm2` or `systemd`
6. Put Nginx in front of the app
7. Enable HTTPS

## After First Deploy

- move data from `server/data/db.json` to Postgres
- replace launcher-style local secrets with real environment secrets
- add backups and logs
- add monitoring and restart policy
