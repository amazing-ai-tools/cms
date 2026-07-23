import { describe, expect, test, vi } from 'vitest';
import type { PageContext, PageDraft } from '../page/types';
import type { GenerationRequest, GenerationResult } from './types';
import { createRemoteGenerationService } from './remoteGenerationService';

function emptyPageContext(pageId: string): PageContext {
  return {
    pageId,
    assets: [],
    draft: null,
    inputs: [],
    versions: [],
    activePublication: null,
  };
}

function draftFor(pageId: string): PageDraft {
  return {
    id: 'draft-page-1',
    pageId,
    title: 'Modern embedded service page',
    isDirty: true,
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'A sharper offer page for agency buyers.',
        layout: { column: 1, row: 1, width: 12 },
        visual: {
          backgroundColor: '#101820',
          textColor: '#f7fbff',
          accentColor: '#36c2a1',
          size: 'large',
        },
      },
    ],
    layout: {
      canvas: { maxWidth: 1120 },
      sections: [{ id: 'section-hero', blockIds: ['block-hero'] }],
    },
    visual: {
      accentColor: '#36c2a1',
      backgroundColor: '#f8faf7',
      textColor: '#101820',
      spacing: 'balanced',
    },
    createdAt: '2026-07-23T10:00:00.000Z',
    updatedAt: '2026-07-23T10:00:00.000Z',
  };
}

function requestFor(pageId: string): GenerationRequest {
  return {
    hierarchyPath: ['Services', 'Launch'],
    pageContext: emptyPageContext(pageId),
    pageId,
    pageTitle: 'Launch',
  };
}

describe('remote generation service', () => {
  test('posts the generation request to the configured API endpoint', async () => {
    const request = requestFor('page-1');
    const responseBody: GenerationResult = {
      draft: draftFor('page-1'),
      job: {
        id: 'job-1',
        pageId: 'page-1',
        status: 'succeeded',
        steps: ['Analyzing source material', 'Generating embedded page draft'],
      },
    };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(responseBody), { status: 200 }));
    const service = createRemoteGenerationService({
      endpoint: '/api/generation/draft',
      fetcher,
    });

    await expect(service.generateDraft(request)).resolves.toEqual(responseBody);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/generation/draft',
      expect.objectContaining({
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    );
  });

  test('throws the server generation error when the API rejects the request', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            job: {
              error: 'xAI generation is not configured on this server.',
              id: 'job-page-1-failed',
              pageId: 'page-1',
              status: 'failed',
              steps: ['Checking xAI configuration'],
            },
          }),
          { status: 503 },
        ),
    );
    const service = createRemoteGenerationService({
      endpoint: '/api/generation/draft',
      fetcher,
    });

    await expect(service.generateDraft(requestFor('page-1'))).rejects.toThrow(
      'xAI generation is not configured on this server.',
    );
  });
});
