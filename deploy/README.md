# Deployment Bootstrap

This folder contains the first-pass deployment assets for running Outbound Forge on a DigitalOcean droplet.

## Files

- `outbound-forge.service` - systemd service definition
- `nginx-outbound-forge.conf` - Nginx reverse proxy config

## Expected Server Layout

- app path: `/opt/outbound-forge`
- server process: `run-server.sh`
- app port: `4020`

## Minimum Steps

1. Copy the project to `/opt/outbound-forge`
2. Create `/opt/outbound-forge/.env`
3. Put your real secrets in `.env`
4. Install Nginx
5. Install Node on the droplet
6. Copy `outbound-forge.service` into `/etc/systemd/system/`
7. Copy `nginx-outbound-forge.conf` into your Nginx sites config
8. Enable the systemd service
9. Reload Nginx
10. Add HTTPS with Let's Encrypt
