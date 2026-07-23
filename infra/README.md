# cms Azure Infra

This directory contains reproducible Azure infrastructure for the `cms` app.

## Static CDN Origin

`provision-azure-cdn-storage.sh` provisions:

- Resource group: `cms-rg`
- Storage account: `cmscdn6c9105a7`
- Static website hosting on the storage account `$web` container

Deploy with:

```bash
./infra/provision-azure-cdn-storage.sh
```

Upload the production build to the static website container with:

```bash
npm run build
./infra/upload-azure-static-site.sh dist
```

The GitHub Actions deploy workflow runs both scripts when these repository
variables are set:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_CDN_RESOURCE_GROUP`
- `AZURE_CDN_STORAGE_ACCOUNT`

The Azure identity should use GitHub OIDC for
`repo:amazing-ai-tools/cms:ref:refs/heads/main` and needs Contributor access at
the subscription scope so the workflow can create or update the resource group,
storage account, static website settings, and upload using storage account keys.

The storage static website endpoint can be used as an origin for Azure Front Door.
