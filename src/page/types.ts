export type PageInputType = 'instruction' | 'idea' | 'description' | 'link' | 'upload';
export type MaterialFamily = 'audio' | 'document' | 'image' | 'media' | 'pdf' | 'video' | 'word';
export type PageAssetSourceEncoding = 'text' | 'data-url';
export type PageSourceIntent = 'context' | 'required';

export interface PageInput {
  id: string;
  pageId: string;
  type: PageInputType;
  content: string;
  sourceIntent: PageSourceIntent;
  createdAt: string;
}

export interface AddPageInputInput {
  pageId: string;
  type: PageInputType;
  content: string;
  sourceIntent?: PageSourceIntent;
}

export interface PageAsset {
  id: string;
  pageId: string;
  filename: string;
  mimeType: string;
  size: number;
  family: MaterialFamily;
  storageUrl: string;
  cdnUrl: string | null;
  sourceContent?: string;
  sourceEncoding?: PageAssetSourceEncoding;
  sourceIntent: PageSourceIntent;
  uploadState: 'uploaded';
  createdAt: string;
}

export interface AddPageAssetInput {
  pageId: string;
  filename: string;
  mimeType: string;
  size: number;
  sourceContent?: string;
  sourceEncoding?: PageAssetSourceEncoding;
  sourceIntent?: PageSourceIntent;
}

export type PageDraftBlockType = 'hero' | 'text' | 'media';
export type PageDraftFontWeight = 'regular' | 'semibold' | 'bold';
export type PageDraftSize = 'compact' | 'standard' | 'large';
export type PageDraftSpacing = 'tight' | 'balanced' | 'airy';
export type PageDraftTextAlign = 'left' | 'center' | 'right';

export interface PageDraftBlockLayout {
  column: number;
  row: number;
  width: number;
  height?: number;
}

export interface PageDraftBlockVisual {
  backgroundColor: string;
  textColor: string;
  accentColor?: string;
  size: PageDraftSize;
  fontWeight?: PageDraftFontWeight;
  textAlign?: PageDraftTextAlign;
}

export interface PageDraftBlock {
  id: string;
  type: PageDraftBlockType;
  content: string;
  assetId?: string;
  href?: string;
  layout: PageDraftBlockLayout;
  visual: PageDraftBlockVisual;
}

export interface PageDraftLayoutSection {
  id: string;
  title?: string;
  blockIds: string[];
}

export interface PageDraftLayout {
  canvas: {
    maxWidth: number;
  };
  sections: PageDraftLayoutSection[];
}

export interface PageDraftVisual {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  spacing: PageDraftSpacing;
}

export interface PageDraftSeo {
  title: string;
  description: string;
  keywords: string[];
}

export interface PageDraftLocalization {
  title: string;
  seo?: PageDraftSeo;
  blocks: PageDraftBlock[];
  layout?: PageDraftLayout;
  visual?: PageDraftVisual;
}

export interface PageDraft {
  id: string;
  pageId: string;
  title: string;
  isDirty: boolean;
  blocks: PageDraftBlock[];
  layout: PageDraftLayout;
  visual: PageDraftVisual;
  seo?: PageDraftSeo;
  language?: string;
  localizations?: Record<string, PageDraftLocalization>;
  createdAt: string;
  updatedAt: string;
}

export interface SavePageDraftInput {
  id?: string;
  pageId: string;
  title: string;
  isDirty?: boolean;
  blocks: PageDraftBlock[];
  layout: PageDraftLayout;
  visual: PageDraftVisual;
  seo?: PageDraftSeo;
  language?: string;
  localizations?: Record<string, PageDraftLocalization>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublishedAssetReference {
  assetId: string;
  cdnUrl: string | null;
  filename: string;
  mimeType: string;
  sourceContent?: string;
  sourceEncoding?: PageAssetSourceEncoding;
  sourceIntent?: PageSourceIntent;
  storageUrl: string;
}

export interface PublishedVersion {
  id: string;
  pageId: string;
  versionNumber: number;
  title: string;
  contentSnapshot: PageDraftBlock[];
  layoutSnapshot: PageDraftLayout;
  visualSnapshot: PageDraftVisual;
  seo?: PageDraftSeo;
  language?: string;
  localizations?: Record<string, PageDraftLocalization>;
  assetManifest: PublishedAssetReference[];
  manifest: PublishableAssetManifest;
  cdnUrls: {
    content: string;
    media: string[];
    script: string;
  };
  embedUrl: string;
  createdAt: string;
  createdBy: string;
}

export interface PagePublication {
  pageId: string;
  activeVersionId: string;
  lastPublishedAt: string;
  status: 'publishing' | 'published' | 'failed';
}

export interface PublishableAssetManifest {
  pageId: string;
  versionId: string;
  versionNumber: number;
  rendererScriptUrl: string;
  content: {
    title: string;
    blocks: PageDraftBlock[];
    layout: PageDraftLayout;
    visual: PageDraftVisual;
    seo?: PageDraftSeo;
    language?: string;
    localizations?: Record<string, PageDraftLocalization>;
    mediaAssets: PublishedAssetReference[];
  };
  mediaAssets: PublishedAssetReference[];
  cache: {
    immutable: boolean;
    scope: 'version';
  };
}

export interface PublishDraftInput {
  pageId: string;
  createdBy: string;
}

export interface PageContext {
  pageId: string;
  assets: PageAsset[];
  draft: PageDraft | null;
  inputs: PageInput[];
  versions: PublishedVersion[];
  activePublication: PagePublication | null;
}

export interface PageContextService {
  addAsset(input: AddPageAssetInput): Promise<PageAsset>;
  addInput(input: AddPageInputInput): Promise<PageInput>;
  getActivePublishedVersion(pageId: string): Promise<PublishedVersion | null>;
  loadPageContext(pageId: string): Promise<PageContext>;
  publishDraft(input: PublishDraftInput): Promise<PublishedVersion>;
  saveDraft(input: SavePageDraftInput): Promise<PageDraft>;
}
