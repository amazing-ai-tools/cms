import { describe, expect, test } from 'vitest';
import { createLocalPageContextService } from '../page/localPageContextService';
import type { SavePageDraftInput } from '../page/types';
import { createLocalGenerationService } from './localGenerationService';

describe('structured generation output', () => {
  test('local generation creates content blocks with layout and visual attributes', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'structured-generation-context',
    });
    await pageContextService.addInput({
      pageId: 'page-1',
      type: 'description',
      content: 'Launch page for a new editorial membership.',
    });
    await pageContextService.addInput({
      pageId: 'page-1',
      type: 'idea',
      content: 'Highlight practical publishing workflows.',
    });
    await pageContextService.addAsset({
      pageId: 'page-1',
      filename: 'hero.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
    });

    const pageContext = await pageContextService.loadPageContext('page-1');
    const generationService = createLocalGenerationService({
      now: () => new Date('2026-07-23T10:00:00.000Z'),
    });

    const result = await generationService.generateDraft({
      hierarchyPath: ['Membership', 'Launch'],
      pageContext,
      pageId: 'page-1',
      pageTitle: 'Launch',
    });

    expect(result.draft).toMatchObject({
      blocks: expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('editorial membership'),
          layout: expect.objectContaining({ column: 1, row: 1, width: 12 }),
          type: 'hero',
          visual: expect.objectContaining({
            backgroundColor: expect.stringMatching(/^#/),
            textColor: expect.stringMatching(/^#/),
          }),
        }),
        expect.objectContaining({
          assetId: 'asset-1',
          type: 'media',
        }),
      ]),
      layout: expect.objectContaining({
        canvas: expect.objectContaining({ maxWidth: 1120 }),
        sections: expect.arrayContaining([
          expect.objectContaining({ blockIds: expect.arrayContaining(['block-hero']) }),
        ]),
      }),
      visual: expect.objectContaining({
        accentColor: expect.stringMatching(/^#/),
        backgroundColor: expect.stringMatching(/^#/),
        textColor: expect.stringMatching(/^#/),
      }),
    });
  });

  test('page context service rejects invalid generated draft shapes before saving', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'structured-generation-invalid-context',
    });
    const invalidDraft = {
      pageId: 'page-1',
      title: 'Invalid generated output',
      blocks: [],
      layout: {
        canvas: { maxWidth: 1120 },
        sections: [],
      },
      visual: {
        accentColor: '#2f7d5f',
        backgroundColor: '#ffffff',
        textColor: '#1b1e24',
        spacing: 'balanced',
      },
    } satisfies SavePageDraftInput;

    await expect(pageContextService.saveDraft(invalidDraft)).rejects.toThrow(
      /at least one content block/i,
    );
  });
});
