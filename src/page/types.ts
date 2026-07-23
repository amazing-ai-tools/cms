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

export interface PageDraft {
  id: string;
  pageId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePageDraftInput {
  id?: string;
  pageId: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageContext {
  pageId: string;
  assets: PageAsset[];
  draft: PageDraft | null;
  inputs: PageInput[];
  versions: unknown[];
  activePublication: null;
}

export interface PageContextService {
  addAsset(input: AddPageAssetInput): Promise<PageAsset>;
  addInput(input: AddPageInputInput): Promise<PageInput>;
  loadPageContext(pageId: string): Promise<PageContext>;
  saveDraft(input: SavePageDraftInput): Promise<PageDraft>;
}
