# Multi-Provider AI Page Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace deterministic Generate behavior in production with a VPS endpoint that uses workspace-selected AI providers to synthesize modern embedded page drafts from user sources.

**Architecture:** Add focused frontend helpers for remote generation, workspace AI settings, and upload source capture, then add a Node HTTP API that enriches links/uploads, prompts the selected provider with structured output, normalizes the result, and returns the existing `GenerationResult` shape.

**Tech Stack:** React, Vite, TypeScript, Vitest, Node 22 HTTP server, xAI Chat Completions API, OpenAI Responses API, Anthropic Messages API, `pdf-parse`.

---

### Task 1: Frontend Remote Generation Contract

**Files:**
- Create: `src/generation/remoteGenerationService.ts`
- Test: `src/generation/RemoteGenerationService.test.ts`
- Modify: `src/main.tsx`

- [x] Write a failing test proving the service POSTs a `GenerationRequest` to `/api/generation/draft` and returns the parsed `GenerationResult`.
- [x] Write a failing test proving non-2xx responses throw the server-provided error message.
- [x] Implement `createRemoteGenerationService`.
- [x] Wire production `main.tsx` to use the remote service.

### Task 1.5: Workspace AI Settings

**Files:**
- Create: `src/workspace/aiSettings.ts`
- Create: `src/workspace/remoteWorkspaceAiSettingsService.ts`
- Create: `src/workspace/localWorkspaceAiSettingsService.ts`
- Test: `src/workspace/remoteWorkspaceAiSettingsService.test.ts`
- Modify: `src/workspace/WorkspaceShell.tsx`

- [x] Add provider/model/effort/key controls to the right-side page input panel.
- [x] Save provider API keys server-side per workspace.
- [x] Send `workspaceId`, provider, model, and supported effort with generation requests.

### Task 2: Upload Source Preservation

**Files:**
- Create: `src/page/uploadSource.ts`
- Test: `src/page/PageUploadSource.test.ts`
- Modify: `src/page/types.ts`
- Modify: `src/page/localPageContextService.ts`
- Modify: `src/generation/payload.ts`
- Modify: `src/workspace/WorkspaceShell.tsx`

- [x] Write failing tests for text and PDF files preserving analyzable source content.
- [x] Extend page asset types with optional `sourceContent` and `sourceEncoding`.
- [x] Read analyzable selected files before saving assets.
- [x] Include source metadata in generation payloads.

### Task 3: VPS Multi-Provider Generation API

**Files:**
- Create: `server/pageDraftSchema.js`
- Create: `server/sourceExtraction.js`
- Create: `server/providerAdapters.js`
- Create: `server/aiGenerationService.js`
- Create: `server/workspaceAiSettingsStore.js`
- Create: `server/generationServer.js`
- Test: `server/generationServer.test.js`
- Modify: `package.json`

- [x] Write failing server tests for `GET /healthz`, missing workspace key failure, workspace settings, and provider response normalization.
- [x] Add `pdf-parse` and Node server scripts.
- [x] Implement link fetching, PDF extraction, AI prompt/schema, draft normalization, provider adapters, and HTTP routing.

### Task 4: Deploy And Verify

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `infra/cms-api.service`
- Create: `infra/cms-api.env.example`
- Modify: `README.md`

- [ ] Add production process/reverse proxy configuration for the VPS API.
- [ ] Document workspace AI settings and optional `VITE_GENERATION_API_URL`.
- [x] Run `npm test` and `npm run build`.
- [ ] Commit, push `main`, watch the deploy workflow, then verify production hosts.
