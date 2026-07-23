import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalGenerationService } from '../generation/localGenerationService';
import { createLocalPageContextService } from '../page/localPageContextService';
import { createLocalCdnService } from '../publication/localCdnService';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { renderEmbedFromCdn } from './embedScript';

const user: AuthUser = {
  id: 'google-e2e-user',
  email: 'e2e@example.com',
  name: 'E2E User',
  avatarUrl: '',
  provider: 'google',
};

describe('end-to-end publish and embed flow', () => {
  test('generated and edited drafts publish to CDN, render externally, republish active content, and preserve older versions on failure', async () => {
    const storageKey = 'publish-embed-flow-page';
    const cdnService = createLocalCdnService({ storageKey: 'publish-embed-flow-cdn' });
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'publish-embed-flow-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'publish-embed-flow-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'publish-embed-flow-content',
    });
    const pageContextService = createLocalPageContextService({
      cdnService,
      storageKey,
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
    await pageContextService.addInput({
      pageId: page.id,
      type: 'description',
      content: 'Generated membership embed page',
    });
    await pageContextService.addAsset({
      pageId: page.id,
      filename: 'hero.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
    });

    render(
      <App
        authService={authService}
        contentService={contentService}
        generationService={createLocalGenerationService({
          now: () => new Date('2026-07-23T12:00:00.000Z'),
        })}
        pageContextService={pageContextService}
        workspaceService={workspaceService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    await userEvent.click(within(previewPanel).getByRole('button', { name: /generate/i }));
    expect(await within(previewPanel).findByText(/generation succeeded/i)).toBeInTheDocument();

    fireEvent.change(within(previewPanel).getByLabelText(/draft title/i), {
      target: { value: 'Embedded launch final' },
    });
    await userEvent.click(within(previewPanel).getByRole('button', { name: /publish draft/i }));
    expect(await screen.findByText(/versions: 1/i)).toBeInTheDocument();

    const firstActiveVersion = await pageContextService.getActivePublishedVersion(page.id);
    expect(firstActiveVersion?.title).toBe('Embedded launch final');
    expect(firstActiveVersion?.cdnUrls.content).toContain('/versions/1/content.json');
    expect(firstActiveVersion?.cdnUrls.script).toContain('/renderers/assisted-cms-embed.js');
    expect(firstActiveVersion?.cdnUrls.media).toEqual([
      `https://cdn.local/assisted-cms/pages/${page.id}/assets/asset-1/hero.jpg`,
    ]);

    const firstTarget = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService,
      contentUrl: firstActiveVersion!.cdnUrls.content,
      target: firstTarget,
    });
    expect(firstTarget).toHaveTextContent('Embedded launch final');
    expect(firstTarget).toHaveTextContent('Generated membership embed page');

    fireEvent.change(within(previewPanel).getByLabelText(/draft title/i), {
      target: { value: 'Embedded launch republished' },
    });
    await userEvent.click(within(previewPanel).getByRole('button', { name: /publish draft/i }));
    expect(await screen.findByText(/versions: 2/i)).toBeInTheDocument();

    const republishedContext = await pageContextService.loadPageContext(page.id);
    const secondActiveVersion = await pageContextService.getActivePublishedVersion(page.id);
    expect(secondActiveVersion?.title).toBe('Embedded launch republished');
    expect(secondActiveVersion?.versionNumber).toBe(2);
    expect(republishedContext.versions[0].title).toBe('Embedded launch final');

    const secondTarget = document.createElement('div');
    await renderEmbedFromCdn({
      cdnService,
      contentUrl: secondActiveVersion!.cdnUrls.content,
      target: secondTarget,
    });
    expect(secondTarget).toHaveTextContent('Embedded launch republished');

    await pageContextService.saveDraft({
      ...republishedContext.draft!,
      title: 'Failed publish draft',
    });
    const failingService = createLocalPageContextService({
      cdnService: createLocalCdnService({
        failPublish: true,
        storageKey: 'publish-embed-flow-failing-cdn',
      }),
      storageKey,
    });

    await expect(
      failingService.publishDraft({
        createdBy: user.id,
        pageId: page.id,
      }),
    ).rejects.toThrow(/cdn publish failed/i);

    await waitFor(async () => {
      const activeAfterFailure = await pageContextService.getActivePublishedVersion(page.id);
      expect(activeAfterFailure?.id).toBe(secondActiveVersion?.id);
      expect((await pageContextService.loadPageContext(page.id)).versions).toHaveLength(2);
    });
  });
});
