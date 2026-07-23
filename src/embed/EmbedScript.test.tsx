import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { PageDraft } from '../page/types';
import { createLocalCdnService } from '../publication/localCdnService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { buildEmbedSnippet, renderEmbedFromCdn } from './embedScript';

const user: AuthUser = {
  id: 'google-embed-user',
  email: 'embed@example.com',
  name: 'Embed User',
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
        content: `${title} external content`,
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

async function createEmbedFixture(storagePrefix: string, publish: boolean) {
  const cdnService = createLocalCdnService({ storageKey: `${storagePrefix}-cdn` });
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
    cdnService,
    storageKey: `${storagePrefix}-page`,
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
  await pageContextService.saveDraft(draftFor(page.id, 'Embedded page'));
  if (publish) {
    await pageContextService.publishDraft({ createdBy: user.id, pageId: page.id });
  }

  return {
    authService,
    cdnService,
    contentService,
    page,
    pageContextService,
    workspaceService,
  };
}

describe('external embed script', () => {
  test('builds a script snippet for the active version and renders CDN content into a target', async () => {
    const { cdnService, page, pageContextService } = await createEmbedFixture('embed-runtime', true);
    const activeVersion = await pageContextService.getActivePublishedVersion(page.id);
    expect(activeVersion).not.toBeNull();

    const snippet = buildEmbedSnippet(activeVersion!);

    expect(snippet).toContain(`src="${activeVersion!.cdnUrls.script}"`);
    expect(snippet).toContain(`data-page-id="${page.id}"`);
    expect(snippet).toContain(`data-content-url="${activeVersion!.cdnUrls.content}"`);

    const target = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService,
      contentUrl: activeVersion!.cdnUrls.content,
      target,
    });

    expect(target).toHaveTextContent('Embedded page');
    expect(target).toHaveTextContent('Embedded page external content');
  });

  test('CMS displays an embed script after publish and explains when publishing is required', async () => {
    const unpublishedServices = await createEmbedFixture('embed-unpublished-ui', false);

    const firstRender = render(
      <App
        authService={unpublishedServices.authService}
        contentService={unpublishedServices.contentService}
        pageContextService={unpublishedServices.pageContextService}
        workspaceService={unpublishedServices.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    expect(await screen.findByText(/publish this page before embedding/i)).toBeInTheDocument();

    firstRender.unmount();
    const publishedServices = await createEmbedFixture('embed-published-ui', true);
    render(
      <App
        authService={publishedServices.authService}
        contentService={publishedServices.contentService}
        pageContextService={publishedServices.pageContextService}
        workspaceService={publishedServices.workspaceService}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));

    const snippet = await screen.findByLabelText(/embed script/i);
    const snippetValue = (snippet as HTMLTextAreaElement).value;
    expect(snippetValue).toContain('<script');
    expect(snippetValue).toContain('https://cdn.local/assisted-cms/renderers/assisted-cms-embed.js');
  });
});
