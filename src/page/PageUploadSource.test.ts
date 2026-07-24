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

  test('keeps image, audio, video, and binary document bytes as data URLs for CDN publication', async () => {
    for (const file of [
      new File(['image'], 'hero.png', { type: 'image/png' }),
      new File(['audio'], 'intro.mp3', { type: 'audio/mpeg' }),
      new File(['video'], 'tour.mp4', { type: 'video/mp4' }),
      new File(['word'], 'offer.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ]) {
      const source = await readUploadSourceForFile(file);

      expect(source.sourceEncoding).toBe('data-url');
      expect(source.sourceContent).toMatch(/^data:/);
    }
  });

  test('keeps publishable media bytes even when the file is larger than the analysis limit', async () => {
    const file = new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'large-hero.png', {
      type: 'image/png',
    });

    const source = await readUploadSourceForFile(file);

    expect(source.sourceEncoding).toBe('data-url');
    expect(source.sourceContent).toMatch(/^data:image\/png;base64,/);
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

  test('keeps large upload bytes outside localStorage while hydrating assets for preview', async () => {
    const storageKey = 'upload-source-quota-context';
    const pageContextService = createLocalPageContextService({ storageKey });
    const sourceContent = `data:image/png;base64,${'a'.repeat(10_000)}`;

    await pageContextService.addAsset({
      filename: 'hero.png',
      mimeType: 'image/png',
      pageId: 'page-1',
      size: 7_500,
      sourceContent,
      sourceEncoding: 'data-url',
      sourceIntent: 'required',
    });

    const rawStorage = window.localStorage.getItem(storageKey) ?? '';
    expect(rawStorage).not.toContain(sourceContent);
    const reloadedPageContextService = createLocalPageContextService({ storageKey });
    await expect(reloadedPageContextService.loadPageContext('page-1')).resolves.toMatchObject({
      assets: [
        expect.objectContaining({
          filename: 'hero.png',
          sourceContent,
          sourceEncoding: 'data-url',
        }),
      ],
    });
  });
});
