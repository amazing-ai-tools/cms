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

  test('supports cascading categories that can also hold page context', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-cascading-categories' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Brand sites',
    });
    const childCategory = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'category',
      title: 'Campaigns',
    });
    const grandchildCategory = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: childCategory.id,
      type: 'category',
      title: 'Launch pages',
    });
    const page = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: grandchildCategory.id,
      type: 'page',
      title: 'Homepage hero',
    });

    expect(await contentService.listNodes('workspace-1')).toEqual([
      category,
      childCategory,
      grandchildCategory,
      page,
    ]);
  });

  test('stores and updates category names and slugs', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-category-slugs' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Brand Sites',
      slug: 'brand-sites',
    });

    expect(category).toMatchObject({
      slug: 'brand-sites',
      title: 'Brand Sites',
    });

    const updatedCategory = await contentService.updateNode(category.id, {
      slug: 'campaign-sites',
      title: 'Campaign Sites',
    });

    expect(updatedCategory).toMatchObject({
      id: category.id,
      slug: 'campaign-sites',
      title: 'Campaign Sites',
    });
    expect(await contentService.listNodes('workspace-1')).toEqual([updatedCategory]);
  });

  test('stores and updates page names and slugs', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-page-slugs' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Brand Sites',
    });
    const page = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'page',
      title: 'Homepage Hero',
      slug: 'homepage-hero',
    });

    expect(page).toMatchObject({
      slug: 'homepage-hero',
      title: 'Homepage Hero',
    });

    const updatedPage = await contentService.updateNode(page.id, {
      slug: 'campaign-landing',
      title: 'Campaign Landing',
    });

    expect(updatedPage).toMatchObject({
      id: page.id,
      slug: 'campaign-landing',
      title: 'Campaign Landing',
    });
    expect(await contentService.listNodes('workspace-1')).toEqual([category, updatedPage]);
  });

  test('deletes empty categories and blocks categories that still have children', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-category-delete' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Root',
    });
    const childCategory = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'category',
      title: 'Child',
    });

    await expect(contentService.deleteNode(category.id)).rejects.toThrow(/child items/i);

    await contentService.deleteNode(childCategory.id);
    expect(await contentService.listNodes('workspace-1')).toEqual([category]);

    await contentService.deleteNode(category.id);
    expect(await contentService.listNodes('workspace-1')).toEqual([]);
  });

  test('deletes empty pages and blocks pages that still have children', async () => {
    const contentService = createLocalContentService({ storageKey: 'hierarchy-page-delete' });
    const category = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: null,
      type: 'category',
      title: 'Root',
    });
    const page = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: category.id,
      type: 'page',
      title: 'Parent page',
    });
    const childPage = await contentService.createNode({
      workspaceId: 'workspace-1',
      parentId: page.id,
      type: 'page',
      title: 'Child page',
    });

    await expect(contentService.deleteNode(page.id)).rejects.toThrow(/this item/i);

    await contentService.deleteNode(childPage.id);
    expect(await contentService.listNodes('workspace-1')).toEqual([category, page]);

    await contentService.deleteNode(page.id);
    expect(await contentService.listNodes('workspace-1')).toEqual([category]);
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
        type: 'subcategory',
        title: 'Nested subcategory',
      }),
    ).resolves.toMatchObject({
      parentId: category.id,
      type: 'subcategory',
    });
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
