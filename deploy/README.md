# Deployment Bootstrap

This folder contains the first-pass deployment assets for running Outbound Forge on a DigitalOcean droplet.

## Files

- `outbound-forge.service` - systemd service definition
- `nginx-outbound-forge.conf` - Nginx reverse proxy config
- `bootstrap-ubuntu.sh` - first-pass droplet bootstrap script
- `deploy-example.sh` - example rsync deploy command
- `rsync-exclude.txt` - files to skip during deploy sync

## Expected Server Layout

- app path: `/opt/outbound-forge`
- server process: `run-server.sh`
- app port: `4020`

## Minimum Steps

1. Sync the project to `/opt/outbound-forge`
2. Create `/opt/outbound-forge/.env`
3. Put your real secrets in `.env`
4. Run `sudo bash /opt/outbound-forge/deploy/bootstrap-ubuntu.sh`
5. Point a domain or subdomain at the droplet
6. Add HTTPS with Let's Encrypt

## Suggested Sync Command

From your local machine:

```bash
./deploy/deploy-example.sh root@your-droplet-ip
```
