import { describe, expect, test, vi } from 'vitest';
import { createRemoteWorkspaceAiSettingsService } from './remoteWorkspaceAiSettingsService';

describe('remote workspace AI settings service', () => {
  test('loads settings from the workspace-scoped API endpoint', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            availableProviders: [],
            effort: 'high',
            hasApiKey: true,
            languages: ['en', 'fr'],
            model: 'gpt-5.6-terra',
            provider: 'openai',
            workspaceId: 'workspace-1',
          }),
          { status: 200 },
        ),
    );
    const service = createRemoteWorkspaceAiSettingsService({ fetcher });

    await expect(service.loadSettings('workspace-1')).resolves.toMatchObject({
      hasApiKey: true,
      languages: ['en', 'fr'],
      model: 'gpt-5.6-terra',
      provider: 'openai',
    });
    expect(fetcher).toHaveBeenCalledWith('/api/workspaces/workspace-1/ai-settings');
  });

  test('saves provider settings and workspace API key to the server', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            availableProviders: [],
            effort: 'medium',
            hasApiKey: true,
            model: 'claude-opus-4-6',
            provider: 'anthropic',
            workspaceId: 'workspace-1',
          }),
          { status: 200 },
        ),
    );
    const service = createRemoteWorkspaceAiSettingsService({ fetcher });

    await service.saveSettings('workspace-1', {
      apiKey: 'sk-ant-test',
      effort: 'medium',
      languages: ['en', 'fr'],
      model: 'claude-opus-4-6',
      provider: 'anthropic',
    });

    expect(fetcher).toHaveBeenCalledWith(
      '/api/workspaces/workspace-1/ai-settings',
      expect.objectContaining({
        body: JSON.stringify({
          apiKey: 'sk-ant-test',
          effort: 'medium',
          languages: ['en', 'fr'],
          model: 'claude-opus-4-6',
          provider: 'anthropic',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      }),
    );
  });
});
