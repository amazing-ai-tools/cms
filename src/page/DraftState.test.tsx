import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import type { GenerationResult, GenerationService } from '../generation/types';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalPageContextService } from './localPageContextService';
import type { PageDraft } from './types';

const user: AuthUser = {
  id: 'google-draft-state-user',
  email: 'draft-state@example.com',
  name: 'Draft State User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string, title: string): PageDraft {
  return {
    id: 'draft-1',
    pageId,
    title,
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: title,
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

async function createWorkspaceFixture(storagePrefix: string) {
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

  return {
    authService,
    contentService,
    page,
    pageContextService,
    pageContextStorageKey: `${storagePrefix}-context`,
    workspaceService,
  };
}

describe('draft state and dirty tracking', () => {
  test('generation saves output as an unpublished draft without creating a published version', async () => {
    const services = await createWorkspaceFixture('generated-draft-state');
    const generatedDraft = draftFor(services.page.id, 'Generated draft proposal');
    const generationService: GenerationService = {
      generateDraft: vi.fn(async (): Promise<GenerationResult> => ({
        draft: generatedDraft,
        job: {
          id: 'job-1',
          pageId: services.page.id,
          status: 'succeeded',
          steps: ['Saving proposed draft'],
        },
      })),
    };

    render(
      <App
        authService={services.authService}
        contentService={services.contentService}
        generationService={generationService}
        pageContextService={services.pageContextService}
        workspaceService={services.workspaceService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByText(/draft: unpublished changes/i)).toBeInTheDocument();
    const context = await services.pageContextService.loadPageContext(services.page.id);
    expect(context.draft?.title).toBe('Generated draft proposal');
    expect((context.draft as { isDirty?: boolean } | null)?.isDirty).toBe(true);
    expect(context.versions).toHaveLength(0);
    expect(context.activePublication).toBeNull();
  });

  test('manual edits persist after reload and do not mutate an existing published snapshot', async () => {
    const services = await createWorkspaceFixture('edited-draft-state');
    const publishedDraft = draftFor(services.page.id, 'Published version title');
    await services.pageContextService.saveDraft(publishedDraft);
    const storage = JSON.parse(window.localStorage.getItem(services.pageContextStorageKey) ?? '{}');
    storage.versions = [
      {
        id: 'version-1',
        pageId: services.page.id,
        versionNumber: 1,
        title: publishedDraft.title,
        contentSnapshot: publishedDraft.blocks,
        layoutSnapshot: publishedDraft.layout,
        visualSnapshot: publishedDraft.visual,
        assetManifest: [],
        cdnUrls: {
          content: 'local://cdn/page-1/v1/content.json',
          media: [],
          script: 'local://cdn/embed.js',
        },
        embedUrl: 'local://cdn/page-1/embed.js',
        createdAt: '2026-07-23T00:00:00.000Z',
        createdBy: user.id,
      },
    ];
    storage.publications = [
      {
        activeVersionId: 'version-1',
        lastPublishedAt: '2026-07-23T00:00:00.000Z',
        pageId: services.page.id,
        status: 'published',
      },
    ];
    window.localStorage.setItem(services.pageContextStorageKey, JSON.stringify(storage));

    const firstRender = render(
      <App
        authService={services.authService}
        contentService={services.contentService}
        pageContextService={services.pageContextService}
        workspaceService={services.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    fireEvent.change(within(previewPanel).getByLabelText(/draft title/i), {
      target: { value: 'Edited draft after publish' },
    });

    await waitFor(async () => {
      const context = await services.pageContextService.loadPageContext(services.page.id);
      expect(context.draft?.title).toBe('Edited draft after publish');
      expect((context.draft as { isDirty?: boolean } | null)?.isDirty).toBe(true);
      expect((context.versions[0] as { title: string }).title).toBe('Published version title');
      expect(
        (context.activePublication as { activeVersionId?: string } | null)?.activeVersionId,
      ).toBe('version-1');
    });

    firstRender.unmount();
    render(
      <App
        authService={services.authService}
        contentService={services.contentService}
        pageContextService={services.pageContextService}
        workspaceService={services.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));

    expect(
      await screen.findByRole('heading', { name: /edited draft after publish/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/draft: unpublished changes/i)).toBeInTheDocument();
  });
});
