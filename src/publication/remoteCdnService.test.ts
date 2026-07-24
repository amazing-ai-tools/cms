import { describe, expect, test, vi } from 'vitest';
import type { PublishedVersion } from '../page/types';
import { createRemoteCdnService } from './remoteCdnService';

function versionForPublish(): PublishedVersion {
  return {
    id: 'version-1',
    pageId: 'page-1',
    versionNumber: 1,
    title: 'Remote CDN draft',
    contentSnapshot: [
      {
        id: 'block-asset-1',
        type: 'media',
        assetId: 'asset-1',
        content: 'hero.png',
        layout: { column: 1, row: 1, width: 12 },
        visual: {
          backgroundColor: '#f7fbf5',
          textColor: '#17211b',
          accentColor: '#2f7d5f',
          size: 'large',
        },
      },
    ],
    layoutSnapshot: {
      canvas: { maxWidth: 1120 },
      sections: [{ id: 'section-media', blockIds: ['block-asset-1'] }],
    },
    visualSnapshot: {
      accentColor: '#2f7d5f',
      backgroundColor: '#fbfcf8',
      textColor: '#18201c',
      spacing: 'balanced',
    },
    language: 'en',
    localizations: {},
    assetManifest: [
      {
        assetId: 'asset-1',
        cdnUrl: null,
        filename: 'hero.png',
        mimeType: 'image/png',
        sourceContent: 'data:image/png;base64,aGVybw==',
        sourceEncoding: 'data-url',
        storageUrl: 'local://assets/page-1/asset-1/hero.png',
      },
    ],
    manifest: {
      cache: { immutable: true, scope: 'version' },
      content: {
        title: 'Remote CDN draft',
        blocks: [],
        layout: { canvas: { maxWidth: 1120 }, sections: [] },
        mediaAssets: [],
        visual: {
          accentColor: '#2f7d5f',
          backgroundColor: '#fbfcf8',
          textColor: '#18201c',
          spacing: 'balanced',
        },
      },
      mediaAssets: [],
      pageId: 'page-1',
      rendererScriptUrl: '',
      versionId: 'version-1',
      versionNumber: 1,
    },
    cdnUrls: { content: '', media: [], script: '' },
    embedUrl: '',
    createdAt: '2026-07-24T00:00:00.000Z',
    createdBy: 'user-1',
  };
}

describe('remote CDN service', () => {
  test('publishes a version to the configured CDN API endpoint', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            contentUrl: 'https://cms.api.amazing-ai.tools/cdn/pages/page-1/versions/1/content.json',
            mediaUrls: ['https://cms.api.amazing-ai.tools/cdn/pages/page-1/assets/asset-1/hero.png'],
            scriptUrl: 'https://cms.api.amazing-ai.tools/cdn/renderers/assisted-cms-embed.js',
          }),
          { status: 200 },
        ),
    );
    const service = createRemoteCdnService({ baseUrl: 'https://cms.api.amazing-ai.tools', fetcher });
    const version = versionForPublish();

    await expect(service.publishVersion(version)).resolves.toEqual({
      contentUrl: 'https://cms.api.amazing-ai.tools/cdn/pages/page-1/versions/1/content.json',
      mediaUrls: ['https://cms.api.amazing-ai.tools/cdn/pages/page-1/assets/asset-1/hero.png'],
      scriptUrl: 'https://cms.api.amazing-ai.tools/cdn/renderers/assisted-cms-embed.js',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://cms.api.amazing-ai.tools/api/cdn/publish-version',
      expect.objectContaining({
        body: JSON.stringify({ version }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });
});
