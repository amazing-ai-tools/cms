import type {
  AddPageAssetInput,
  AddPageInputInput,
  MaterialFamily,
  PageAsset,
  PageContext,
  PageContextService,
  PageDraft,
  PageInput,
  SavePageDraftInput,
} from './types';
import { validatePageDraft } from './draftSchema';

interface LocalPageContextServiceOptions {
  storageKey?: string;
}

interface PageContextStorage {
  assets: PageAsset[];
  drafts: PageDraft[];
  inputs: PageInput[];
  nextAssetId: number;
  nextDraftId: number;
  nextInputId: number;
}

function readStorage(storageKey: string): PageContextStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return { assets: [], drafts: [], inputs: [], nextAssetId: 1, nextDraftId: 1, nextInputId: 1 };
  }

  try {
    const parsed = JSON.parse(rawStorage) as Partial<PageContextStorage>;
    return {
      assets: parsed.assets ?? [],
      drafts: parsed.drafts ?? [],
      inputs: parsed.inputs ?? [],
      nextAssetId: parsed.nextAssetId ?? 1,
      nextDraftId: parsed.nextDraftId ?? 1,
      nextInputId: parsed.nextInputId ?? 1,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return { assets: [], drafts: [], inputs: [], nextAssetId: 1, nextDraftId: 1, nextInputId: 1 };
  }
}

function writeStorage(storageKey: string, storage: PageContextStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

function materialFamilyFor(filename: string, mimeType: string): MaterialFamily {
  const lowerFilename = filename.toLowerCase();

  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    return 'media';
  }

  if (mimeType === 'application/pdf' || lowerFilename.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerFilename.endsWith('.doc') ||
    lowerFilename.endsWith('.docx')
  ) {
    return 'word';
  }

  throw new Error(`${filename} is not a supported material.`);
}

export function createLocalPageContextService(
  options: LocalPageContextServiceOptions = {},
): PageContextService {
  const storageKey = options.storageKey ?? 'assisted-cms.page-context';

  return {
    async addAsset(input: AddPageAssetInput): Promise<PageAsset> {
      const storage = readStorage(storageKey);
      const family = materialFamilyFor(input.filename, input.mimeType);
      const asset: PageAsset = {
        id: `asset-${storage.nextAssetId}`,
        pageId: input.pageId,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        family,
        storageUrl: `local://assets/${input.pageId}/asset-${storage.nextAssetId}/${encodeURIComponent(
          input.filename,
        )}`,
        cdnUrl: null,
        uploadState: 'uploaded',
        createdAt: new Date().toISOString(),
      };

      storage.assets.push(asset);
      storage.nextAssetId += 1;
      writeStorage(storageKey, storage);

      return asset;
    },

    async addInput(input: AddPageInputInput): Promise<PageInput> {
      const storage = readStorage(storageKey);
      const pageInput: PageInput = {
        id: `input-${storage.nextInputId}`,
        pageId: input.pageId,
        type: input.type,
        content: input.content.trim(),
        createdAt: new Date().toISOString(),
      };

      storage.inputs.push(pageInput);
      storage.nextInputId += 1;
      writeStorage(storageKey, storage);

      return pageInput;
    },

    async loadPageContext(pageId: string): Promise<PageContext> {
      const storage = readStorage(storageKey);

      return {
        pageId,
        assets: storage.assets.filter((asset) => asset.pageId === pageId),
        draft: storage.drafts.find((draft) => draft.pageId === pageId) ?? null,
        inputs: storage.inputs.filter((input) => input.pageId === pageId),
        versions: [],
        activePublication: null,
      };
    },

    async saveDraft(input: SavePageDraftInput): Promise<PageDraft> {
      validatePageDraft(input);

      const storage = readStorage(storageKey);
      const existingDraftIndex = storage.drafts.findIndex((draft) => draft.pageId === input.pageId);
      const existingDraft =
        existingDraftIndex >= 0 ? storage.drafts[existingDraftIndex] : undefined;
      const now = new Date().toISOString();
      const draft: PageDraft = {
        id: input.id ?? existingDraft?.id ?? `draft-${storage.nextDraftId}`,
        pageId: input.pageId,
        title: input.title.trim(),
        blocks: input.blocks,
        layout: input.layout,
        visual: input.visual,
        createdAt: input.createdAt ?? existingDraft?.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
      };

      if (existingDraftIndex >= 0) {
        storage.drafts[existingDraftIndex] = draft;
      } else {
        storage.drafts.push(draft);
        storage.nextDraftId += 1;
      }

      writeStorage(storageKey, storage);
      return draft;
    },
  };
}
