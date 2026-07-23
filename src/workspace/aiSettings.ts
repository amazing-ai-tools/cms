export interface AiModelOption {
  id: string;
  label: string;
  supportedEfforts: string[];
}

export interface AiProviderOption {
  id: string;
  label: string;
  models: AiModelOption[];
}

export interface WorkspaceAiSettings {
  availableProviders: AiProviderOption[];
  effort?: string;
  hasApiKey: boolean;
  model: string;
  provider: string;
  workspaceId: string;
}

export interface SaveWorkspaceAiSettingsInput {
  apiKey?: string;
  effort?: string;
  model: string;
  provider: string;
}

export interface WorkspaceAiSettingsService {
  loadSettings(workspaceId: string): Promise<WorkspaceAiSettings>;
  saveSettings(
    workspaceId: string,
    input: SaveWorkspaceAiSettingsInput,
  ): Promise<WorkspaceAiSettings>;
}

export const DEFAULT_AI_PROVIDERS: AiProviderOption[] = [
  {
    id: 'xai',
    label: 'xAI',
    models: [{ id: 'grok-4.5', label: 'Grok 4.5', supportedEfforts: [] }],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: [
      {
        id: 'gpt-5.6',
        label: 'GPT-5.6 Sol',
        supportedEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
      },
      {
        id: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra',
        supportedEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
      },
      {
        id: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna',
        supportedEfforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
      },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: [
      {
        id: 'claude-opus-4-6',
        label: 'Claude Opus 4.6',
        supportedEfforts: ['low', 'medium', 'high', 'max'],
      },
      {
        id: 'claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        supportedEfforts: ['low', 'medium', 'high'],
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        supportedEfforts: [],
      },
    ],
  },
];

export function defaultWorkspaceAiSettings(workspaceId: string): WorkspaceAiSettings {
  return {
    availableProviders: DEFAULT_AI_PROVIDERS,
    hasApiKey: false,
    model: 'grok-4.5',
    provider: 'xai',
    workspaceId,
  };
}

export function effortOptionsFor(
  availableProviders: AiProviderOption[],
  providerId: string,
  modelId: string,
) {
  const provider = availableProviders.find((candidate) => candidate.id === providerId);
  const model = provider?.models.find((candidate) => candidate.id === modelId);
  return model?.supportedEfforts ?? [];
}
