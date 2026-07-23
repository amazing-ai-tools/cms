# BugZero Static Frontend Template

Minimal Vite + React frontend used by BugZero's simplified app provisioning flow.

The generated app ships with:

- A GitHub Actions deployment workflow for Cloudflare Pages or Azure Static Web Apps.
- Optional Azure Storage static website provisioning/upload for the CDN origin.
- BugZero widget injected from GitHub Actions variables.
- A small first screen that can be replaced by the app's Amazing Chat agent.

Required repository variables:

- `APP_DISPLAY_NAME`
- `APP_DOMAIN`
- `BUGZERO_APP_KEY`
- `BUGZERO_WIDGET_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CALLBACK_URL`
- `RUNNER_LABEL`
- `HOSTING_PROVIDER`

Required repository variables when Azure CDN origin upload is enabled:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_CDN_RESOURCE_GROUP`
- `AZURE_CDN_STORAGE_ACCOUNT`

Required repository secret for the current `cloudflare_pages` hosting provider:

- `CLOUDFLARE_API_TOKEN`

Required repository secret for `azure_static_web_app` hosting:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
