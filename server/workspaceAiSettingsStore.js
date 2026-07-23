import { dirname } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  DEFAULT_AI_PROVIDERS,
  defaultModelFor,
  defaultProviderSettings,
  normalizeEffort,
  normalizeProviderId,
} from './providerCatalog.js';

function emptyRecord(workspaceId) {
  const defaults = defaultProviderSettings();

  return {
    providers: {},
    selected: defaults,
    updatedAt: new Date(0).toISOString(),
    workspaceId,
  };
}

function publicSettingsFromRecord(record) {
  const provider = normalizeProviderId(record.selected.provider);
  const providerSettings = record.providers[provider] ?? {};
  const model = record.selected.model || providerSettings.model || defaultModelFor(provider);
  const effort = normalizeEffort(provider, model, record.selected.effort ?? providerSettings.effort);

  return {
    availableProviders: DEFAULT_AI_PROVIDERS,
    ...(effort ? { effort } : {}),
    hasApiKey: Boolean(providerSettings.apiKey),
    model,
    provider,
    workspaceId: record.workspaceId,
  };
}

function privateProviderSettingsFromRecord(record, requestedProvider) {
  const provider = normalizeProviderId(requestedProvider ?? record.selected.provider);
  const providerSettings = record.providers[provider] ?? {};
  const model = providerSettings.model || defaultModelFor(provider);
  const effort = normalizeEffort(provider, model, providerSettings.effort);

  return {
    apiKey: providerSettings.apiKey || '',
    ...(effort ? { effort } : {}),
    model,
    provider,
  };
}

function normalizeSaveInput(input) {
  const provider = normalizeProviderId(input?.provider);
  const model = String(input?.model || defaultModelFor(provider)).trim() || defaultModelFor(provider);
  const effort = normalizeEffort(provider, model, input?.effort);
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : undefined;

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(effort ? { effort } : {}),
    model,
    provider,
  };
}

export function createMemoryWorkspaceAiSettingsStore(options = {}) {
  const records = new Map(Object.entries(options.records ?? {}));
  const now = options.now ?? (() => new Date());

  function recordFor(workspaceId) {
    return records.get(workspaceId) ?? emptyRecord(workspaceId);
  }

  return {
    async getProviderSettings(workspaceId, provider) {
      return privateProviderSettingsFromRecord(recordFor(workspaceId), provider);
    },

    async getPublicSettings(workspaceId) {
      return publicSettingsFromRecord(recordFor(workspaceId));
    },

    async saveSettings(workspaceId, input) {
      const current = recordFor(workspaceId);
      const normalizedInput = normalizeSaveInput(input);
      const currentProviderSettings = current.providers[normalizedInput.provider] ?? {};
      const nextRecord = {
        ...current,
        providers: {
          ...current.providers,
          [normalizedInput.provider]: {
            ...currentProviderSettings,
            ...normalizedInput,
            apiKey: normalizedInput.apiKey ?? currentProviderSettings.apiKey ?? '',
          },
        },
        selected: {
          effort: normalizedInput.effort,
          model: normalizedInput.model,
          provider: normalizedInput.provider,
        },
        updatedAt: now().toISOString(),
        workspaceId,
      };

      records.set(workspaceId, nextRecord);
      return publicSettingsFromRecord(nextRecord);
    },
  };
}

export function createFileWorkspaceAiSettingsStore(options = {}) {
  const filePath = options.filePath ?? '.data/ai-workspace-settings.json';
  const memoryStore = createMemoryWorkspaceAiSettingsStore({
    now: options.now,
  });
  let loaded = false;

  async function load() {
    if (loaded) {
      return;
    }

    loaded = true;
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      for (const [workspaceId, record] of Object.entries(parsed)) {
        const normalizedRecord = {
          ...emptyRecord(workspaceId),
          ...record,
          workspaceId,
        };
        for (const [provider, providerSettings] of Object.entries(normalizedRecord.providers ?? {})) {
          await memoryStore.saveSettings(workspaceId, {
            apiKey: providerSettings.apiKey,
            effort: providerSettings.effort,
            model: providerSettings.model,
            provider,
          });
        }
        await memoryStore.saveSettings(workspaceId, {
          effort: normalizedRecord.selected?.effort,
          model: normalizedRecord.selected?.model,
          provider: normalizedRecord.selected?.provider,
        });
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async function persistSnapshot(workspaceId, input) {
    await mkdir(dirname(filePath), { recursive: true });
    let currentRecords = {};
    try {
      currentRecords = JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }

    const existingRecord = currentRecords[workspaceId] ?? emptyRecord(workspaceId);
    const normalizedInput = normalizeSaveInput(input);
    const providerSettings = existingRecord.providers?.[normalizedInput.provider] ?? {};
    const nextRecord = {
      ...existingRecord,
      providers: {
        ...(existingRecord.providers ?? {}),
        [normalizedInput.provider]: {
          ...providerSettings,
          ...normalizedInput,
          apiKey: normalizedInput.apiKey ?? providerSettings.apiKey ?? '',
        },
      },
      selected: {
        effort: normalizedInput.effort,
        model: normalizedInput.model,
        provider: normalizedInput.provider,
      },
      updatedAt: new Date().toISOString(),
      workspaceId,
    };

    currentRecords[workspaceId] = nextRecord;
    await writeFile(filePath, `${JSON.stringify(currentRecords, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  return {
    async getProviderSettings(workspaceId, provider) {
      await load();
      return memoryStore.getProviderSettings(workspaceId, provider);
    },

    async getPublicSettings(workspaceId) {
      await load();
      return memoryStore.getPublicSettings(workspaceId);
    },

    async saveSettings(workspaceId, input) {
      await load();
      await persistSnapshot(workspaceId, input);
      return memoryStore.saveSettings(workspaceId, input);
    },
  };
}
