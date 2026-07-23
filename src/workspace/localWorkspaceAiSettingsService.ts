import {
  defaultWorkspaceAiSettings,
  type SaveWorkspaceAiSettingsInput,
  type WorkspaceAiSettings,
  type WorkspaceAiSettingsService,
} from './aiSettings';

interface LocalWorkspaceAiSettingsServiceOptions {
  storageKey?: string;
}

type AiSettingsStorage = Record<string, WorkspaceAiSettings>;

function readStorage(storageKey: string): AiSettingsStorage {
  const rawStorage = window.localStorage.getItem(storageKey);
  if (!rawStorage) {
    return {};
  }

  try {
    return JSON.parse(rawStorage) as AiSettingsStorage;
  } catch {
    window.localStorage.removeItem(storageKey);
    return {};
  }
}

function writeStorage(storageKey: string, storage: AiSettingsStorage) {
  window.localStorage.setItem(storageKey, JSON.stringify(storage));
}

export function createLocalWorkspaceAiSettingsService(
  options: LocalWorkspaceAiSettingsServiceOptions = {},
): WorkspaceAiSettingsService {
  const storageKey = options.storageKey ?? 'assisted-cms.ai-settings';

  return {
    async loadSettings(workspaceId: string) {
      return readStorage(storageKey)[workspaceId] ?? defaultWorkspaceAiSettings(workspaceId);
    },

    async saveSettings(
      workspaceId: string,
      input: SaveWorkspaceAiSettingsInput,
    ): Promise<WorkspaceAiSettings> {
      const storage = readStorage(storageKey);
      const current = storage[workspaceId] ?? defaultWorkspaceAiSettings(workspaceId);
      const nextSettings: WorkspaceAiSettings = {
        ...current,
        effort: input.effort || undefined,
        hasApiKey: Boolean(input.apiKey) || current.hasApiKey,
        model: input.model,
        provider: input.provider,
        workspaceId,
      };

      storage[workspaceId] = nextSettings;
      writeStorage(storageKey, storage);

      return nextSettings;
    },
  };
}
