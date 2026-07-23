import type { GenerationRequest, GenerationResult, GenerationService } from './types';

interface LocalGenerationServiceOptions {
  now?: () => Date;
}

function proposalTitleFor(request: GenerationRequest) {
  const descriptionInput = request.pageContext.inputs.find((input) => input.type === 'description');
  if (descriptionInput?.content) {
    return descriptionInput.content.slice(0, 72);
  }

  return `Generated ${request.pageTitle}`;
}

export function createLocalGenerationService(
  options: LocalGenerationServiceOptions = {},
): GenerationService {
  let nextJobId = 1;
  const now = options.now ?? (() => new Date());

  return {
    async generateDraft(request: GenerationRequest): Promise<GenerationResult> {
      const timestamp = now().toISOString();

      const jobId = `job-${nextJobId}`;
      nextJobId += 1;

      return {
        draft: {
          id: request.pageContext.draft?.id ?? `draft-${request.pageId}`,
          pageId: request.pageId,
          title: proposalTitleFor(request),
          createdAt: request.pageContext.draft?.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
        job: {
          id: jobId,
          pageId: request.pageId,
          status: 'succeeded',
          steps: ['Collecting page inputs', 'Preparing draft request', 'Saving proposed draft'],
        },
      };
    },
  };
}
