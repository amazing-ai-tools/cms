import type {
  AddPageAssetInput,
  AddPageInputInput,
  MaterialFamily,
  PageAsset,
  PageContext,
  PagePublication,
  PageContextService,
  PageDraft,
  PageInput,
  PublishDraftInput,
  PublishedVersion,
  SavePageDraftInput,
} from './types';
import { validatePageDraft } from './draftSchema';

interface LocalPageContextServiceOptions {
  failPublish?: boolean;
  storageKey?: string;
}

interface PageContextStorage {
  assets: PageAsset[];
  drafts: PageDraft[];
  inputs: PageInput[];
  nextAssetId: number;
  nextDraftId: number;
  nextInputId: number;
  nextVersionId: number;
  publications: PagePublication[];
  versions: PublishedVersion[];
}

function emptyStorage(): PageContextStorage {
  return {
    assets: [],
    drafts: [],
    inputs: [],
    nextAssetId: 1,
    nextDraftId: 1,
    nextInputId: 1,
    nextVersionId: 1,
    publications: [],
    versions: [],
  };
}

function normalizeDraft(draft: PageDraft): PageDraft {
  return {
    ...draft,
    isDirty: draft.isDirty ?? true,
  };
}

function readStorage(storageKey: string): PageContextStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return emptyStorage();
  }

  try {
    const parsed = JSON.parse(rawStorage) as Partial<PageContextStorage>;
    return {
      assets: parsed.assets ?? [],
      drafts: (parsed.drafts ?? []).map(normalizeDraft),
      inputs: parsed.inputs ?? [],
      nextAssetId: parsed.nextAssetId ?? 1,
      nextDraftId: parsed.nextDraftId ?? 1,
      nextInputId: parsed.nextInputId ?? 1,
      nextVersionId: parsed.nextVersionId ?? 1,
      publications: parsed.publications ?? [],
      versions: parsed.versions ?? [],
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return emptyStorage();
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

function copySnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createLocalPageContextService(
  options: LocalPageContextServiceOptions = {},
): PageContextService {
  const storageKey = options.storageKey ?? 'assisted-cms.page-context';
  const failPublish = options.failPublish ?? false;

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
        versions: storage.versions.filter((version) => version.pageId === pageId),
        activePublication:
          storage.publications.find((publication) => publication.pageId === pageId) ?? null,
      };
    },

    async getActivePublishedVersion(pageId: string): Promise<PublishedVersion | null> {
      const storage = readStorage(storageKey);
      const publication = storage.publications.find(
        (candidate) => candidate.pageId === pageId && candidate.status === 'published',
      );
      if (!publication) {
        return null;
      }

      return (
        storage.versions.find(
          (version) => version.pageId === pageId && version.id === publication.activeVersionId,
        ) ?? null
      );
    },

    async publishDraft(input: PublishDraftInput): Promise<PublishedVersion> {
      if (failPublish) {
        throw new Error('Publish failed before the active version changed.');
      }

      const storage = readStorage(storageKey);
      const draftIndex = storage.drafts.findIndex((draft) => draft.pageId === input.pageId);
      const draft = draftIndex >= 0 ? storage.drafts[draftIndex] : null;
      if (!draft) {
        throw new Error('Draft must exist before publishing.');
      }

      validatePageDraft(draft);

      const timestamp = new Date().toISOString();
      const versionNumber =
        storage.versions.filter((version) => version.pageId === input.pageId).length + 1;
      const pageAssets = storage.assets.filter((asset) => asset.pageId === input.pageId);
      const version: PublishedVersion = {
        id: `version-${storage.nextVersionId}`,
        pageId: input.pageId,
        versionNumber,
        title: draft.title,
        contentSnapshot: copySnapshot(draft.blocks),
        layoutSnapshot: copySnapshot(draft.layout),
        visualSnapshot: copySnapshot(draft.visual),
        assetManifest: pageAssets.map((asset) => ({
          assetId: asset.id,
          filename: asset.filename,
          mimeType: asset.mimeType,
          storageUrl: asset.storageUrl,
          cdnUrl: asset.cdnUrl,
        })),
        cdnUrls: {
          content: '',
          media: [],
          script: '',
        },
        embedUrl: '',
        createdAt: timestamp,
        createdBy: input.createdBy,
      };

      storage.versions.push(version);
      storage.nextVersionId += 1;
      const publication: PagePublication = {
        pageId: input.pageId,
        activeVersionId: version.id,
        lastPublishedAt: timestamp,
        status: 'published',
      };
      const publicationIndex = storage.publications.findIndex(
        (candidate) => candidate.pageId === input.pageId,
      );
      if (publicationIndex >= 0) {
        storage.publications[publicationIndex] = publication;
      } else {
        storage.publications.push(publication);
      }
      storage.drafts[draftIndex] = {
        ...draft,
        isDirty: false,
        updatedAt: timestamp,
      };
      writeStorage(storageKey, storage);

      return version;
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
        isDirty: input.isDirty ?? true,
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
