import { describe, expect, test } from 'vitest';
import { createLocalPageContextService } from './localPageContextService';
import type { PageDraft } from './types';

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
        content: `${title} copy`,
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

describe('active functional publication version', () => {
  test('first publish marks the created version active and exposes it as embed metadata', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'active-publication-first',
    });
    await pageContextService.saveDraft(draftFor('page-1', 'First published draft'));

    const version = await pageContextService.publishDraft({
      createdBy: 'user-1',
      pageId: 'page-1',
    });
    const context = await pageContextService.loadPageContext('page-1');

    expect(context.activePublication).toMatchObject({
      activeVersionId: version.id,
      pageId: 'page-1',
      status: 'published',
    });
    await expect(pageContextService.getActivePublishedVersion('page-1')).resolves.toMatchObject({
      id: version.id,
      title: 'First published draft',
    });
  });

  test('republish creates a new active version without mutating the previous version', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'active-publication-republish',
    });
    await pageContextService.saveDraft(draftFor('page-1', 'First published draft'));
    const firstVersion = await pageContextService.publishDraft({
      createdBy: 'user-1',
      pageId: 'page-1',
    });
    await pageContextService.saveDraft(draftFor('page-1', 'Second published draft'));

    const secondVersion = await pageContextService.publishDraft({
      createdBy: 'user-1',
      pageId: 'page-1',
    });
    const context = await pageContextService.loadPageContext('page-1');

    expect(secondVersion.versionNumber).toBe(2);
    expect(context.activePublication?.activeVersionId).toBe(secondVersion.id);
    expect(context.versions.map((version) => version.title)).toEqual([
      'First published draft',
      'Second published draft',
    ]);
    expect(context.versions[0].id).toBe(firstVersion.id);
    await expect(pageContextService.getActivePublishedVersion('page-1')).resolves.toMatchObject({
      id: secondVersion.id,
      title: 'Second published draft',
    });
  });

  test('failed publish leaves the previous active version active', async () => {
    const storageKey = 'active-publication-failure';
    const pageContextService = createLocalPageContextService({ storageKey });
    await pageContextService.saveDraft(draftFor('page-1', 'Stable published draft'));
    const activeVersion = await pageContextService.publishDraft({
      createdBy: 'user-1',
      pageId: 'page-1',
    });
    await pageContextService.saveDraft(draftFor('page-1', 'Draft that fails publishing'));

    const failingService = createLocalPageContextService({
      failPublish: true,
      storageKey,
    });

    await expect(
      failingService.publishDraft({
        createdBy: 'user-1',
        pageId: 'page-1',
      }),
    ).rejects.toThrow(/publish failed/i);

    const context = await pageContextService.loadPageContext('page-1');
    expect(context.activePublication?.activeVersionId).toBe(activeVersion.id);
    expect(context.versions).toHaveLength(1);
    await expect(pageContextService.getActivePublishedVersion('page-1')).resolves.toMatchObject({
      id: activeVersion.id,
      title: 'Stable published draft',
    });
  });
});
