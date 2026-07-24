// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createFileCdnPublishingService } from './cdnPublishingService.js';
import { createGenerationServer } from './generationServer.js';

const tempDirs = [];

function versionForPublish() {
  return {
    id: 'version-1',
    pageId: 'page-1',
    versionNumber: 1,
    title: 'Published CDN page',
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
    localizations: {
      fr: {
        title: 'Page CDN publiee',
        blocks: [
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
      },
    },
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
    cdnUrls: { content: '', media: [], script: '' },
    embedUrl: '',
    createdAt: '2026-07-24T00:00:00.000Z',
    createdBy: 'user-1',
  };
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

describe('file CDN publishing service', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test('writes content manifest, renderer script, and uploaded media bytes to CDN storage', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'cms-cdn-'));
    tempDirs.push(rootDir);
    const service = createFileCdnPublishingService({
      baseUrl: 'https://cms.api.amazing-ai.tools/cdn',
      rootDir,
    });

    const result = await service.publishVersion(versionForPublish());

    expect(result).toEqual({
      contentUrl: 'https://cms.api.amazing-ai.tools/cdn/pages/page-1/versions/1/content.json',
      mediaUrls: ['https://cms.api.amazing-ai.tools/cdn/pages/page-1/assets/asset-1/hero.png'],
      scriptUrl: 'https://cms.api.amazing-ai.tools/cdn/renderers/assisted-cms-embed.js',
    });
    await expect(
      readFile(join(rootDir, 'pages/page-1/versions/1/content.json'), 'utf8'),
    ).resolves.toContain('"localizations"');
    await expect(
      readFile(join(rootDir, 'pages/page-1/assets/asset-1/hero.png'), 'utf8'),
    ).resolves.toBe('hero');
    await expect(
      readFile(join(rootDir, 'renderers/assisted-cms-embed.js'), 'utf8'),
    ).resolves.toContain('AssistedCmsEmbed');
  });
});

describe('CDN API route', () => {
  const servers = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
    await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  test('publishes versions through POST /api/cdn/publish-version', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'cms-cdn-route-'));
    tempDirs.push(rootDir);
    const server = createGenerationServer({
      cdnPublishingService: createFileCdnPublishingService({
        baseUrl: 'https://cms.api.amazing-ai.tools/cdn',
        rootDir,
      }),
      generationService: {
        generateDraft: async () => ({ job: { id: 'job-1', pageId: 'page-1', status: 'failed', steps: [] } }),
      },
    });
    servers.push(server);
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/api/cdn/publish-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: versionForPublish() }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contentUrl: 'https://cms.api.amazing-ai.tools/cdn/pages/page-1/versions/1/content.json',
      mediaUrls: ['https://cms.api.amazing-ai.tools/cdn/pages/page-1/assets/asset-1/hero.png'],
    });
  });
});
