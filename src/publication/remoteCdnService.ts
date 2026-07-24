import type { PublishedVersion } from '../page/types';
import type { CdnPublicationResult, CdnService } from './cdn';

type CdnFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RemoteCdnServiceOptions {
  baseUrl?: string;
  fetcher?: CdnFetch;
}

function defaultFetcher(): CdnFetch {
  return window.fetch.bind(window);
}

function endpointFor(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}/api/cdn/publish-version`;
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, status: number) {
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
    return body.error;
  }

  return `CDN publish request failed with status ${status}.`;
}

export function createRemoteCdnService(options: RemoteCdnServiceOptions = {}): CdnService {
  const baseUrl = options.baseUrl ?? '';
  const fetcher = options.fetcher ?? defaultFetcher();

  return {
    async publishVersion(version: PublishedVersion): Promise<CdnPublicationResult> {
      const response = await fetcher(endpointFor(baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const body = await parseJson(response);

      if (!response.ok || !body) {
        throw new Error(errorMessage(body, response.status));
      }

      return body as CdnPublicationResult;
    },

    async readJson<T = unknown>(url: string): Promise<T | null> {
      const response = await fetcher(url);
      if (!response.ok) {
        return null;
      }

      return (await response.json()) as T;
    },

    async verifyUrl(url: string): Promise<boolean> {
      try {
        const response = await fetcher(url, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
