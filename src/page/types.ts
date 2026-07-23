export interface PageContext {
  pageId: string;
  draft: null;
  inputs: [];
  versions: [];
  activePublication: null;
}

export interface PageContextService {
  loadPageContext(pageId: string): Promise<PageContext>;
}
