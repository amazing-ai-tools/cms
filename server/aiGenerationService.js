import { collectSourceMaterial } from './sourceExtraction.js';
import { buildGenerationPrompt } from './generationPrompt.js';
import { normalizeAndValidateDraftResponse } from './pageDraftSchema.js';
import { normalizeEffort, normalizeLanguages, normalizeProviderId, providerLabel } from './providerCatalog.js';
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

function requiredAssetsFrom(request) {
  return (request.pageContext?.assets ?? []).filter((asset) => asset.sourceIntent === 'required');
}

function maxRowFor(draft) {
  return Math.max(
    1,
    ...draft.blocks.map((block) => Number(block.layout?.row || 1)),
    ...draft.layout.sections.flatMap((section) =>
      section.blockIds
        .map((blockId) => draft.blocks.find((block) => block.id === blockId)?.layout?.row)
        .filter(Boolean),
    ),
  );
}

function mediaBlockForAsset(asset, index, row) {
  return {
    id: `block-required-${asset.id}`,
    type: 'media',
    assetId: asset.id,
    content: asset.filename || `Required asset ${index + 1}`,
    layout: {
      column: index % 2 === 0 ? 1 : 7,
      row,
      width: 6,
    },
    visual: {
      backgroundColor: '#eef3f1',
      textColor: '#17211b',
      accentColor: '#2f7d5f',
      size: asset.family === 'image' || asset.family === 'video' ? 'standard' : 'compact',
    },
  };
}

function ensureRequiredAssets(draft, request) {
  const missingAssets = requiredAssetsFrom(request).filter(
    (asset) => !draft.blocks.some((block) => block.assetId === asset.id),
  );

  if (!missingAssets.length) {
    return draft;
  }

  const baseRow = maxRowFor(draft) + 1;
  const requiredBlocks = missingAssets.map((asset, index) =>
    mediaBlockForAsset(asset, index, baseRow + Math.floor(index / 2)),
  );
  const requiredSection = {
    id: 'section-required-assets',
    title: 'Required page media',
    blockIds: requiredBlocks.map((block) => block.id),
  };

  return {
    ...draft,
    blocks: [...draft.blocks, ...requiredBlocks],
    layout: {
      ...draft.layout,
      sections: [...draft.layout.sections, requiredSection],
    },
    localizations: Object.fromEntries(
      Object.entries(draft.localizations ?? {}).map(([language, localization]) => [
        language,
        {
          ...localization,
          blocks: [...localization.blocks, ...requiredBlocks],
          layout: localization.layout
            ? {
                ...localization.layout,
                sections: [...localization.layout.sections, requiredSection],
              }
            : undefined,
        },
      ]),
    ),
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
      const languages = normalizeLanguages(request.ai?.languages ?? storedSettings.languages);
      const label = providerLabel(provider);

      if (!storedSettings.apiKey) {
        return failedJob(request, `${label} generation is not configured for this workspace.`, steps);
      }

      try {
        const sources = await collectSourceMaterial(request, { fetcher });
        const prompt = buildGenerationPrompt({ ...request, ai: { ...request.ai, languages } }, sources);
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
        const draft = ensureRequiredAssets(
          normalizeAndValidateDraftResponse(generatedDraft, { ...request, ai: { ...request.ai, languages } }, now),
          request,
        );

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
