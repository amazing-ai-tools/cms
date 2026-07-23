# Authenticated Draft Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private draft preview URL that opens from the CMS in a new tab and renders the current draft without publishing.

**Architecture:** Add a small route switch in `App` for `/preview/:nodeId`. The preview route reuses `AuthService` and `PageContextService`, requires an authenticated session, and renders `PageDraftPreview` without the workspace shell. `WorkspaceShell` adds a new tab action when the selected node has a draft.

**Tech Stack:** React 18, TypeScript, Testing Library, Vitest, existing local service interfaces.

---

### Task 1: Preview Route Tests

**Files:**
- Test: `src/page/AuthenticatedDraftPreviewRoute.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing authenticated route test**

Create `src/page/AuthenticatedDraftPreviewRoute.test.tsx` with a fixture that saves a draft through `createLocalPageContextService`, navigates to `/preview/page-1`, renders `App`, and expects the draft heading to appear while workspace regions are absent.

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- src/page/AuthenticatedDraftPreviewRoute.test.tsx`
Expected: fail because `App` does not handle `/preview/:id`.

- [ ] **Step 3: Implement the route**

Add a preview route branch in `App` that restores auth, loads the requested page context, and renders `PageDraftPreview` for the draft.

- [ ] **Step 4: Run the route test to verify it passes**

Run: `npm test -- src/page/AuthenticatedDraftPreviewRoute.test.tsx`
Expected: pass.

### Task 2: Workspace New Tab Action

**Files:**
- Test: `src/page/AuthenticatedDraftPreviewRoute.test.tsx`
- Modify: `src/workspace/WorkspaceShell.tsx`

- [ ] **Step 1: Write the failing new tab action test**

Add a test that renders a workspace with a selected draft, clicks `Open draft preview`, and expects `window.open('/preview/<page-id>', '_blank', 'noopener,noreferrer')`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/page/AuthenticatedDraftPreviewRoute.test.tsx`
Expected: fail because the button does not exist.

- [ ] **Step 3: Add the button**

Add `Open draft preview` beside the existing preview actions, disabled until a draft exists and hidden from published-version viewing.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/page/AuthenticatedDraftPreviewRoute.test.tsx`
Expected: pass.

### Task 3: Verification and Deploy

**Files:**
- Validate all changed files.

- [ ] **Step 1: Run full tests**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Commit and deploy**

Commit the spec, plan, tests, and implementation. Push `main` and monitor the GitHub Actions deployment to a terminal result.
