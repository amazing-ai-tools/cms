// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createGenerationServer } from './generationServer.js';
import { createAiGenerationService } from './aiGenerationService.js';
import { createMemoryWorkspaceAiSettingsStore } from './workspaceAiSettingsStore.js';

function requestFor(pageId = 'page-1') {
  return {
    ai: {
      effort: 'high',
      languages: ['en', 'fr'],
      model: 'gpt-5.6-terra',
      provider: 'openai',
    },
    hierarchyPath: ['Services', 'Launch'],
    pageContext: {
      activePublication: null,
      assets: [],
      draft: null,
      inputs: [
        {
          id: 'input-1',
          pageId,
          type: 'description',
          content: 'Create a refined embedded page for a content strategy service.',
          sourceIntent: 'context',
          createdAt: '2026-07-23T10:00:00.000Z',
        },
      ],
      pageId,
      versions: [],
    },
    pageId,
    pageTitle: 'Launch',
    workspaceId: 'workspace-1',
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

describe('generation API server', () => {
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
  });

  test('responds to health checks', async () => {
    const server = createGenerationServer({
      generationService: {
        generateDraft: vi.fn(),
      },
    });
    servers.push(server);
    const baseUrl = await listen(server);

    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  test('stores workspace AI settings without returning provider keys', async () => {
    const settingsStore = createMemoryWorkspaceAiSettingsStore();
    const server = createGenerationServer({
      generationService: {
        generateDraft: vi.fn(),
      },
      settingsStore,
    });
    servers.push(server);
    const baseUrl = await listen(server);

    const saveResponse = await fetch(`${baseUrl}/api/workspaces/workspace-1/ai-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'sk-workspace-openai',
        effort: 'high',
        languages: ['en', 'fr'],
        model: 'gpt-5.6-terra',
        provider: 'openai',
      }),
    });

    expect(saveResponse.status).toBe(200);
    await expect(saveResponse.json()).resolves.toMatchObject({
      effort: 'high',
      hasApiKey: true,
      languages: ['en', 'fr'],
      model: 'gpt-5.6-terra',
      provider: 'openai',
      workspaceId: 'workspace-1',
    });
    expect(JSON.stringify(await settingsStore.getPublicSettings('workspace-1'))).not.toContain(
      'sk-workspace-openai',
    );

    const getResponse = await fetch(`${baseUrl}/api/workspaces/workspace-1/ai-settings`);
    await expect(getResponse.json()).resolves.toMatchObject({
      hasApiKey: true,
      languages: ['en', 'fr'],
      provider: 'openai',
    });
  });
});

describe('AI generation service', () => {
  test('returns a failed job when the selected provider key is missing for the workspace', async () => {
    const service = createAiGenerationService({
      settingsStore: createMemoryWorkspaceAiSettingsStore(),
      now: () => new Date('2026-07-23T10:00:00.000Z'),
    });

    await expect(service.generateDraft(requestFor())).resolves.toMatchObject({
      draft: undefined,
      job: {
        error: 'OpenAI generation is not configured for this workspace.',
        pageId: 'page-1',
        status: 'failed',
      },
    });
  });

  test('uses OpenAI Responses API with reasoning effort and normalizes structured output', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify(pageDraftResponse()),
          }),
          { status: 200 },
        ),
    );
    const settingsStore = createMemoryWorkspaceAiSettingsStore();
    await settingsStore.saveSettings('workspace-1', {
      apiKey: 'test-openai-key',
      effort: 'high',
      model: 'gpt-5.6-terra',
      provider: 'openai',
    });
    const service = createAiGenerationService({
      fetcher,
      now: () => new Date('2026-07-23T10:00:00.000Z'),
      settingsStore,
    });

    const result = await service.generateDraft(requestFor());

    expect(result).toMatchObject({
      draft: {
        id: 'draft-page-1',
        isDirty: true,
        pageId: 'page-1',
        seo: {
          description: 'Search-friendly service page generated from client source material.',
          keywords: ['service page', 'embedded CMS'],
          title: 'Reference-led service page | Services',
        },
        title: 'Reference-led service page',
        blocks: [
          expect.objectContaining({ id: 'block-hero', type: 'hero' }),
          expect.objectContaining({ id: 'block-proof', type: 'text' }),
        ],
      },
      job: {
        pageId: 'page-1',
        status: 'succeeded',
        steps: expect.arrayContaining([
          'Analyzing source material',
          'Generating embedded page with OpenAI',
          'Validating generated page draft',
        ]),
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gpt-5.6-terra',
      reasoning: {
        effort: 'high',
      },
      text: {
        format: expect.objectContaining({
          name: 'embedded_page_draft',
          type: 'json_schema',
        }),
      },
    });
    expect(JSON.stringify(body)).toContain('Target languages: en, fr');
    expect(JSON.stringify(body)).toContain('SEO metadata');
  });

  test('requires selected languages and required assets in the generated draft', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              ...pageDraftResponse(),
              language: 'en',
              localizations: {
                fr: {
                  title: 'Page de service pilote',
                  blocks: [
                    {
                      id: 'block-hero',
                      type: 'hero',
                      content: 'Une page integree moderne fondee sur le brief client.',
                      layout: { column: 1, row: 1, width: 12 },
                      visual: {
                        backgroundColor: '#101820',
                        textColor: '#f7fbff',
                        accentColor: '#36c2a1',
                        size: 'large',
                      },
                    },
                    {
                      id: 'block-proof',
                      type: 'text',
                      content: 'Le contenu source devient une narration commerciale precise.',
                      layout: { column: 1, row: 2, width: 7 },
                      visual: {
                        backgroundColor: '#ffffff',
                        textColor: '#17211b',
                        accentColor: '#c96f3d',
                        size: 'standard',
                      },
                    },
                  ],
                },
              },
            }),
          }),
          { status: 200 },
        ),
    );
    const settingsStore = createMemoryWorkspaceAiSettingsStore();
    await settingsStore.saveSettings('workspace-1', {
      apiKey: 'test-openai-key',
      effort: 'high',
      languages: ['en', 'fr'],
      model: 'gpt-5.6-terra',
      provider: 'openai',
    });
    const service = createAiGenerationService({
      fetcher,
      now: () => new Date('2026-07-23T10:00:00.000Z'),
      settingsStore,
    });

    const result = await service.generateDraft({
      ...requestFor('page-required'),
      pageContext: {
        ...requestFor('page-required').pageContext,
        assets: [
          {
            id: 'asset-logo',
            pageId: 'page-required',
            filename: 'client-logo.png',
            family: 'image',
            mimeType: 'image/png',
            size: 128,
            sourceIntent: 'required',
            storageUrl: 'local://assets/page-required/asset-logo/client-logo.png',
            cdnUrl: null,
            uploadState: 'uploaded',
            createdAt: '2026-07-23T10:00:00.000Z',
          },
        ],
        inputs: [
          {
            id: 'input-required',
            pageId: 'page-required',
            type: 'instruction',
            content: 'Use this exact guarantee: setup in 48 hours.',
            sourceIntent: 'required',
            createdAt: '2026-07-23T10:00:00.000Z',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      draft: {
        language: 'en',
        localizations: {
          fr: expect.objectContaining({
            title: 'Page de service pilote',
          }),
        },
      },
      job: {
        status: 'succeeded',
      },
    });
    expect(result.draft.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'asset-logo',
          type: 'media',
        }),
        expect.objectContaining({
          content: expect.stringContaining('setup in 48 hours'),
          type: 'text',
        }),
      ]),
    );
    expect(result.draft.localizations.fr.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('setup in 48 hours'),
          type: 'text',
        }),
      ]),
    );
    const providerRequestBody = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(providerRequestBody.input[1].content).toContain('sourceIntent="required"');
    expect(providerRequestBody.input[1].content).toContain('assetId="asset-logo"');
  });

  test('passes child content hierarchy to the provider and guarantees child links in the draft', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify(pageDraftResponse()),
          }),
          { status: 200 },
        ),
    );
    const settingsStore = createMemoryWorkspaceAiSettingsStore();
    await settingsStore.saveSettings('workspace-1', {
      apiKey: 'test-openai-key',
      effort: 'high',
      languages: ['en', 'fr'],
      model: 'gpt-5.6-terra',
      provider: 'openai',
    });
    const service = createAiGenerationService({
      fetcher,
      now: () => new Date('2026-07-23T10:00:00.000Z'),
      settingsStore,
    });

    const result = await service.generateDraft({
      ...requestFor('page-parent'),
      childContent: [
        {
          href: '/services/launch/project-alpha',
          id: 'node-project-alpha',
          slug: 'project-alpha',
          title: 'Project Alpha',
          type: 'page',
        },
        {
          href: '/services/launch/project-beta',
          id: 'node-project-beta',
          slug: 'project-beta',
          title: 'Project Beta',
          type: 'page',
        },
      ],
      pageTitle: 'Launch projects',
    });

    const providerRequestBody = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(providerRequestBody.input[1].content).toContain('Child content that must be linked');
    expect(providerRequestBody.input[1].content).toContain('href="/services/launch/project-alpha"');
    expect(providerRequestBody.input[1].content).toContain('Project Beta');
    expect(result).toMatchObject({
      draft: {
        blocks: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Project Alpha'),
            href: '/services/launch/project-alpha',
            type: 'text',
          }),
          expect.objectContaining({
            content: expect.stringContaining('Project Beta'),
            href: '/services/launch/project-beta',
            type: 'text',
          }),
        ]),
        localizations: {
          fr: expect.objectContaining({
            blocks: expect.arrayContaining([
              expect.objectContaining({
                href: '/services/launch/project-alpha',
              }),
            ]),
          }),
        },
      },
      job: {
        status: 'succeeded',
      },
    });
  });

  test.each([
    {
      expectedBody: {
        model: 'grok-4.5',
        response_format: {
          type: 'json_schema',
        },
      },
      expectedUrl: 'https://api.x.ai/v1/chat/completions',
      model: 'grok-4.5',
      provider: 'xai',
      responseBody: {
        choices: [{ message: { content: JSON.stringify(pageDraftResponse()) } }],
      },
    },
    {
      expectedBody: {
        model: 'claude-opus-4-6',
        output_config: {
          effort: 'medium',
          format: {
            type: 'json_schema',
          },
        },
      },
      expectedUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-opus-4-6',
      provider: 'anthropic',
      responseBody: {
        content: [{ type: 'text', text: JSON.stringify(pageDraftResponse()) }],
      },
    },
  ])('sends structured generation requests through $provider', async (caseConfig) => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(caseConfig.responseBody), { status: 200 }),
    );
    const settingsStore = createMemoryWorkspaceAiSettingsStore();
    await settingsStore.saveSettings('workspace-1', {
      apiKey: `test-${caseConfig.provider}-key`,
      effort: 'medium',
      model: caseConfig.model,
      provider: caseConfig.provider,
    });
    const service = createAiGenerationService({
      fetcher,
      now: () => new Date('2026-07-23T10:00:00.000Z'),
      settingsStore,
    });

    await expect(
      service.generateDraft({
        ...requestFor(),
        ai: {
          effort: 'medium',
          model: caseConfig.model,
          provider: caseConfig.provider,
        },
      }),
    ).resolves.toMatchObject({
      draft: {
        title: 'Reference-led service page',
      },
      job: {
        status: 'succeeded',
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      caseConfig.expectedUrl,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject(caseConfig.expectedBody);
  });
});

function pageDraftResponse() {
  return {
    blocks: [
      {
        id: 'block-hero',
        type: 'hero',
        content: 'A modern embedded page shaped around the client reference brief.',
        layout: { column: 1, row: 1, width: 12 },
        visual: {
          backgroundColor: '#101820',
          textColor: '#f7fbff',
          accentColor: '#36c2a1',
          size: 'large',
        },
      },
      {
        id: 'block-proof',
        type: 'text',
        content: 'The page translates the source material into a focused buying narrative.',
        layout: { column: 1, row: 2, width: 7 },
        visual: {
          backgroundColor: '#ffffff',
          textColor: '#17211b',
          accentColor: '#c96f3d',
          size: 'standard',
        },
      },
    ],
    language: 'en',
    seo: {
      title: 'Reference-led service page | Services',
      description: 'Search-friendly service page generated from client source material.',
      keywords: ['service page', 'embedded CMS'],
    },
    layout: {
      canvas: { maxWidth: 1120 },
      sections: [
        {
          id: 'section-generated',
          title: 'Reference-led page',
          blockIds: ['block-hero', 'block-proof'],
        },
      ],
    },
    localizations: {
      fr: {
        title: 'Page de service pilote',
        seo: {
          title: 'Page de service pilote | Services',
          description: 'Page de service optimisee pour la recherche.',
          keywords: ['page de service', 'CMS integre'],
        },
        blocks: [
          {
            id: 'block-hero',
            type: 'hero',
            content: 'Une page integree moderne fondee sur le brief client.',
            layout: { column: 1, row: 1, width: 12 },
            visual: {
              backgroundColor: '#101820',
              textColor: '#f7fbff',
              accentColor: '#36c2a1',
              size: 'large',
            },
          },
          {
            id: 'block-proof',
            type: 'text',
            content: 'Le contenu source devient une narration commerciale precise.',
            layout: { column: 1, row: 2, width: 7 },
            visual: {
              backgroundColor: '#ffffff',
              textColor: '#17211b',
              accentColor: '#c96f3d',
              size: 'standard',
            },
          },
        ],
      },
    },
    title: 'Reference-led service page',
    visual: {
      accentColor: '#36c2a1',
      backgroundColor: '#f8faf7',
      textColor: '#101820',
      spacing: 'balanced',
    },
  };
}
