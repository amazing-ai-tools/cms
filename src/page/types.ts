export type PageInputType = 'idea' | 'description' | 'link' | 'upload';

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

export interface PageContext {
  pageId: string;
  draft: null;
  inputs: PageInput[];
  versions: unknown[];
  activePublication: null;
}

export interface PageContextService {
  addInput(input: AddPageInputInput): Promise<PageInput>;
  loadPageContext(pageId: string): Promise<PageContext>;
}
