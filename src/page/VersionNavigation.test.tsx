import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';
import type { PageDraft } from './types';

const user: AuthUser = {
  id: 'google-version-user',
  email: 'versions@example.com',
  name: 'Version User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string, title: string): PageDraft {
  return {
    id: `draft-${pageId}`,
    pageId,
    title,
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: `${title} body`,
        layout: {
          column: 1,
          row: 1,
          width: 12,
        },
        visual: {
          backgroundColor: '#f7fbf5',
          textColor: '#17211b',
          accentColor: '#2f7d5f',
          size: 'large',
        },
      },
    ],
    layout: {
      canvas: {
        maxWidth: 1120,
      },
      sections: [
        {
          id: 'section-generated-proposal',
          blockIds: ['block-hero'],
        },
      ],
    },
    visual: {
      accentColor: '#2f7d5f',
      backgroundColor: '#fbfcf8',
      textColor: '#18201c',
      spacing: 'balanced',
    },
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

async function renderWorkspaceWithVersions() {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: 'version-nav-auth',
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: 'version-nav-workspace',
  });
  const contentService = createLocalContentService({
    storageKey: 'version-nav-content',
  });
  const pageContextService = createLocalPageContextService({
    storageKey: 'version-nav-context',
  });
  const workspace = await workspaceService.loadOrCreateWorkspace(user);
  const category = await contentService.createNode({
    workspaceId: workspace.workspace.id,
    parentId: null,
    type: 'category',
    title: 'Category 1',
  });
  const page = await contentService.createNode({
    workspaceId: workspace.workspace.id,
    parentId: category.id,
    type: 'page',
    title: 'Page 1',
  });

  await pageContextService.saveDraft(draftFor(page.id, 'First published version'));
  await pageContextService.publishDraft({ createdBy: user.id, pageId: page.id });
  await pageContextService.saveDraft(draftFor(page.id, 'Second published version'));
  await pageContextService.publishDraft({ createdBy: user.id, pageId: page.id });
  await pageContextService.saveDraft(draftFor(page.id, 'Unpublished draft version'));

  render(
    <App
      authService={authService}
      contentService={contentService}
      pageContextService={pageContextService}
      workspaceService={workspaceService}
    />,
  );

  await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
  return { page, pageContextService };
}

describe('version navigation', () => {
  test('shows published versions, indicates active version, and opens versions without overwriting draft', async () => {
    const { page, pageContextService } = await renderWorkspaceWithVersions();
    const inputsPanel = screen.getByRole('region', { name: /page inputs/i });
    const previewPanel = screen.getByRole('region', { name: /page preview/i });

    expect(await within(inputsPanel).findByText(/versions: 2/i)).toBeInTheDocument();
    expect(
      within(previewPanel).getByRole('heading', { name: /unpublished draft version/i }),
    ).toBeInTheDocument();
    expect(within(previewPanel).getByText(/version 2 active/i)).toBeInTheDocument();

    await userEvent.click(within(previewPanel).getByRole('button', { name: /open version 1/i }));

    expect(
      await within(previewPanel).findByRole('heading', { name: /first published version/i }),
    ).toBeInTheDocument();
    expect(within(previewPanel).getByText(/viewing version 1/i)).toBeInTheDocument();
    expect(within(previewPanel).queryByLabelText(/draft title/i)).not.toBeInTheDocument();

    await userEvent.click(within(previewPanel).getByRole('button', { name: /return to draft/i }));
    expect(
      await within(previewPanel).findByRole('heading', { name: /unpublished draft version/i }),
    ).toBeInTheDocument();
    expect((await pageContextService.loadPageContext(page.id)).draft?.title).toBe(
      'Unpublished draft version',
    );
  });
});
