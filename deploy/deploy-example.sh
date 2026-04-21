#!/usr/bin/env bash
set -euo pipefail

# Example usage:
# ./deploy/deploy-example.sh root@your-droplet-ip

TARGET_HOST="${1:-}"
TARGET_PATH="/opt/outbound-forge"

if [[ -z "$TARGET_HOST" ]]; then
  echo "Usage: $0 user@host"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

rsync -avz --delete \
  --exclude-from="$SCRIPT_DIR/rsync-exclude.txt" \
  "$PROJECT_ROOT/" "$TARGET_HOST:$TARGET_PATH/"

echo
echo "Project synced to $TARGET_HOST:$TARGET_PATH"
echo "Next:"
echo "1. SSH into the server"
echo "2. Create $TARGET_PATH/.env"
echo "3. Run: sudo bash $TARGET_PATH/deploy/bootstrap-ubuntu.sh"
