#!/usr/bin/env bash
set -euo pipefail

LOCATION="${LOCATION:-eastus2}"
RESOURCE_GROUP_NAME="${RESOURCE_GROUP_NAME:-cms-rg}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:-cmscdn6c9105a7}"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-cms-cdn-storage}"

az group create \
  --name "$RESOURCE_GROUP_NAME" \
  --location "$LOCATION" \
  --output none

az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$(dirname "$0")/azure-cdn-main.bicep" \
  --parameters location="$LOCATION" resourceGroupName="$RESOURCE_GROUP_NAME" storageAccountName="$STORAGE_ACCOUNT_NAME" \
  --output table

az storage blob service-properties update \
  --account-name "$STORAGE_ACCOUNT_NAME" \
  --auth-mode key \
  --static-website \
  --index-document index.html \
  --404-document index.html \
  --output none

az storage account show \
  --name "$STORAGE_ACCOUNT_NAME" \
  --resource-group "$RESOURCE_GROUP_NAME" \
  --query "{resourceGroup:resourceGroup,name:name,location:primaryLocation,staticWebsiteEndpoint:primaryEndpoints.web}" \
  --output json
