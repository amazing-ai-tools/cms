# Assisted Multi-Site Content CMS Project Backlog

Source: `docs/projects/1/prd.md`
GitHub issue: #1
Issue id: `7489ea5d-a685-4bc1-acfe-b10e11bf171d`
Priority: Medium
Date: 2026-07-23

## Purpose

Build an authenticated content management workspace where content managers can organize reusable pages for multiple external sites, collect page-specific inputs, generate page proposals with AI, edit drafts, publish active versions, and embed published pages from CDN-backed assets.

This repository currently contains a minimal Vite, React, and TypeScript static frontend template. The backlog below is written for implementation against that starting point and calls out where backend, storage, authentication, AI, and CDN capabilities must be introduced or integrated.

## Product Boundaries

### In Scope

- Google account authentication.
- Authenticated user workspace tied to the Google account.
- Categories, subcategories, pages inside categories or subcategories, and pages nested inside pages.
- Simple page creation workspace with left-side page preview and Generate action.
- Right-side chat-style panel for uploads, links, ideas, and desired content descriptions.
- AI-assisted generation of page content and layout or positioning.
- Display of generation progress or generated steps.
- Editing generated title, size, color, and other mentioned visual or structural attributes.
- Draft state until publish.
- Version creation on publish.
- Active functional published version handling.
- Version navigation inside the CMS.
- CDN-backed delivery of page content, JavaScript, and media assets.
- External embed through a script.

### Out of Scope For This Backlog

- Workspace team permissions or collaboration rules.
- Fine-grained embed API, domain allowlists, SEO behavior, and cache invalidation policy beyond a working embed path.
- Complete media type matrix, upload limits, PDF extraction behavior, and Word extraction behavior beyond accepting/storing those file inputs.
- Version diffing, rollback, retention, and stored version limits.
- Final marketing name, pricing, and commercial packaging.

## Implementation Notes

- Keep the current Vite, React, and TypeScript stack unless the implementation phase explicitly changes the product architecture.
- Add a clear service boundary for auth, workspace data, generation, publishing, CDN delivery, and embed metadata. Frontend components should not directly own persistence or integration details.
- If a backend is not already present when implementation starts, add the minimum backend or serverless API layer needed to support Google OAuth session validation, workspace storage, uploads, generation calls, publish/version records, and CDN publication.
- Treat page inputs, generated drafts, published versions, CDN asset references, and embed script metadata as separate data concepts.
- Do not make draft changes mutate published versions. A publish operation creates a new immutable version and marks it active.
- Where integrations are unavailable in local development, provide explicit adapter interfaces and deterministic local implementations that can be replaced by production providers without changing the UI contract.

## Suggested Data Model

Use this as implementation guidance, not a mandatory schema name list.

- `User`: Google account identity, email, display name, avatar, auth provider id.
- `Workspace`: id, owner user id, name, created/updated timestamps.
- `ContentNode`: id, workspace id, parent id, node type (`category`, `subcategory`, `page`), title, sort order, created/updated timestamps.
- `PageDraft`: page id, title, generated content blocks, layout attributes, visual attributes, dirty state, updated timestamp.
- `PageInput`: id, page id, type (`upload`, `link`, `idea`, `description`), content or asset reference, created timestamp.
- `Asset`: id, page id, filename, MIME type, size, storage URL, CDN URL when published.
- `GenerationJob`: id, page id, status, visible steps, request payload reference, generated output, error.
- `PublishedVersion`: id, page id, version number, title, content snapshot, layout snapshot, asset manifest, CDN URLs, embed URL, created timestamp, created by.
- `PagePublication`: page id, active version id, last published timestamp, status.

## Epic 1: Google Authentication And Workspace Foundation

### [DONE] Story 1.1: Google Sign-In Gate

As a content manager, I want to sign in with Google so I can access my CMS workspace.

Acceptance Criteria:

- Users can start Google authentication from the app entry screen.
- After successful authentication, the app has access to the user's Google account identity needed to associate workspace content.
- Unauthenticated users cannot access workspace screens.
- Authentication errors are displayed in a recoverable state.

Technical Notes:

- Add an auth service adapter that exposes the current session, sign-in, sign-out, and auth state refresh.
- Use environment configuration for Google client credentials and callback URLs.
- Persist only the session/user data needed by the CMS.
- Add tests for signed-out redirect/gate behavior and signed-in workspace access.

### [DONE] Story 1.2: Authenticated Workspace Creation And Access

As a content manager, I want my workspace to be created or loaded after login so my content belongs to my Google account.

Acceptance Criteria:

- On first sign-in, the system creates a workspace associated with the authenticated Google account.
- On later sign-ins, the system loads the user's existing workspace.
- Workspace data is not visible to another authenticated Google account.
- Workspace load and creation states are visible in the UI.

Technical Notes:

- Add workspace persistence keyed by authenticated user id.
- Keep workspace ownership checks in the backend/API layer, not only in the UI.
- Add local seed or fixture support for development.

### [DONE] Story 1.3: CMS Workspace Shell

As a content manager, I want a dedicated workspace shell so I can navigate content, preview pages, and manage page inputs from one place.

Acceptance Criteria:

- Authenticated users land in a CMS workspace screen rather than the static template landing page.
- The shell has a content hierarchy area, a left-side page/preview area with Generate action, and a right-side chat/input panel.
- The currently selected content node or page is clear.
- Empty workspace and empty page states guide the user toward creating categories or pages without relying on marketing copy.

Technical Notes:

- Replace the template first screen with the actual CMS workspace.
- Preserve the existing BugZero widget bootstrapping behavior unless it conflicts with authentication routing.
- Use responsive layout rules so the preview and chat panel remain usable on smaller screens.

## Epic 2: Hierarchical Content Structure

### [DONE] Story 2.1: Content Hierarchy Data Model

As a content manager, I want categories, subcategories, and pages to share a consistent hierarchy so I can organize content across multiple sites.

Acceptance Criteria:

- The data model supports root categories.
- The data model supports subcategories under categories.
- The data model supports pages inside categories and subcategories.
- The data model supports pages nested inside other pages.
- The system prevents invalid parent-child relationships that would create cycles.

Technical Notes:

- Represent hierarchy with parent references and node types.
- Keep ordering fields available for future manual ordering.
- Enforce hierarchy validation in the API or persistence layer.

### [DONE] Story 2.2: Create Categories, Subcategories, And Pages

As a content manager, I want to create content nodes in the selected hierarchy location so the structure matches my external sites.

Acceptance Criteria:

- Users can create a category at the workspace root.
- Users can create a subcategory under a category.
- Users can create a page under a category or subcategory.
- Users can create a child page under another page.
- New nodes appear in the hierarchy immediately after creation and remain after reload.

Technical Notes:

- Provide creation controls that are contextual to the selected node type.
- Generate sensible default titles for new nodes and allow page titles to be edited through the page editing story.
- Add tests for valid and invalid parent selections.

### [DONE] Story 2.3: Select And Load Page Context

As a content manager, I want selecting a page to load that page's draft, inputs, versions, and publication state.

Acceptance Criteria:

- Selecting a page updates the preview area to that page.
- Selecting a page updates the right-side panel to inputs associated with that page.
- Selecting a category or subcategory shows a non-page state and page creation options.
- Selection state survives a normal reload when feasible.

Technical Notes:

- Keep selected node id in route state or a stable URL query/path.
- Fetch page draft, inputs, versions, and active publication state through a single page context loader where practical.

## Epic 3: Page-Specific Inputs And Chat Panel

### [DONE] Story 3.1: Right-Side Chat-Style Input Panel

As a content manager, I want a chat-style panel for page notes and requested content so the AI has page-specific context.

Acceptance Criteria:

- The right-side panel accepts free-text ideas.
- The right-side panel accepts desired content descriptions.
- Entries are saved against the selected page.
- Entries are displayed in chronological order for the selected page.
- Switching pages does not mix inputs between pages.

Technical Notes:

- Store structured input type metadata rather than only plain text.
- Disable input entry until a page is selected.
- Add optimistic UI only if failures can be reconciled clearly.

### [DONE] Story 3.2: Upload Page Materials

As a content manager, I want to upload images, media, PDFs, and Word files so generation can use page-specific materials.

Acceptance Criteria:

- The panel supports uploading images.
- The panel supports uploading media files.
- The panel supports uploading PDFs.
- The panel supports uploading Word files.
- Uploaded files are associated with the selected page.
- Uploaded files show filename, type, upload state, and failure state.

Technical Notes:

- Use a storage service adapter that returns stable asset references.
- Preserve original filenames and MIME types.
- Implement initial validation for the PRD-listed file families. Detailed limits can remain configurable.
- Do not require PDF or Word content extraction for the first publishable backlog pass unless the implementation phase adds it explicitly.

### [DONE] Story 3.3: Link Capture

As a content manager, I want to add links for a page so referenced material can inform the generated proposal.

Acceptance Criteria:

- The panel accepts URL input.
- Invalid URLs are rejected with a visible message.
- Valid links are stored against the selected page.
- Stored links are included in the generation request payload.

Technical Notes:

- Normalize URLs server-side or in a shared utility.
- Store optional link labels if the UI needs a readable display name.

## Epic 4: AI-Assisted Generation And Draft Editing

### [DONE] Story 4.1: Generate Action And Generation Visibility

As a content manager, I want to click Generate in the preview area and see what is being generated.

Acceptance Criteria:

- A Generate action is available in the left-side page/preview area for selected pages.
- Triggering generation creates a generation job scoped to the selected page.
- The UI shows generation status and visible steps while generation is running.
- Generation can finish successfully with a proposed draft.
- Generation failures are visible and do not destroy the previous draft.

Technical Notes:

- Use a generation job abstraction with status values such as `queued`, `running`, `succeeded`, and `failed`.
- Include page inputs, attachment references, current draft state, and page hierarchy context in the generation request.
- Make generation status pollable or streamable behind an adapter.

### [DONE] Story 4.2: Structured Generation Output

As a content manager, I want generated output to include both page content and layout or positioning so the page is usable as a proposal.

Acceptance Criteria:

- Generated output includes proposed textual/content blocks.
- Generated output includes layout or positioning data.
- Generated output includes editable visual attributes when applicable.
- Generated output can be rendered in the preview area without manual transformation by the user.

Technical Notes:

- Define a structured draft schema for content blocks, layout metadata, and visual attributes.
- Validate AI output before saving it as the active draft.
- Add a deterministic local generation adapter for development and tests if the AI provider is unavailable locally.

### [DONE] Story 4.3: Render Generated Draft Preview

As a content manager, I want to preview generated content so I can evaluate the page before publishing.

Acceptance Criteria:

- The preview area renders the current draft for the selected page.
- Content blocks appear according to stored layout or positioning data.
- Empty drafts show a clear state with the Generate action available.
- Preview rendering updates after successful generation and after edits.

Technical Notes:

- Keep the renderer reusable for CMS preview and published embed rendering where feasible.
- Avoid coupling the renderer to editing controls.
- Add tests for rendering text blocks, media blocks, and style attributes.

### [DONE] Story 4.4: Edit Generated Page Attributes

As a content manager, I want to edit generated content and visual attributes so the page matches my intended presentation.

Acceptance Criteria:

- Users can edit the page title.
- Users can edit size attributes included in the generated draft.
- Users can edit color attributes included in the generated draft.
- Users can edit other generated visual or structural attributes exposed by the draft schema.
- Edits update the draft preview before publishing.

Technical Notes:

- Use structured form controls for known attributes such as title, size, and color.
- Persist edits as draft changes only.
- Avoid exposing raw JSON as the primary editing interface.

### [DONE] Story 4.5: Draft State And Dirty Tracking

As a content manager, I want unpublished changes to stay in draft state so publishing remains an intentional action.

Acceptance Criteria:

- Generated output is saved as a draft, not as a published version.
- Manual edits are saved as draft changes.
- The UI communicates when the selected page has unpublished draft changes.
- Reloading the page does not discard saved draft changes.
- Published version content remains unchanged until the user publishes again.

Technical Notes:

- Store drafts separately from published version snapshots.
- Track dirty state by comparing draft updated timestamp or revision to active version metadata.

## Epic 5: Publish Workflow, Versioning, And CMS Version Navigation

### [DONE] Story 5.1: Publish Draft To Version

As a content manager, I want publishing to create a version so I can control what is functional and active.

Acceptance Criteria:

- Publishing a draft creates a published version record.
- The published version contains a snapshot of page content, layout, visual attributes, and asset references.
- The new version receives a version number or stable label.
- The source draft remains available for continued editing after publish.

Technical Notes:

- Treat published versions as immutable snapshots.
- Use transactional behavior where possible so version creation and active version update do not diverge.
- Record the user and timestamp for each publish.

### [DONE] Story 5.2: Active Functional Version

As a content manager, I want the latest published version to become active so external sites load the intended content.

Acceptance Criteria:

- After first publish, the created version becomes the active functional version.
- After editing and republishing, the new version becomes the active functional version.
- External embed metadata resolves to the active version.
- If publishing fails, the previous active version remains active.

Technical Notes:

- Maintain a separate active version pointer per page.
- Do not infer active version from max version number alone if publication failed.
- Add tests for first publish, republish, and failed publish behavior.

### [DONE] Story 5.3: Version Navigation In The CMS

As a content manager, I want to view available versions for a page and navigate between them inside the CMS.

Acceptance Criteria:

- The CMS shows available published versions for the selected page.
- Users can open a selected version in a read-only or clearly versioned view.
- The active functional version is indicated.
- Navigating versions does not overwrite the current draft.

Technical Notes:

- Keep draft view and version view distinct in state.
- Rollback or diffing is out of scope unless added in a later backlog.

## Epic 6: CDN Publication And External Embed

### [DONE] Story 6.1: Build Publishable Asset Manifest

As a content manager, I want published page content, JavaScript, and media assets packaged for CDN delivery.

Acceptance Criteria:

- Publish creates or updates a manifest for page content.
- Publish creates or references JavaScript required to render the published page externally.
- Publish includes media asset references needed by the active version.
- The manifest can be used by the embed script to load the active version.

Technical Notes:

- Include version id, page id, content JSON, renderer script URL, media asset URLs, and integrity/cache metadata if available.
- Keep CMS-only draft data out of public manifests.
- Use stable paths that can support multiple pages and versions.

### [DONE] Story 6.2: CDN Delivery Integration

As a content manager, I want published content and assets to be available from a CDN so external sites can load them reliably.

Acceptance Criteria:

- Published page content is available through CDN delivery.
- Published JavaScript is available through CDN delivery.
- Published media assets are available through CDN delivery.
- CDN URLs are stored on the published version or publication manifest.
- Publication failure is visible in the CMS.

Technical Notes:

- Add a CDN service adapter with publish, verify, and URL generation operations.
- For local development, provide a static/public-file adapter that behaves like CDN output.
- Avoid blocking the UI indefinitely while publication verifies delivery.

### [DONE] Story 6.3: External Embed Script

As a content manager, I want a script snippet for a published page so external sites can embed the active version.

Acceptance Criteria:

- The CMS displays an embed script for pages with an active published version.
- The script loads the active version's content from CDN-backed URLs.
- The script renders the page into a target container on an external site.
- If no active version exists, the CMS explains that publishing is required before embedding.

Technical Notes:

- Keep the initial embed API minimal, for example a script tag plus page id or manifest URL.
- The detailed embed API, security rules, domain rules, and SEO behavior remain out of scope beyond a working embed.
- Add a sample local external host page or test fixture to verify the script.

### Story 6.4: End-To-End Publish And Embed Verification

As a content manager, I want confidence that a published page works outside the CMS.

Acceptance Criteria:

- A generated or edited draft can be published.
- The new version becomes active.
- CDN-backed content, JavaScript, and media URLs are available.
- The provided embed script renders the active version in an external-site test page.
- Republishing updates the active embedded result without changing older immutable version records.

Technical Notes:

- Add integration or browser tests that exercise create input, generate, edit, publish, version listing, and external embed rendering using deterministic adapters where needed.
- Include failure-path tests for publish errors preserving the previous active version.

## Cross-Cutting Requirements

### Accessibility And Usability

- Keyboard users can access sign-in, hierarchy creation, page selection, Generate, editing controls, publish, version navigation, and embed snippet copy actions.
- Buttons, inputs, upload states, and status messages have accessible names.
- Status updates for generation and publishing are announced or visible in a non-disruptive way.

### Observability And Error Handling

- Authentication, workspace loading, upload, generation, publish, and CDN failures show actionable UI states.
- Integration adapters should log enough context to diagnose failures without exposing secrets.
- User-facing errors should preserve drafts and active published versions whenever possible.

### Security And Data Handling

- Workspace data must be scoped to the authenticated Google account.
- Uploaded materials and draft inputs must not be publicly exposed unless included in a published version.
- Public CDN manifests should include only data required for external rendering.
- Secrets and provider credentials must come from environment configuration, not source code.

### Testing Expectations

- Unit tests for hierarchy validation, draft/version state transitions, URL validation, and manifest generation.
- Component tests for auth gating, workspace shell, page selection, right-side input panel, generation states, editing controls, publish controls, and version navigation.
- Integration or browser tests for the main flows from the PRD:
  - Login and workspace access.
  - Create and generate a page.
  - Publish and embed.
  - Edit and republish.

## Implementation Sequence

1. Establish auth, workspace loading, and the CMS workspace shell.
2. Add hierarchy persistence and page selection.
3. Add page inputs, uploads, and link capture.
4. Add generation job contract, deterministic local adapter, draft schema, preview rendering, and editing.
5. Add publish/version records and active version handling.
6. Add CDN publication adapter, embed script, and external-site verification.
7. Harden accessibility, error states, and regression coverage for the four PRD flows.

## Definition Of Done

- All Must functional requirements FR-001 through FR-010 are implemented or backed by explicit provider adapters.
- The four PRD main flows work end to end in the target environment.
- Draft edits never modify the active published version until publish succeeds.
- Republish creates a new version and makes it active.
- External embed renders the active published page from CDN-backed content, JavaScript, and media assets.
- Tests cover the main state transitions and integration seams listed above.
- The app no longer presents the static frontend template as its primary authenticated experience.
