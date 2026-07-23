import type { AuthUser } from '../auth/types';
import type { Workspace, WorkspaceLoadResult, WorkspaceService } from './types';

interface LocalWorkspaceServiceOptions {
  latencyMs?: number;
  storageKey?: string;
}

type WorkspaceStorage = Record<string, Workspace>;

function delay(latencyMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, latencyMs);
  });
}

function readWorkspaceStorage(storageKey: string): WorkspaceStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return {};
  }

  try {
    return JSON.parse(rawStorage) as WorkspaceStorage;
  } catch {
    window.localStorage.removeItem(storageKey);
    return {};
  }
}

function writeWorkspaceStorage(storageKey: string, storage: WorkspaceStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

function createWorkspace(user: AuthUser): Workspace {
  const timestamp = new Date().toISOString();

  return {
    id: `workspace-${user.id}`,
    ownerUserId: user.id,
    name: `${user.name}'s CMS Workspace`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createLocalWorkspaceService(
  options: LocalWorkspaceServiceOptions = {},
): WorkspaceService {
  const storageKey = options.storageKey ?? 'assisted-cms.workspaces';
  const latencyMs = options.latencyMs ?? 0;

  return {
    async getWorkspaceForUser(userId: string) {
      if (latencyMs) {
        await delay(latencyMs);
      }

      return readWorkspaceStorage(storageKey)[userId] ?? null;
    },

    async loadOrCreateWorkspace(user: AuthUser): Promise<WorkspaceLoadResult> {
      if (latencyMs) {
        await delay(latencyMs);
      }

      const storage = readWorkspaceStorage(storageKey);
      const existingWorkspace = storage[user.id];
      if (existingWorkspace) {
        return { workspace: existingWorkspace, created: false };
      }

      const workspace = createWorkspace(user);
      storage[user.id] = workspace;
      writeWorkspaceStorage(storageKey, storage);

      return { workspace, created: true };
    },
  };
}
