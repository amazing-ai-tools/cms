import { describe, expect, test } from 'vitest';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { PageDraft } from '../page/types';

function draftFor(pageId: string): PageDraft {
  return {
    id: `draft-${pageId}`,
    pageId,
    title: 'Manifest draft',
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'Manifest-ready hero copy',
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

describe('publishable asset manifest', () => {
  test('publish creates a manifest with content, renderer script, and media asset references', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'publishable-manifest',
    });
    await pageContextService.addAsset({
      pageId: 'page-1',
      filename: 'hero.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
    });
    await pageContextService.saveDraft(draftFor('page-1'));

    const version = await pageContextService.publishDraft({
      createdBy: 'user-1',
      pageId: 'page-1',
    });

    expect(version.manifest).toMatchObject({
      cache: expect.objectContaining({
        immutable: true,
        scope: 'version',
      }),
      content: expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            content: 'Manifest-ready hero copy',
            id: 'block-hero',
          }),
        ]),
        layout: expect.objectContaining({
          canvas: expect.objectContaining({ maxWidth: 1120 }),
        }),
        title: 'Manifest draft',
        visual: expect.objectContaining({ accentColor: '#2f7d5f' }),
      }),
      mediaAssets: [
        expect.objectContaining({
          assetId: 'asset-1',
          filename: 'hero.jpg',
          storageUrl: expect.stringContaining('local://assets/page-1/asset-1/hero.jpg'),
        }),
      ],
      pageId: 'page-1',
      rendererScriptUrl: 'https://cdn.local/assisted-cms/renderers/assisted-cms-embed.js',
      versionId: version.id,
      versionNumber: 1,
    });
    expect(JSON.stringify(version.manifest)).not.toContain('isDirty');
  });
});
