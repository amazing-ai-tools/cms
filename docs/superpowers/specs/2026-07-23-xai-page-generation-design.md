# Multi-Provider AI Page Generation Design

## Goal

The Generate button must call a real AI generation endpoint on the VPS. The endpoint analyzes the client's page instructions, ideas, descriptions, reference links, and uploaded materials, then returns a structured page draft that can be previewed, edited, published, and embedded in the client's site.

## Product Behavior

- The existing workspace layout remains unchanged: hierarchy and editing controls on the left, page preview in the center, chat/material input on the right.
- User-provided information is treated as source material for synthesis, not as text to append directly.
- Links are fetched server-side and summarized into the generation context.
- Uploaded text-like files and PDFs are preserved by the frontend when the user sends them, then passed to the endpoint for analysis during generation.
- The AI is prompted as a senior content designer creating a modern embedded page for another website, based on the user's intent and references.
- Each workspace can choose `xai`, `openai`, or `anthropic`, configure the model, and save the provider API key server-side.
- Reasoning effort is shown and sent only when the selected provider/model supports it.
- The generated draft must match the current `PageDraft` schema: `hero`, `text`, and `media` blocks with layout and visual attributes.

## Architecture

- Add a Node HTTP API in `server/` with `POST /api/generation/draft`, `GET /healthz`, and workspace-scoped AI settings routes.
- Keep provider keys only in the VPS workspace settings store; never expose them through Vite or browser code.
- Add a browser `remoteGenerationService` that calls the API endpoint and returns the existing `GenerationResult` contract.
- Add a browser `remoteWorkspaceAiSettingsService` for `/api/workspaces/:workspaceId/ai-settings`.
- Keep `createLocalGenerationService` as a development/test fallback helper, but production `main.tsx` uses the remote service by default.
- Add server-side prompt/schema/normalization and provider adapters for xAI Chat Completions, OpenAI Responses, and Anthropic Messages so the app never saves invalid AI output.

## Error Handling

- Missing workspace provider key returns a failed generation job with an actionable message.
- Link fetch failures and unsupported uploads are included as unavailable source notes instead of blocking the whole generation.
- AI/network/JSON validation failures return a failed job without replacing the existing draft.

## Verification

- Unit tests cover the remote frontend service request/response behavior.
- Unit tests cover workspace AI settings save/load behavior.
- Unit tests cover upload source preservation for analyzable files.
- Server tests cover endpoint health, missing key failure, workspace settings, and structured response normalization for xAI, OpenAI, and Anthropic.
- Full verification is `npm test` and `npm run build`.
