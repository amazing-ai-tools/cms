import type { ContentNode, ContentNodeType, ContentService, CreateContentNodeInput } from './types';

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

      const timestamp = new Date().toISOString();
      const node: ContentNode = {
        id: `node-${storage.nextId}`,
        workspaceId: input.workspaceId,
        parentId: input.parentId,
        type: input.type,
        title: input.title,
        sortOrder: storage.nodes.filter((candidate) => candidate.parentId === input.parentId).length,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      storage.nodes.push(node);
      storage.nextId += 1;
      writeStorage(storageKey, storage);

      return node;
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
  };
}
