import type { AddPageInputInput, PageContext, PageContextService, PageInput } from './types';

interface LocalPageContextServiceOptions {
  storageKey?: string;
}

interface PageContextStorage {
  inputs: PageInput[];
  nextInputId: number;
}

function readStorage(storageKey: string): PageContextStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return { inputs: [], nextInputId: 1 };
  }

  try {
    return JSON.parse(rawStorage) as PageContextStorage;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { inputs: [], nextInputId: 1 };
  }
}

function writeStorage(storageKey: string, storage: PageContextStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

export function createLocalPageContextService(
  options: LocalPageContextServiceOptions = {},
): PageContextService {
  const storageKey = options.storageKey ?? 'assisted-cms.page-context';

  return {
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
        draft: null,
        inputs: storage.inputs.filter((input) => input.pageId === pageId),
        versions: [],
        activePublication: null,
      };
    },
  };
}
