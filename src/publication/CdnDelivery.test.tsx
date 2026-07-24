import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { App } from '../App';
import { createLocalAuthService } from '../auth/localAuthService';
import type { AuthUser } from '../auth/types';
import { createLocalContentService } from '../content/localContentService';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { PageDraft } from '../page/types';
import { createLocalWorkspaceService } from '../workspace/localWorkspaceService';
import { createLocalCdnService } from './localCdnService';

const user: AuthUser = {
  id: 'google-cdn-user',
  email: 'cdn@example.com',
  name: 'CDN User',
  avatarUrl: '',
  provider: 'google',
};

function draftFor(pageId: string): PageDraft {
  return {
    id: `draft-${pageId}`,
    pageId,
    title: 'CDN ready draft',
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'CDN-ready page content',
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
      {
        id: 'block-asset-1',
        type: 'media',
        assetId: 'asset-1',
        content: 'hero.jpg',
        layout: {
          column: 1,
          row: 2,
          width: 6,
        },
        visual: {
          backgroundColor: '#eef3f1',
          textColor: '#27302b',
          accentColor: '#2f7d5f',
          size: 'standard',
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
          blockIds: ['block-hero', 'block-asset-1'],
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

describe('CDN delivery integration', () => {
  test('publish stores verified CDN URLs for content, renderer JavaScript, and media assets', async () => {
    const cdnService = createLocalCdnService({ storageKey: 'cdn-delivery-service' });
    const pageContextService = createLocalPageContextService({
      cdnService,
      storageKey: 'cdn-delivery-page',
    });
    await pageContextService.addAsset({
      pageId: 'page-1',
      filename: 'hero.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    const version = await pageContextService.publishDraft({
      createdBy: user.id,
      pageId: 'page-1',
    });

    expect(version.cdnUrls.content).toBe(
      'https://cdn.local/assisted-cms/pages/page-1/versions/1/content.json',
    );
    expect(version.cdnUrls.script).toBe(
      'https://cdn.local/assisted-cms/renderers/assisted-cms-embed.js',
    );
    expect(version.cdnUrls.media).toEqual([
      'https://cdn.local/assisted-cms/pages/page-1/assets/asset-1/hero.jpg',
    ]);
    expect(version.manifest.rendererScriptUrl).toBe(version.cdnUrls.script);
    expect(version.manifest.mediaAssets[0].cdnUrl).toBe(version.cdnUrls.media[0]);
    await expect(cdnService.verifyUrl(version.cdnUrls.content)).resolves.toBe(true);
    await expect(cdnService.verifyUrl(version.cdnUrls.script)).resolves.toBe(true);
    await expect(cdnService.verifyUrl(version.cdnUrls.media[0])).resolves.toBe(true);
    await expect(cdnService.readJson(version.cdnUrls.content)).resolves.toMatchObject({
      title: 'CDN ready draft',
    });
  });

  test('published embed content renders image, audio, video, and download assets from CDN URLs', async () => {
    const cdnService = createLocalCdnService({ storageKey: 'cdn-delivery-rich-media' });
    const pageContextService = createLocalPageContextService({
      cdnService,
      storageKey: 'cdn-delivery-rich-media-page',
    });
    const assets = [
      { filename: 'hero.png', mimeType: 'image/png', sourceContent: 'data:image/png;base64,aGVybw==' },
      { filename: 'intro.mp3', mimeType: 'audio/mpeg', sourceContent: 'data:audio/mpeg;base64,YXVkaW8=' },
      { filename: 'tour.mp4', mimeType: 'video/mp4', sourceContent: 'data:video/mp4;base64,dmlkZW8=' },
      { filename: 'terms.pdf', mimeType: 'application/pdf', sourceContent: 'data:application/pdf;base64,cGRm' },
    ];

    for (const asset of assets) {
      await pageContextService.addAsset({
        pageId: 'page-rich-media',
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.sourceContent.length,
        sourceContent: asset.sourceContent,
        sourceEncoding: 'data-url',
        sourceIntent: 'required',
      });
    }

    await pageContextService.saveDraft({
      ...draftFor('page-rich-media'),
      blocks: [
        {
          id: 'block-asset-1',
          type: 'media',
          assetId: 'asset-1',
          content: 'hero.png',
          layout: { column: 1, row: 1, width: 6 },
          visual: {
            backgroundColor: '#eef3f1',
            textColor: '#27302b',
            accentColor: '#2f7d5f',
            size: 'standard',
          },
        },
        {
          id: 'block-asset-2',
          type: 'media',
          assetId: 'asset-2',
          content: 'intro.mp3',
          layout: { column: 7, row: 1, width: 6 },
          visual: {
            backgroundColor: '#eef3f1',
            textColor: '#27302b',
            accentColor: '#2f7d5f',
            size: 'standard',
          },
        },
        {
          id: 'block-asset-3',
          type: 'media',
          assetId: 'asset-3',
          content: 'tour.mp4',
          layout: { column: 1, row: 2, width: 6 },
          visual: {
            backgroundColor: '#eef3f1',
            textColor: '#27302b',
            accentColor: '#2f7d5f',
            size: 'standard',
          },
        },
        {
          id: 'block-asset-4',
          type: 'media',
          assetId: 'asset-4',
          content: 'terms.pdf',
          layout: { column: 7, row: 2, width: 6 },
          visual: {
            backgroundColor: '#eef3f1',
            textColor: '#27302b',
            accentColor: '#2f7d5f',
            size: 'standard',
          },
        },
      ],
      layout: {
        canvas: { maxWidth: 1120 },
        sections: [
          {
            id: 'section-assets',
            blockIds: ['block-asset-1', 'block-asset-2', 'block-asset-3', 'block-asset-4'],
          },
        ],
      },
    });

    const version = await pageContextService.publishDraft({
      createdBy: user.id,
      pageId: 'page-rich-media',
    });
    const content = await cdnService.readJson(version.cdnUrls.content);

    expect(version.cdnUrls.media).toEqual([
      'https://cdn.local/assisted-cms/pages/page-rich-media/assets/asset-1/hero.png',
      'https://cdn.local/assisted-cms/pages/page-rich-media/assets/asset-2/intro.mp3',
      'https://cdn.local/assisted-cms/pages/page-rich-media/assets/asset-3/tour.mp4',
      'https://cdn.local/assisted-cms/pages/page-rich-media/assets/asset-4/terms.pdf',
    ]);
    expect(content).toMatchObject({
      mediaAssets: version.assetManifest.map((asset) =>
        expect.objectContaining({
          assetId: asset.assetId,
          cdnUrl: asset.cdnUrl,
          filename: asset.filename,
        }),
      ),
    });
  });

  test('CMS shows publication failure from the CDN adapter and preserves the draft', async () => {
    const cdnService = createLocalCdnService({
      failPublish: true,
      storageKey: 'cdn-delivery-failure-cdn',
    });
    const authService = createLocalAuthService({
      initialUser: user,
      storageKey: 'cdn-delivery-failure-auth',
    });
    const workspaceService = createLocalWorkspaceService({
      storageKey: 'cdn-delivery-failure-workspace',
    });
    const contentService = createLocalContentService({
      storageKey: 'cdn-delivery-failure-content',
    });
    const pageContextService = createLocalPageContextService({
      cdnService,
      storageKey: 'cdn-delivery-failure-page',
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
    await pageContextService.saveDraft(draftFor(page.id));

    render(
      <App
        authService={authService}
        contentService={contentService}
        pageContextService={pageContextService}
        workspaceService={workspaceService}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: /page 1 page/i }));
    const previewPanel = screen.getByRole('region', { name: /page preview/i });
    await userEvent.click(within(previewPanel).getByRole('button', { name: /publish draft/i }));

    expect(await within(previewPanel).findByRole('alert')).toHaveTextContent(/cdn publish failed/i);
    const context = await pageContextService.loadPageContext(page.id);
    expect(context.draft?.title).toBe('CDN ready draft');
    expect(context.versions).toHaveLength(0);
    expect(context.activePublication).toBeNull();
  });
});
