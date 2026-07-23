# PRD

# PRD - Project Requirements

**Project Name:** Assisted Multi-Site Content CMS

**Date:** 2026-07-23

**Version:** 1.0

## 1. Overview
**One-sentence description:**  
A Google-authenticated CMS that lets content managers, site owners, and content operations teams create, organize, generate with AI, edit, version, publish, and embed reusable content pages for multiple external sites.

**Problem it solves:**  
Creating and maintaining reusable content for multiple sites is difficult when teams need page-specific media and ideas, AI-assisted content/layout generation, editing, versioning, CDN publication, and external embedding.

**Primary objective:**  
Provide a simple end-to-end workflow for producing page content and publishing the active version, including page content, JavaScript, and media assets, to a CDN for use on external sites through an embed script.

## 2. Target Audience
**Primary User (Persona):**  
- Role: Content manager, site owner, or content operations team member
- Context: Creates and manages reusable content for multiple sites from a Google-authenticated content workspace
- Main needs: Organize content hierarchically, attach media and ideas, generate page proposals with AI, edit page output, manage versions, publish active versions, and embed published pages externally

## 3. Scope
**In Scope (main capabilities):**  
- Google account authentication
- User content workspace
- Categories and subcategories
- Pages inside categories or subcategories
- Pages nested inside other pages
- Simple chat-style page creation UI
- Left-side page/preview area with Generate action
- Right-side chat/panel for uploading images, media, PDFs, Word files, links, ideas, and desired content descriptions
- AI-assisted generation of page content and layout/positioning
- Display of what is being generated
- Post-generation editing of title, size, color, and mentioned visual or structural attributes
- Draft-to-publish workflow
- Version creation on publish
- Active functional published version handling
- Version navigation inside the CMS
- CDN-backed delivery of page content, JavaScript, and media assets
- External site embedding through a script

**Out of Scope:**  
- Detailed workspace permissions and collaboration model
- Exact AI generation scope beyond content, layout/positioning, and mentioned editable attributes
- Detailed embed script API, security rules, domain rules, cache behavior, SEO behavior, and customization
- Complete supported media type list, upload limits, and detailed Word/PDF handling
- Final URL and routing rules for categories, subcategories, and nested pages
- Version diffing, rollback, retention rules, and stored version limits
- Final commercial product name and technical stack
- Future end-user consumption flow beyond external script embedding

## 4. Functional Requirements (MoSCoW)

**FR-001** - Google Authentication  
**Priority:** Must  
**Description:** The system must allow users to log in with a Google account.  
**Acceptance Criteria:**  
- Users can authenticate using Google.
- Authenticated users can access their own content workspace.

**FR-002** - Content Workspace  
**Priority:** Must  
**Description:** The system must provide a content workspace for managing pages across multiple sites.  
**Acceptance Criteria:**  
- Users can create or access a content workspace.
- Workspace content is associated with the authenticated Google account.

**FR-003** - Hierarchical Content Structure  
**Priority:** Must  
**Description:** The system must support categories, subcategories, pages inside categories/subcategories, and pages nested inside other pages.  
**Acceptance Criteria:**  
- Users can create categories and subcategories.
- Users can create pages inside categories or subcategories.
- Users can create pages inside other pages.

**FR-004** - Chat-Style Page Creation Inputs  
**Priority:** Must  
**Description:** The system must provide a simple page-specific creation interface for uploading media and recording ideas.  
**Acceptance Criteria:**  
- The right-side chat/panel supports uploading images, media, PDFs, and Word files.
- The right-side chat/panel supports entering links, ideas, and desired content descriptions for the selected page.
- Uploaded materials and ideas are associated with the selected page.

**FR-005** - AI-Assisted Page Generation  
**Priority:** Must  
**Description:** The system must generate a proposed page with content and layout/positioning based on the selected page's attachments and ideas.  
**Acceptance Criteria:**  
- Users can trigger generation from the left-side Generate action.
- The generated output includes proposed content.
- The generated output includes proposed layout or positioning.
- The system shows what is being generated.

**FR-006** - Post-Generation Editing  
**Priority:** Must  
**Description:** The system must allow users to edit generated page output after generation.  
**Acceptance Criteria:**  
- Users can edit the page title.
- Users can edit size, color, and other mentioned visual or structural attributes.

**FR-007** - Draft and Publish Workflow  
**Priority:** Must  
**Description:** The system must keep edits in draft state until the user publishes them.  
**Acceptance Criteria:**  
- Unpublished changes remain in draft state.
- While in draft, users can continue editing freely.
- Publishing changes the selected draft into a published version.

**FR-008** - Versioning  
**Priority:** Must  
**Description:** The system must create a version when a page is published and make the published version the active functional version.  
**Acceptance Criteria:**  
- Publishing creates a version.
- Editing and republishing creates a new version.
- The republished version becomes the active functional version.

**FR-009** - Version Navigation  
**Priority:** Must  
**Description:** The system must allow users to navigate between versions inside the CMS.  
**Acceptance Criteria:**  
- Users can view available versions for a page.
- Users can navigate between versions in the software.

**FR-010** - CDN Publication and External Embed  
**Priority:** Must  
**Description:** The system must publish page content, JavaScript, and media assets to a CDN and allow external sites to load the page through a script.  
**Acceptance Criteria:**  
- Published page content is available through CDN delivery.
- Published JavaScript and media assets are available through CDN delivery.
- An external site can embed the created page using a script.

## 5. Main User Stories
- As a content manager, I want to log in with Google so that I can access my content workspace.
- As a content manager, I want to organize categories, subcategories, and nested pages so that I can structure content for multiple sites.
- As a content manager, I want to attach media and ideas to a page so that the AI can generate a relevant page proposal.
- As a content manager, I want to edit generated content and visual attributes so that the page matches my intended presentation.
- As a content manager, I want publishing to create versions so that I can control which version is functional and active.
- As a content manager, I want to embed a published page on another site so that the content can be consumed outside the CMS.

## 6. Main Flows
**Flow 1 - Login and Workspace Access**  
1. User logs in with a Google account.
2. System authenticates the user.
3. User accesses the content workspace.

**Flow 2 - Create and Generate a Page**  
1. User creates or selects a category, subcategory, or parent page.
2. User creates a page in the selected hierarchy.
3. User uploads media and enters links, ideas, and desired content details in the right-side chat/panel.
4. User clicks Generate in the left-side page/preview area.
5. System shows what is being generated.
6. System generates proposed content and layout or positioning.
7. User edits title, size, color, and other available attributes.

**Flow 3 - Publish and Embed**  
1. User keeps generated or edited content in draft state.
2. User publishes the page.
3. System creates a version and marks it as the active functional version.
4. System publishes the page content, JavaScript, and media assets to the CDN.
5. User embeds the page on an external site using a script.

**Flow 4 - Edit and Republish**  
1. User opens an existing page.
2. User edits the page through the creation and editing flow.
3. System keeps changes as draft until publish.
4. User republishes the page.
5. System creates a new version and makes it the active functional version.

## 7. Business Rules & Integrations
**Business Rules:**
- BR-01: Users authenticate through Google.
- BR-02: Content is managed inside a workspace tied to the authenticated Google account.
- BR-03: Pages can exist inside categories, subcategories, and other pages.
- BR-04: Page inputs and generation are scoped to a specific page.
- BR-05: Content remains in draft state until published.
- BR-06: Publishing creates a version.
- BR-07: The published version is the functional active version.
- BR-08: Republish creates a new version and makes it active.
- BR-09: Published delivery must include page content, JavaScript, and media assets.
- BR-10: Published resources must be available through a CDN for external consumption.

**Required Integrations:**
- Google authentication
- AI-assisted generation capability
- CDN for published page content, JavaScript, and media assets
- External website embed through script

## 8. Assumptions and Constraints
- Assumptions: Users are people or teams managing content across multiple sites; generated content and layout are based on page-specific uploaded media and ideas; pages can function as hierarchy levels that contain other pages.
- Constraints: The page creation screen must remain simple and chat-like; media and idea inputs are on the right; page preview and Generate action are on the left; publishing implies versioning; published resources must be CDN-backed; external consumption must happen through an embed script; generated pages must meet site quality/fit requirements, but the exact criteria are [Not specified in the conversation].