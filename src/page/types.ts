export type PageInputType = 'idea' | 'description' | 'link' | 'upload';
export type MaterialFamily = 'image' | 'media' | 'pdf' | 'word';

export interface PageInput {
  id: string;
  pageId: string;
  type: PageInputType;
  content: string;
  createdAt: string;
}

export interface AddPageInputInput {
  pageId: string;
  type: PageInputType;
  content: string;
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
  uploadState: 'uploaded';
  createdAt: string;
}

export interface AddPageAssetInput {
  pageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export type PageDraftBlockType = 'hero' | 'text' | 'media';
export type PageDraftSize = 'compact' | 'standard' | 'large';
export type PageDraftSpacing = 'tight' | 'balanced' | 'airy';

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
}

export interface PageDraftBlock {
  id: string;
  type: PageDraftBlockType;
  content: string;
  assetId?: string;
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

export interface PageDraft {
  id: string;
  pageId: string;
  title: string;
  isDirty: boolean;
  blocks: PageDraftBlock[];
  layout: PageDraftLayout;
  visual: PageDraftVisual;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface PublishedAssetReference {
  assetId: string;
  cdnUrl: string | null;
  filename: string;
  mimeType: string;
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
  assetManifest: PublishedAssetReference[];
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
