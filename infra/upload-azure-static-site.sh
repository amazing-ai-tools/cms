#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:-cmscdn6c9105a7}"

if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "Missing $DIST_DIR/index.html. Run npm run build before uploading." >&2
  exit 1
fi

az storage blob delete-batch \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --auth-mode key \
  --source '$web' \
  --output none

az storage blob upload-batch \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --auth-mode key \
  --destination '$web' \
  --source "$DIST_DIR" \
  --overwrite true \
  --output table

az storage account show \
  --name "$STORAGE_ACCOUNT_NAME" \
  --query "{name:name,staticWebsiteEndpoint:primaryEndpoints.web}" \
  --output json
