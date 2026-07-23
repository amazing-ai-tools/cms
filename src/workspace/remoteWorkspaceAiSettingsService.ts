import type {
  SaveWorkspaceAiSettingsInput,
  WorkspaceAiSettings,
  WorkspaceAiSettingsService,
} from './aiSettings';

type SettingsFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RemoteWorkspaceAiSettingsServiceOptions {
  baseUrl?: string;
  fetcher?: SettingsFetch;
}

function defaultFetcher(): SettingsFetch {
  return window.fetch.bind(window);
}

function endpointFor(baseUrl: string, workspaceId: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}/api/workspaces/${encodeURIComponent(workspaceId)}/ai-settings`;
}

async function parseResponse(response: Response) {
  try {
    return (await response.json()) as WorkspaceAiSettings & { error?: string };
  } catch {
    return null;
  }
}

function messageFromResponse(body: Awaited<ReturnType<typeof parseResponse>>, status: number) {
  if (body && 'error' in body && body.error) {
    return body.error;
  }

  return `AI settings request failed with status ${status}.`;
}

export function createRemoteWorkspaceAiSettingsService(
  options: RemoteWorkspaceAiSettingsServiceOptions = {},
): WorkspaceAiSettingsService {
  const baseUrl = options.baseUrl ?? '';
  const fetcher = options.fetcher ?? defaultFetcher();

  return {
    async loadSettings(workspaceId: string) {
      const response = await fetcher(endpointFor(baseUrl, workspaceId));
      const body = await parseResponse(response);

      if (!response.ok || !body) {
        throw new Error(messageFromResponse(body, response.status));
      }

      return body;
    },

    async saveSettings(workspaceId: string, input: SaveWorkspaceAiSettingsInput) {
      const response = await fetcher(endpointFor(baseUrl, workspaceId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await parseResponse(response);

      if (!response.ok || !body) {
        throw new Error(messageFromResponse(body, response.status));
      }

      return body;
    },
  };
}
