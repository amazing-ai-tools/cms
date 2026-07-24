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

  const instructionInput = request.pageContext.inputs.find((input) => input.type === 'instruction');
  if (instructionInput?.content) {
    return instructionInput.content.slice(0, 72);
  }

  return `Generated ${request.pageTitle}`;
}

function seoFor(request: GenerationRequest, title: string) {
  const inputSummary =
    request.pageContext.inputs.find((input) => input.content.trim())?.content.trim() ??
    `Generated embedded page for ${request.pageTitle}.`;
  const keywords = Array.from(
    new Set([
      request.pageTitle,
      ...request.hierarchyPath,
      ...request.pageContext.inputs
        .flatMap((input) => input.content.split(/\W+/))
        .filter((word) => word.length > 5)
        .slice(0, 4),
    ]),
  ).slice(0, 8);

  return {
    title: `${title} | ${request.pageTitle}`,
    description: inputSummary.slice(0, 150),
    keywords: keywords.length ? keywords : [request.pageTitle],
  };
}

function proposalBlocksFor(request: GenerationRequest): PageDraftBlock[] {
  const instructionInputs = request.pageContext.inputs
    .filter((input) => input.type === 'instruction')
    .map((input) => input.content);
  const linkInputs = request.pageContext.inputs
    .filter((input) => input.type === 'link')
    .map((input) => input.content);
  const primaryDescription =
    request.pageContext.inputs.find((input) => input.type === 'description')?.content ??
    instructionInputs[0] ??
    `Reusable page proposal for ${request.pageTitle}.`;
  const supportingIdeas = request.pageContext.inputs
    .filter((input) => input.type === 'idea')
    .map((input) => input.content)
    .join(' ');
  const supportingInstructions = instructionInputs.join(' ');
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
      content: [supportingIdeas, supportingInstructions, hierarchyContext].filter(Boolean).join(' '),
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

  if (linkInputs.length) {
    blocks.push({
      id: 'block-reference-links',
      type: 'text',
      content: `References reviewed: ${linkInputs.join(', ')}`,
      layout: {
        column: 1,
        row: 3,
        width: 8,
      },
      visual: {
        backgroundColor: '#fff9ef',
        textColor: '#2c332f',
        accentColor: '#d66b3d',
        size: 'standard',
      },
    });
  }

  request.pageContext.assets
    .filter((asset) => asset.sourceIntent === 'required')
    .forEach((asset, assetIndex) => {
      blocks.push({
        id: `block-asset-${asset.id}`,
        type: 'media',
        assetId: asset.id,
        content: asset.filename,
        layout: {
          column: assetIndex % 2 === 0 ? 9 : 1,
          row: 3 + assetIndex + (linkInputs.length ? 1 : 0),
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

  (request.childContent ?? []).forEach((child, childIndex) => {
    const visibleTitle = child.title.trim() || 'child content';
    blocks.push({
      id: `block-child-${child.id}`,
      type: 'text',
      content: `Open ${visibleTitle}`,
      href: child.href,
      layout: {
        column: childIndex % 2 === 0 ? 1 : 7,
        row: 4 + childIndex + (linkInputs.length ? 1 : 0),
        width: 6,
      },
      visual: {
        backgroundColor: '#f4f8f5',
        textColor: '#17211b',
        accentColor: '#2f7d5f',
        size: 'standard',
      },
    });
  });

  return blocks;
}

function generationStepsFor(request: GenerationRequest) {
  const steps = ['Collecting page inputs'];

  if (request.pageContext.inputs.some((input) => input.type === 'instruction')) {
    steps.push('Reviewing instructions');
  }

  if (request.pageContext.inputs.some((input) => input.type === 'link')) {
    steps.push('Reviewing reference links');
  }

  if (request.pageContext.assets.length) {
    steps.push('Reviewing uploaded materials');
  }

  steps.push('Preparing draft request', 'Saving proposed draft');
  return steps;
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
      const languages = request.ai?.languages?.length ? request.ai.languages : ['en'];
      const [baseLanguage, ...localizedLanguages] = languages;

      const jobId = `job-${nextJobId}`;
      nextJobId += 1;
      const title = proposalTitleFor(request);
      const seo = seoFor(request, title);

      return {
        draft: {
          id: request.pageContext.draft?.id ?? `draft-${request.pageId}`,
          pageId: request.pageId,
          title,
          isDirty: true,
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
          seo,
          language: baseLanguage,
          localizations: Object.fromEntries(
            localizedLanguages.map((language) => [
              language,
              {
                title: `${title} (${language})`,
                seo: {
                  title: `${seo.title} (${language})`,
                  description: `${seo.description} (${language})`,
                  keywords: seo.keywords,
                },
                blocks: blocks.map((block) => ({
                  ...block,
                  content: block.type === 'media' ? block.content : `${block.content} (${language})`,
                })),
              },
            ]),
          ),
          createdAt: request.pageContext.draft?.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
        job: {
          id: jobId,
          pageId: request.pageId,
          status: 'succeeded',
          steps: generationStepsFor(request),
        },
      };
    },
  };
}
