import type { GenerationRequest, GenerationResult, GenerationService } from './types';
import type { PageDraftBlock } from '../page/types';

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

function proposalBlocksFor(request: GenerationRequest): PageDraftBlock[] {
  const primaryDescription =
    request.pageContext.inputs.find((input) => input.type === 'description')?.content ??
    `Reusable page proposal for ${request.pageTitle}.`;
  const supportingIdeas = request.pageContext.inputs
    .filter((input) => input.type === 'idea')
    .map((input) => input.content)
    .join(' ');
  const hierarchyContext = request.hierarchyPath.length
    ? `Positioned in ${request.hierarchyPath.join(' / ')}.`
    : 'Positioned in the workspace hierarchy.';

  const blocks: PageDraftBlock[] = [
    {
      id: 'block-hero',
      type: 'hero',
      content: primaryDescription,
      layout: {
        column: 1,
        row: 1,
        width: 12,
      },
      visual: {
        backgroundColor: '#f7fbf5',
        textColor: '#17211b',
        accentColor: '#2f7d5f',
        size: 'large',
      },
    },
    {
      id: 'block-context',
      type: 'text',
      content: [supportingIdeas, hierarchyContext].filter(Boolean).join(' '),
      layout: {
        column: 1,
        row: 2,
        width: 8,
      },
      visual: {
        backgroundColor: '#ffffff',
        textColor: '#2c332f',
        accentColor: '#d66b3d',
        size: 'standard',
      },
    },
  ];

  request.pageContext.assets.forEach((asset, assetIndex) => {
    blocks.push({
      id: `block-asset-${asset.id}`,
      type: 'media',
      assetId: asset.id,
      content: asset.filename,
      layout: {
        column: assetIndex % 2 === 0 ? 9 : 1,
        row: 2 + assetIndex,
        width: asset.family === 'image' ? 4 : 6,
      },
      visual: {
        backgroundColor: '#eef3f1',
        textColor: '#27302b',
        accentColor: '#2f7d5f',
        size: 'standard',
      },
    });
  });

  return blocks;
}

export function createLocalGenerationService(
  options: LocalGenerationServiceOptions = {},
): GenerationService {
  let nextJobId = 1;
  const now = options.now ?? (() => new Date());

  return {
    async generateDraft(request: GenerationRequest): Promise<GenerationResult> {
      const timestamp = now().toISOString();
      const blocks = proposalBlocksFor(request);

      const jobId = `job-${nextJobId}`;
      nextJobId += 1;

      return {
        draft: {
          id: request.pageContext.draft?.id ?? `draft-${request.pageId}`,
          pageId: request.pageId,
          title: proposalTitleFor(request),
          blocks,
          layout: {
            canvas: {
              maxWidth: 1120,
            },
            sections: [
              {
                id: 'section-generated-proposal',
                title: 'Generated proposal',
                blockIds: blocks.map((block) => block.id),
              },
            ],
          },
          visual: {
            accentColor: '#2f7d5f',
            backgroundColor: '#fbfcf8',
            textColor: '#18201c',
            spacing: 'balanced',
          },
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
