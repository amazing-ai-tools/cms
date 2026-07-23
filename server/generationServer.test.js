// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createGenerationServer } from './generationServer.js';
import { createAiGenerationService } from './aiGenerationService.js';
import { createMemoryWorkspaceAiSettingsStore } from './workspaceAiSettingsStore.js';

function requestFor(pageId = 'page-1') {
  return {
    ai: {
      effort: 'high',
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
        model: 'gpt-5.6-terra',
        provider: 'openai',
      }),
    });

    expect(saveResponse.status).toBe(200);
    await expect(saveResponse.json()).resolves.toMatchObject({
      effort: 'high',
      hasApiKey: true,
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
    expect(JSON.parse(init.body)).toMatchObject({
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
    title: 'Reference-led service page',
    visual: {
      accentColor: '#36c2a1',
      backgroundColor: '#f8faf7',
      textColor: '#101820',
      spacing: 'balanced',
    },
  };
}
