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

Optional repository variables for overriding the production AI API host:

- `VITE_GENERATION_API_URL`
- `VITE_AI_SETTINGS_API_BASE_URL`

When these are not set, the production frontend at `cms.app.amazing-ai.tools` calls
`https://cms.api.amazing-ai.tools`.

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

## CMS AI Generation API

The Generate button uses a Node API deployed on the VPS:

- `GET /healthz`
- `GET /api/workspaces/:workspaceId/ai-settings`
- `PUT /api/workspaces/:workspaceId/ai-settings`
- `POST /api/generation/draft`
- `POST /api/cdn/publish-version`
- `GET /cdn/*`

Provider API keys are saved per workspace through the settings endpoint and stored only on the
server at `AI_WORKSPACE_SETTINGS_FILE`. The browser receives `hasApiKey`, provider, model, and
effort/language metadata, never the key value.

Supported providers are `xai`, `openai`, and `anthropic`. The frontend sends reasoning effort only
for provider/model combinations that advertise support.

Published page JSON, renderer JavaScript, and uploaded media assets are written to `CDN_ROOT_DIR`
and exposed through `PUBLIC_CDN_BASE_URL`, defaulting to
`https://cms.api.amazing-ai.tools/cdn`.
