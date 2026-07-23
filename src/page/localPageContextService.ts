import type { PageContext, PageContextService } from './types';

export function createLocalPageContextService(): PageContextService {
  return {
    async loadPageContext(pageId: string): Promise<PageContext> {
      return {
        pageId,
        draft: null,
        inputs: [],
        versions: [],
        activePublication: null,
      };
    },
  };
}
