import type { PageContext, PageDraft } from '../page/types';

export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface GenerationJob {
  id: string;
  pageId: string;
  status: GenerationJobStatus;
  steps: string[];
  error?: string;
}

export interface GenerationRequest {
  hierarchyPath: string[];
  pageContext: PageContext;
  pageId: string;
  pageTitle: string;
}

export interface GenerationResult {
  draft?: PageDraft;
  job: GenerationJob;
}

export interface GenerationService {
  generateDraft(request: GenerationRequest): Promise<GenerationResult>;
}
