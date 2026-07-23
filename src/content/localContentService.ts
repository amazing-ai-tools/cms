import type {
  ContentNode,
  ContentNodeType,
  ContentService,
  CreateContentNodeInput,
  UpdateContentNodeInput,
} from './types';

interface LocalContentServiceOptions {
  storageKey?: string;
}

interface ContentStorage {
  nodes: ContentNode[];
  nextId: number;
}

function readStorage(storageKey: string): ContentStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return { nodes: [], nextId: 1 };
  }

  try {
    return JSON.parse(rawStorage) as ContentStorage;
  } catch {
    window.localStorage.removeItem(storageKey);
    return { nodes: [], nextId: 1 };
  }
}

function writeStorage(storageKey: string, storage: ContentStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

function findNode(storage: ContentStorage, nodeId: string) {
  return storage.nodes.find((node) => node.id === nodeId) ?? null;
}

function isCategoryNodeType(nodeType: ContentNodeType) {
  return nodeType === 'category' || nodeType === 'subcategory';
}

function normalizeTitle(title: string) {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    throw new Error('Category name is required.');
  }

  return normalizedTitle;
}

function normalizeSlug(slug: string) {
  const normalizedSlug = slug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalizedSlug) {
    throw new Error('Category slug is required.');
  }

  return normalizedSlug;
}

function isValidParentType(nodeType: ContentNodeType, parentType: ContentNodeType | null) {
  if (nodeType === 'category') {
    return parentType === null || parentType === 'category' || parentType === 'subcategory';
  }

  if (nodeType === 'subcategory') {
    return parentType === 'category' || parentType === 'subcategory';
  }

  return parentType === 'category' || parentType === 'subcategory' || parentType === 'page';
}

function validationMessageFor(nodeType: ContentNodeType) {
  if (nodeType === 'category') {
    return 'Categories must be created at the workspace root or inside another category.';
  }

  if (nodeType === 'subcategory') {
    return 'Subcategories must be created under a category or subcategory.';
  }

  return 'Pages must be created inside a category, subcategory, or page.';
}

function assertParentIsValid(
  storage: ContentStorage,
  workspaceId: string,
  nodeType: ContentNodeType,
  parentId: string | null,
) {
  if (parentId === null) {
    if (!isValidParentType(nodeType, null)) {
      throw new Error(validationMessageFor(nodeType));
    }
    return;
  }

  const parent = findNode(storage, parentId);
  if (!parent || parent.workspaceId !== workspaceId || !isValidParentType(nodeType, parent.type)) {
    throw new Error(validationMessageFor(nodeType));
  }
}

function assertDoesNotCreateCycle(storage: ContentStorage, nodeId: string, nextParentId: string | null) {
  let currentParentId = nextParentId;

  while (currentParentId) {
    if (currentParentId === nodeId) {
      throw new Error('Cannot move a node inside its own descendant.');
    }

    currentParentId = findNode(storage, currentParentId)?.parentId ?? null;
  }
}

export function createLocalContentService(options: LocalContentServiceOptions = {}): ContentService {
  const storageKey = options.storageKey ?? 'assisted-cms.content';

  return {
    async createNode(input: CreateContentNodeInput) {
      const storage = readStorage(storageKey);
      assertParentIsValid(storage, input.workspaceId, input.type, input.parentId);
      const title = normalizeTitle(input.title);

      const timestamp = new Date().toISOString();
      const node: ContentNode = {
        id: `node-${storage.nextId}`,
        workspaceId: input.workspaceId,
        parentId: input.parentId,
        type: input.type,
        title,
        slug: isCategoryNodeType(input.type) ? normalizeSlug(input.slug ?? title) : undefined,
        sortOrder: storage.nodes.filter((candidate) => candidate.parentId === input.parentId).length,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      storage.nodes.push(node);
      storage.nextId += 1;
      writeStorage(storageKey, storage);

      return node;
    },

    async deleteNode(nodeId: string) {
      const storage = readStorage(storageKey);
      const node = findNode(storage, nodeId);
      if (!node) {
        throw new Error('Content node was not found.');
      }

      if (storage.nodes.some((candidate) => candidate.parentId === nodeId)) {
        throw new Error('Delete child items before deleting this category.');
      }

      storage.nodes = storage.nodes.filter((candidate) => candidate.id !== nodeId);
      writeStorage(storageKey, storage);
    },

    async listNodes(workspaceId: string) {
      return readStorage(storageKey).nodes.filter((node) => node.workspaceId === workspaceId);
    },

    async moveNode(nodeId: string, parentId: string | null) {
      const storage = readStorage(storageKey);
      const node = findNode(storage, nodeId);
      if (!node) {
        throw new Error('Content node was not found.');
      }

      assertDoesNotCreateCycle(storage, nodeId, parentId);
      assertParentIsValid(storage, node.workspaceId, node.type, parentId);

      const updatedNode = {
        ...node,
        parentId,
        updatedAt: new Date().toISOString(),
      };
      storage.nodes = storage.nodes.map((candidate) =>
        candidate.id === nodeId ? updatedNode : candidate,
      );
      writeStorage(storageKey, storage);

      return updatedNode;
    },

    async updateNode(nodeId: string, input: UpdateContentNodeInput) {
      const storage = readStorage(storageKey);
      const node = findNode(storage, nodeId);
      if (!node) {
        throw new Error('Content node was not found.');
      }

      const title = input.title === undefined ? node.title : normalizeTitle(input.title);
      const updatedNode: ContentNode = {
        ...node,
        title,
        slug: isCategoryNodeType(node.type)
          ? normalizeSlug(input.slug ?? node.slug ?? title)
          : node.slug,
        updatedAt: new Date().toISOString(),
      };

      storage.nodes = storage.nodes.map((candidate) =>
        candidate.id === nodeId ? updatedNode : candidate,
      );
      writeStorage(storageKey, storage);

      return updatedNode;
    },
  };
}
