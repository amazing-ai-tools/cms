import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  id: 'google-publish-user',
  email: 'publish@example.com',
  name: 'Publish User',
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
        content: `${title} hero copy`,
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

async function createPublishFixture(storagePrefix: string) {
  const authService = createLocalAuthService({
    initialUser: user,
    storageKey: `${storagePrefix}-auth`,
  });
  const workspaceService = createLocalWorkspaceService({
    storageKey: `${storagePrefix}-workspace`,
  });
  const contentService = createLocalContentService({
    storageKey: `${storagePrefix}-content`,
  });
  const pageContextService = createLocalPageContextService({
    storageKey: `${storagePrefix}-context`,
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
  await pageContextService.addAsset({
    pageId: page.id,
    filename: 'hero.jpg',
    mimeType: 'image/jpeg',
    size: 2048,
  });
  await pageContextService.saveDraft(draftFor(page.id, 'Publishable draft'));

  return {
    authService,
    contentService,
    page,
    pageContextService,
    workspaceService,
  };
}

describe('publish draft to version', () => {
  test('publishing a draft creates an immutable version snapshot with a version number', async () => {
    const { page, pageContextService } = await createPublishFixture('publish-service');

    const version = await pageContextService.publishDraft({
      createdBy: user.id,
      pageId: page.id,
    });

    expect(version).toMatchObject({
      pageId: page.id,
      versionNumber: 1,
      title: 'Publishable draft',
      contentSnapshot: [expect.objectContaining({ content: 'Publishable draft hero copy' })],
      layoutSnapshot: expect.objectContaining({
        sections: [expect.objectContaining({ blockIds: ['block-hero'] })],
      }),
      visualSnapshot: expect.objectContaining({ accentColor: '#2f7d5f' }),
      assetManifest: [
        expect.objectContaining({
          assetId: 'asset-1',
          filename: 'hero.jpg',
        }),
      ],
      createdBy: user.id,
    });

    await pageContextService.saveDraft(draftFor(page.id, 'Edited after publish'));
    const context = await pageContextService.loadPageContext(page.id);
    expect(context.draft?.title).toBe('Edited after publish');
    expect(context.versions).toHaveLength(1);
    expect(context.versions[0].title).toBe('Publishable draft');
  });

  test('CMS publish action creates a version while keeping the draft editable', async () => {
    const services = await createPublishFixture('publish-ui');

    render(
      <App
        authService={services.authService}
        contentService={services.contentService}
        pageContextService={services.pageContextService}
        workspaceService={services.workspaceService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    await userEvent.click(within(previewPanel).getByRole('button', { name: /publish draft/i }));

    expect(await screen.findByText(/versions: 1/i)).toBeInTheDocument();
    expect(await screen.findByText(/draft: up to date/i)).toBeInTheDocument();

    fireEvent.change(within(previewPanel).getByLabelText(/draft title/i), {
      target: { value: 'Edited draft after version' },
    });

    expect(
      await within(previewPanel).findByRole('heading', { name: /edited draft after version/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/draft: unpublished changes/i)).toBeInTheDocument();
    await waitFor(async () => {
      const context = await services.pageContextService.loadPageContext(services.page.id);
      expect(context.versions[0].title).toBe('Publishable draft');
      expect(context.draft?.title).toBe('Edited draft after version');
    });
  });
});
