import { describe, expect, test } from 'vitest';
import { createLocalContentService } from './localContentService';

describe('content hierarchy data model', () => {
  test('supports categories, subcategories, pages, and nested pages', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-supported' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Brand sites',
    });
    const subcategory = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'subcategory',
      title: 'Launches',
    });
    const categoryPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'page',
      title: 'Homepage hero',
    });
    const subcategoryPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: subcategory.id,
      type: 'page',
      title: 'Product explainer',
    });
    const childPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: categoryPage.id,
      type: 'page',
      title: 'Hero FAQ',
    });

    expect(await contentService.listNodes('workspace-1')).toEqual([
      category,
      subcategory,
      categoryPage,
      subcategoryPage,
      childPage,
    ]);
  });

  test('rejects invalid parent-child relationships', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-invalid' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Root',
    });

    await expect(
      contentService.createNode({
        workspaceId: 'workspace-1',
        parentId: null,
        type: 'page',
        title: 'Root page',
      }),
    ).rejects.toThrow(/pages must be created inside/i);
    await expect(
      contentService.createNode({
        workspaceId: 'workspace-1',
        parentId: null,
        type: 'subcategory',
        title: 'Root subcategory',
      }),
    ).rejects.toThrow(/subcategories must be created under a category/i);
    await expect(
      contentService.createNode({
        workspaceId: 'workspace-1',
        parentId: category.id,
        type: 'category',
        title: 'Nested category',
      }),
    ).rejects.toThrow(/categories must be created at the workspace root/i);
  });

  test('prevents moves that would create hierarchy cycles', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-cycles' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Root',
    });
    const parentPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'page',
      title: 'Parent',
    });
    const childPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: parentPage.id,
      type: 'page',
      title: 'Child',
    });

    await expect(contentService.moveNode(parentPage.id, childPage.id)).rejects.toThrow(
      /cannot move a node inside its own descendant/i,
    );
  });
});
