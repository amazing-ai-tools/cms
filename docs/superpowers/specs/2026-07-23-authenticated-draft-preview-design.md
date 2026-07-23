# Authenticated Draft Preview Design

## Goal

Editors need a CMS link that opens a draft preview in a new tab and shows the content as it would appear when embedded, without publishing the page.

## Approved Behavior

- The workspace shows an `Open draft preview` action when the selected tree item has a draft.
- The action opens `/preview/<node-id>` in a new browser tab.
- The preview URL lives on the CMS app domain, for example `https://cms.app.amazing-ai.tools/preview/node-3`.
- No session token is placed in the URL.
- The new tab reuses the authenticated CMS session from the app domain.
- Signed-out visitors see the same Google sign-in gate and can continue after authentication.
- Signed-in users see only the rendered draft content, not the workspace panels, editor controls, hierarchy, input composer, publish controls, or embed snippet.
- The preview uses `PageDraftPreview`, so draft rendering matches the embedded/published visual contract.
- Opening the preview does not publish the draft, create a version, or change draft dirty state.

## Current Implementation Boundary

The app currently stores auth, workspace, content, and draft state in local browser storage. The first implementation keeps the preview route inside the frontend and reads the draft through the existing `PageContextService`.

When `cms.api.amazing-ai.tools` exists, the same route can load draft data from the backend with the restored user session. The browser-facing preview route should remain on `cms.app.amazing-ai.tools` to avoid exposing tokens in URLs.

## Error States

- No session: render the Google sign-in gate.
- No draft for the requested node: show a focused empty state explaining that the draft must be generated first.
- Draft load failure: show a focused error state without falling back to workspace UI.

## Testing

- Route test: authenticated `/preview/<id>` renders the draft and excludes workspace panels.
- Route test: signed-out `/preview/<id>` renders the Google sign-in gate.
- Workspace test: `Open draft preview` opens `/preview/<id>` in a new tab.
- Existing draft editing, publishing, hierarchy, and generation tests must keep passing.
