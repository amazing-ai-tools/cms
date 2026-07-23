import type { PageContext } from '../page/types';

export interface GenerationPayload {
  assets: Array<{
    family: string;
    filename: string;
    storageUrl: string;
    mimeType: string;
    sourceContent?: string;
    sourceEncoding?: string;
  }>;
  inputs: Array<{
    content: string;
    type: string;
  }>;
  links: string[];
  pageId: string;
}

export function buildGenerationPayload(pageContext: PageContext): GenerationPayload {
  return {
    pageId: pageContext.pageId,
    inputs: pageContext.inputs.map((input) => ({
      type: input.type,
      content: input.content,
    })),
    links: pageContext.inputs
      .filter((input) => input.type === 'link')
      .map((input) => input.content),
    assets: pageContext.assets.map((asset) => ({
      filename: asset.filename,
      family: asset.family,
      mimeType: asset.mimeType,
      sourceContent: asset.sourceContent,
      sourceEncoding: asset.sourceEncoding,
      storageUrl: asset.storageUrl,
    })),
  };
}
