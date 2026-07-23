import type { GenerationRequest, GenerationResult, GenerationService } from './types';

type GenerationFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface RemoteGenerationServiceOptions {
  endpoint?: string;
  fetcher?: GenerationFetch;
}

function defaultFetcher(): GenerationFetch {
  return window.fetch.bind(window);
}

function messageFromFailedResponse(body: unknown, status: number) {
  if (body && typeof body === 'object') {
    const generationBody = body as Partial<GenerationResult> & { error?: string };
    if (generationBody.job?.error) {
      return generationBody.job.error;
    }

    if (generationBody.error) {
      return generationBody.error;
    }
  }

  return `Generation request failed with status ${status}.`;
}

async function parseResponseBody(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export function createRemoteGenerationService(
  options: RemoteGenerationServiceOptions = {},
): GenerationService {
  const endpoint = options.endpoint ?? '/api/generation/draft';
  const fetcher = options.fetcher ?? defaultFetcher();

  return {
    async generateDraft(request: GenerationRequest): Promise<GenerationResult> {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(messageFromFailedResponse(body, response.status));
      }

      return body as GenerationResult;
    },
  };
}
