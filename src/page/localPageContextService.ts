import type {
  AddPageAssetInput,
  AddPageInputInput,
  MaterialFamily,
  PageAsset,
  PageContext,
  PageContextService,
  PageInput,
} from './types';

interface LocalPageContextServiceOptions {
  storageKey?: string;
}

interface PageContextStorage {
  assets: PageAsset[];
  inputs: PageInput[];
  nextAssetId: number;
  nextInputId: number;
}

function readStorage(storageKey: string): PageContextStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return { assets: [], inputs: [], nextAssetId: 1, nextInputId: 1 };
  }

  try {
    const parsed = JSON.parse(rawStorage) as Partial<PageContextStorage>;
    return {
      assets: parsed.assets ?? [],
      inputs: parsed.inputs ?? [],
      nextAssetId: parsed.nextAssetId ?? 1,
      nextInputId: parsed.nextInputId ?? 1,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return { assets: [], inputs: [], nextAssetId: 1, nextInputId: 1 };
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
        draft: null,
        inputs: storage.inputs.filter((input) => input.pageId === pageId),
        versions: [],
        activePublication: null,
      };
    },
  };
}
