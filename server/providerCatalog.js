export const DEFAULT_AI_PROVIDERS = [
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

export function defaultProviderSettings() {
  return {
    effort: undefined,
    languages: ['en'],
    model: 'grok-4.5',
    provider: 'xai',
  };
}

export function normalizeLanguages(languages) {
  const selected = Array.isArray(languages)
    ? languages.map((language) => String(language).trim()).filter(Boolean)
    : [];
  const unique = Array.from(new Set(selected));

  return unique.length ? unique : ['en'];
}

export function normalizeProviderId(provider) {
  const candidate = String(provider || '').trim().toLowerCase();
  return DEFAULT_AI_PROVIDERS.some((option) => option.id === candidate) ? candidate : 'xai';
}

export function providerLabel(provider) {
  return DEFAULT_AI_PROVIDERS.find((option) => option.id === provider)?.label ?? provider;
}

export function defaultModelFor(provider) {
  return (
    DEFAULT_AI_PROVIDERS.find((option) => option.id === provider)?.models[0]?.id ??
    defaultProviderSettings().model
  );
}

export function supportedEffortsFor(provider, model) {
  const providerConfig = DEFAULT_AI_PROVIDERS.find((option) => option.id === provider);
  const exactModel = providerConfig?.models.find((option) => option.id === model);

  if (exactModel) {
    return exactModel.supportedEfforts;
  }

  if (provider === 'openai' && model?.startsWith('gpt-5')) {
    return ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
  }

  if (
    provider === 'anthropic' &&
    (model?.startsWith('claude-opus-4') || model?.startsWith('claude-sonnet-4'))
  ) {
    return model.includes('opus')
      ? ['low', 'medium', 'high', 'max']
      : ['low', 'medium', 'high'];
  }

  return [];
}

export function normalizeEffort(provider, model, effort) {
  const candidate = String(effort || '').trim().toLowerCase();
  const supportedEfforts = supportedEffortsFor(provider, model);
  return supportedEfforts.includes(candidate) ? candidate : undefined;
}
