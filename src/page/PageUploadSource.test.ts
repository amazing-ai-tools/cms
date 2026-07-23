import { describe, expect, test } from 'vitest';
import { createLocalPageContextService } from './localPageContextService';
import { readUploadSourceForFile } from './uploadSource';

describe('upload source preservation', () => {
  test('keeps plain text file content for AI analysis', async () => {
    const file = new File(['A short content brief for the generated page.'], 'brief.txt', {
      type: 'text/plain',
    });

    await expect(readUploadSourceForFile(file)).resolves.toEqual({
      sourceContent: 'A short content brief for the generated page.',
      sourceEncoding: 'text',
    });
  });

  test('keeps PDF bytes as a data URL for server-side extraction', async () => {
    const file = new File(['%PDF-1.4\npage brief'], 'offer.pdf', {
      type: 'application/pdf',
    });

    const source = await readUploadSourceForFile(file);

    expect(source.sourceEncoding).toBe('data-url');
    expect(source.sourceContent).toMatch(/^data:application\/pdf;base64,/);
  });

  test('stores upload source metadata with page assets', async () => {
    const pageContextService = createLocalPageContextService({
      storageKey: 'upload-source-context',
    });

    await pageContextService.addAsset({
      filename: 'brief.txt',
      mimeType: 'text/plain',
      pageId: 'page-1',
      size: 42,
      sourceContent: 'Captured source text',
      sourceEncoding: 'text',
    });

    await expect(pageContextService.loadPageContext('page-1')).resolves.toMatchObject({
      assets: [
        expect.objectContaining({
          filename: 'brief.txt',
          sourceContent: 'Captured source text',
          sourceEncoding: 'text',
        }),
      ],
    });
  });
});
