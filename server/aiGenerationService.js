import { collectSourceMaterial } from './sourceExtraction.js';
import { buildGenerationPrompt } from './generationPrompt.js';
import { normalizeAndValidateDraftResponse } from './pageDraftSchema.js';
import { normalizeEffort, normalizeProviderId, providerLabel } from './providerCatalog.js';
import { providerAdapterFor } from './providerAdapters.js';

function failedJob(request, error, steps) {
  return {
    draft: undefined,
    job: {
      error,
      id: `job-${request.pageId}-failed`,
      pageId: request.pageId,
      status: 'failed',
      steps,
    },
  };
}

function succeededJob(request, steps) {
  return {
    id: `job-${request.pageId}-${Date.now()}`,
    pageId: request.pageId,
    status: 'succeeded',
    steps,
  };
}

export function createAiGenerationService(options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const settingsStore = options.settingsStore;

  if (!settingsStore) {
    throw new Error('settingsStore is required.');
  }

  return {
    async generateDraft(request) {
      const workspaceId = request.workspaceId;
      const requestedProvider = normalizeProviderId(request.ai?.provider);
      const steps = ['Analyzing source material'];

      if (!workspaceId) {
        return failedJob(request, 'Workspace id is required for AI generation.', steps);
      }

      const storedSettings = await settingsStore.getProviderSettings(workspaceId, requestedProvider);
      const provider = normalizeProviderId(request.ai?.provider ?? storedSettings.provider);
      const model = String(request.ai?.model || storedSettings.model || '').trim();
      const effort = normalizeEffort(provider, model, request.ai?.effort ?? storedSettings.effort);
      const label = providerLabel(provider);

      if (!storedSettings.apiKey) {
        return failedJob(request, `${label} generation is not configured for this workspace.`, steps);
      }

      try {
        const sources = await collectSourceMaterial(request, { fetcher });
        const prompt = buildGenerationPrompt(request, sources);
        const adapter = providerAdapterFor(provider);
        steps.push(`Generating embedded page with ${label}`);
        const generatedDraft = await adapter({
          apiKey: storedSettings.apiKey,
          ...(effort ? { effort } : {}),
          fetcher,
          model,
          prompt,
        });
        steps.push('Validating generated page draft');
        const draft = normalizeAndValidateDraftResponse(generatedDraft, request, now);

        return {
          draft,
          job: succeededJob(request, steps),
        };
      } catch (error) {
        return failedJob(
          request,
          error instanceof Error ? error.message : 'AI generation failed.',
          [...steps, 'Generation failed'],
        );
      }
    },
  };
}
