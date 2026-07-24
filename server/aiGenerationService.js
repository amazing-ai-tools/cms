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

function requiredInputsFrom(request) {
  return (request.pageContext?.inputs ?? []).filter(
    (input) => input.sourceIntent === 'required' && String(input.content || '').trim(),
  );
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

function blockContentForInput(input) {
  const content = String(input.content || '').replace(/\s+/g, ' ').trim();
  const visibleContent = input.type === 'link' ? `Required reference: ${content}` : content;
  const validContent =
    visibleContent.length >= 8 ? visibleContent : `Required content: ${visibleContent}`;

  return validContent.length > 1200 ? `${validContent.slice(0, 1197)}...` : validContent;
}

function blockIdForRequiredInput(input) {
  return `block-required-${String(input.id || input.content || 'input')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)}`;
}

function draftIncludesContent(draft, content) {
  const normalizedContent = String(content || '').toLowerCase();
  return draft.blocks.some((block) => String(block.content || '').toLowerCase().includes(normalizedContent));
}

function textBlockForInput(input, index, row) {
  return {
    id: blockIdForRequiredInput(input),
    type: 'text',
    content: blockContentForInput(input),
    layout: {
      column: index % 2 === 0 ? 1 : 7,
      row,
      width: 6,
    },
    visual: {
      backgroundColor: '#fffdf8',
      textColor: '#17211b',
      accentColor: '#c96f3d',
      size: 'standard',
    },
  };
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

function appendRequiredBlocksToLocalizations(localizations, blocks, section) {
  return Object.fromEntries(
    Object.entries(localizations ?? {}).map(([language, localization]) => [
      language,
      {
        ...localization,
        blocks: [...localization.blocks, ...blocks],
        layout: localization.layout
          ? {
              ...localization.layout,
              sections: [...localization.layout.sections, section],
            }
          : undefined,
      },
    ]),
  );
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
    localizations: appendRequiredBlocksToLocalizations(draft.localizations, requiredBlocks, requiredSection),
  };
}

function ensureRequiredInputs(draft, request) {
  const missingInputs = requiredInputsFrom(request).filter(
    (input) => !draftIncludesContent(draft, String(input.content || '').trim()),
  );

  if (!missingInputs.length) {
    return draft;
  }

  const baseRow = maxRowFor(draft) + 1;
  const requiredBlocks = missingInputs.map((input, index) =>
    textBlockForInput(input, index, baseRow + Math.floor(index / 2)),
  );
  const requiredSection = {
    id: 'section-required-content',
    title: 'Required page content',
    blockIds: requiredBlocks.map((block) => block.id),
  };

  return {
    ...draft,
    blocks: [...draft.blocks, ...requiredBlocks],
    layout: {
      ...draft.layout,
      sections: [...draft.layout.sections, requiredSection],
    },
    localizations: appendRequiredBlocksToLocalizations(draft.localizations, requiredBlocks, requiredSection),
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
        const draft = ensureRequiredInputs(
          ensureRequiredAssets(
            normalizeAndValidateDraftResponse(generatedDraft, { ...request, ai: { ...request.ai, languages } }, now),
            request,
          ),
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
