import React from 'react';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  FolderTree,
  MessageSquareText,
  Paperclip,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { ContentNode, ContentNodeType, ContentService } from '../content/types';
import { buildEmbedSnippet } from '../embed/embedScript';
import type { GenerationJob, GenerationService } from '../generation/types';
import { PageDraftEditor } from '../page/PageDraftEditor';
import { PageDraftPreview } from '../page/PageDraftPreview';
import type {
  PageContext,
  PageContextService,
  PageDraft,
  PageInputType,
  PublishedVersion,
} from '../page/types';
import { normalizeUrl } from '../page/url';
import type { Workspace } from './types';

interface WorkspaceShellProps {
  contentService: ContentService;
  generationService: GenerationService;
  pageContextService: PageContextService;
  workspace: Workspace;
}

function defaultTitleFor(type: ContentNodeType, nodes: ContentNode[], parent: ContentNode | null) {
  if (type === 'category') {
    return `Category ${nodes.filter((node) => node.type === 'category').length + 1}`;
  }

  if (type === 'subcategory') {
    return `Subcategory ${nodes.filter((node) => node.type === 'subcategory').length + 1}`;
  }

  if (parent?.type === 'page') {
    return `Child page ${
      nodes.filter((node) => node.type === 'page' && node.parentId === parent.id).length + 1
    }`;
  }

  return `Page ${nodes.filter((node) => node.type === 'page').length + 1}`;
}

function isPageCapableNode(node: ContentNode | null): node is ContentNode {
  return Boolean(node);
}

function canCreateChildCategory(
  node: ContentNode | null,
): node is ContentNode & { type: 'category' | 'subcategory' } {
  return node?.type === 'category' || node?.type === 'subcategory';
}

function slugForCategoryTitle(title: string) {
  return (
    title
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'category'
  );
}

function childNodesFor(nodes: ContentNode[], parentId: string | null) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((first, second) => first.sortOrder - second.sortOrder);
}

function TreeNodes({
  nodes,
  parentId,
  selectedNodeId,
  onSelect,
}: {
  nodes: ContentNode[];
  parentId: string | null;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const children = childNodesFor(nodes, parentId);
  if (children.length === 0) {
    return null;
  }

  return (
    <ul className={parentId ? 'content-tree nested' : 'content-tree'}>
      {children.map((node) => (
        <li key={node.id}>
          <button
            aria-label={`${node.title} ${node.type}`}
            aria-current={selectedNodeId === node.id ? 'true' : undefined}
            className="tree-node-button"
            type="button"
            onClick={() => onSelect(node.id)}
          >
            <span>{node.title}</span>
            <small>{node.type}</small>
          </button>
          <TreeNodes
            nodes={nodes}
            parentId={node.id}
            selectedNodeId={selectedNodeId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

function hierarchyPathFor(nodes: ContentNode[], node: ContentNode) {
  const path: string[] = [];
  let currentNode: ContentNode | undefined = node;

  while (currentNode) {
    path.unshift(currentNode.title);
    currentNode = currentNode.parentId
      ? nodes.find((candidate) => candidate.id === currentNode?.parentId)
      : undefined;
  }

  return path;
}

function generationStatusLabel(job: GenerationJob) {
  if (job.status === 'failed') {
    return 'Generation failed';
  }

  if (job.status === 'succeeded') {
    return 'Generation succeeded';
  }

  return 'Generation running';
}

function draftStateLabel(pageContext: PageContext | null) {
  if (!pageContext?.draft) {
    return 'not generated';
  }

  return pageContext.draft.isDirty ? 'unpublished changes' : 'up to date';
}

function draftForVersion(version: PublishedVersion): PageDraft {
  return {
    id: `version-draft-${version.id}`,
    pageId: version.pageId,
    title: version.title,
    isDirty: false,
    blocks: version.contentSnapshot,
    layout: version.layoutSnapshot,
    visual: version.visualSnapshot,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
  };
}

const referenceUrlPattern =
  /\b(?:https?:\/\/[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?)/gi;

function trimUrlPunctuation(url: string) {
  return url.replace(/[),.;!?]+$/g, '');
}

function referenceLinksFor(text: string) {
  const rawUrls = text.match(referenceUrlPattern) ?? [];
  const normalizedUrls = rawUrls.map((url) => normalizeUrl(trimUrlPunctuation(url)));
  return Array.from(new Set(normalizedUrls));
}

export function WorkspaceShell({
  contentService,
  generationService,
  pageContextService,
  workspace,
}: WorkspaceShellProps) {
  const [nodes, setNodes] = React.useState<ContentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [pageContext, setPageContext] = React.useState<PageContext | null>(null);
  const [inputType, setInputType] = React.useState<PageInputType>('instruction');
  const [inputText, setInputText] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [composerError, setComposerError] = React.useState('');
  const [generationJob, setGenerationJob] = React.useState<GenerationJob | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState('');
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [categoryForm, setCategoryForm] = React.useState({ title: '', slug: '' });
  const [isSavingCategory, setIsSavingCategory] = React.useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedCategory = canCreateChildCategory(selectedNode) ? selectedNode : null;
  const selectedCategoryHasChildren = selectedCategory
    ? nodes.some((node) => node.parentId === selectedCategory.id)
    : false;
  const categoryFormIsValid = Boolean(categoryForm.title.trim() && categoryForm.slug.trim());
  const categoryNameInputId = selectedCategory ? `category-name-${selectedCategory.id}` : 'category-name';
  const categorySlugInputId = selectedCategory ? `category-slug-${selectedCategory.id}` : 'category-slug';
  const selectedVersion =
    pageContext?.versions.find((version) => version.id === selectedVersionId) ?? null;
  const activeVersion =
    pageContext?.activePublication?.status === 'published'
      ? pageContext.versions.find(
          (version) => version.id === pageContext.activePublication?.activeVersionId,
        ) ?? null
      : null;
  const previewDraft = selectedVersion
    ? draftForVersion(selectedVersion)
    : pageContext?.draft ?? null;
  const isGenerating = generationJob?.status === 'queued' || generationJob?.status === 'running';
  const selectionStorageKey = `assisted-cms.selected-node.${workspace.id}`;

  function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setGenerationJob(null);
    setError('');
    setPublishError('');
    setSelectedVersionId(null);
    setComposerError('');
    setPendingFiles([]);
    setInputText('');
    window.localStorage.setItem(selectionStorageKey, nodeId);
  }

  function clearSelection() {
    setSelectedNodeId(null);
    setGenerationJob(null);
    setError('');
    setPublishError('');
    setSelectedVersionId(null);
    setComposerError('');
    setPendingFiles([]);
    setInputText('');
    window.localStorage.removeItem(selectionStorageKey);
  }

  React.useEffect(() => {
    let isMounted = true;

    contentService.listNodes(workspace.id).then((loadedNodes) => {
      if (isMounted) {
        setNodes(loadedNodes);
        const storedSelection = window.localStorage.getItem(selectionStorageKey);
        if (storedSelection && loadedNodes.some((node) => node.id === storedSelection)) {
          setSelectedNodeId(storedSelection);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [contentService, selectionStorageKey, workspace.id]);

  React.useEffect(() => {
    if (!selectedCategory) {
      setCategoryForm({ title: '', slug: '' });
      return;
    }

    setCategoryForm({
      title: selectedCategory.title,
      slug: selectedCategory.slug ?? slugForCategoryTitle(selectedCategory.title),
    });
  }, [selectedCategory?.id, selectedCategory?.slug, selectedCategory?.title]);

  React.useEffect(() => {
    if (!isPageCapableNode(selectedNode)) {
      setPageContext(null);
      return;
    }

    let isMounted = true;
    pageContextService.loadPageContext(selectedNode.id).then((loadedContext) => {
      if (isMounted) {
        setPageContext(loadedContext);
        if (
          selectedVersionId &&
          !loadedContext.versions.some((version) => version.id === selectedVersionId)
        ) {
          setSelectedVersionId(null);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pageContextService, selectedNode, selectedVersionId]);

  async function handleCreate(type: ContentNodeType, parentId: string | null) {
    const parent = parentId ? nodes.find((node) => node.id === parentId) ?? null : null;

    try {
      setError('');
      const node = await contentService.createNode({
        workspaceId: workspace.id,
        parentId,
        type,
        title: defaultTitleFor(type, nodes, parent),
      });
      setNodes(await contentService.listNodes(workspace.id));
      handleSelectNode(node.id);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'Content node could not be created.',
      );
    }
  }

  async function handleSaveCategory() {
    if (!selectedCategory || !categoryFormIsValid) {
      return;
    }

    try {
      setIsSavingCategory(true);
      setError('');
      const updatedCategory = await contentService.updateNode(selectedCategory.id, {
        slug: categoryForm.slug,
        title: categoryForm.title,
      });
      setNodes(await contentService.listNodes(workspace.id));
      setSelectedNodeId(updatedCategory.id);
      window.localStorage.setItem(selectionStorageKey, updatedCategory.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Category could not be saved.');
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!selectedCategory || selectedCategoryHasChildren) {
      return;
    }

    try {
      setIsDeletingCategory(true);
      setError('');
      const nextSelectedNodeId = selectedCategory.parentId;
      await contentService.deleteNode(selectedCategory.id);
      const loadedNodes = await contentService.listNodes(workspace.id);
      setNodes(loadedNodes);

      if (nextSelectedNodeId && loadedNodes.some((node) => node.id === nextSelectedNodeId)) {
        handleSelectNode(nextSelectedNodeId);
      } else {
        clearSelection();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Category could not be deleted.');
    } finally {
      setIsDeletingCategory(false);
    }
  }

  function handleSelectMaterials(files: FileList | null) {
    setPendingFiles(files ? Array.from(files) : []);
    setComposerError('');
  }

  async function handleSendInput() {
    if (!isPageCapableNode(selectedNode) || (!inputText.trim() && pendingFiles.length === 0)) {
      return;
    }

    try {
      setComposerError('');
      const links = referenceLinksFor(inputText);

      if (inputText.trim()) {
        await pageContextService.addInput({
          pageId: selectedNode.id,
          type: inputType,
          content: inputText,
        });
      }

      for (const link of links) {
        await pageContextService.addInput({
          pageId: selectedNode.id,
          type: 'link',
          content: link,
        });
      }

      for (const file of pendingFiles) {
        await pageContextService.addAsset({
          pageId: selectedNode.id,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }

      setPageContext(await pageContextService.loadPageContext(selectedNode.id));
      setInputText('');
      setPendingFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (sendFailure) {
      setComposerError(
        sendFailure instanceof Error ? sendFailure.message : 'Page input could not be sent.',
      );
    }
  }

  async function handleGenerate() {
    if (!isPageCapableNode(selectedNode)) {
      return;
    }

    const runningJob: GenerationJob = {
      id: `pending-${selectedNode.id}`,
      pageId: selectedNode.id,
      status: 'running',
      steps: ['Collecting page inputs', 'Preparing draft request'],
    };
    setGenerationJob(runningJob);

    try {
      const selectedPageContext =
        pageContext ?? (await pageContextService.loadPageContext(selectedNode.id));
      const result = await generationService.generateDraft({
        hierarchyPath: hierarchyPathFor(nodes, selectedNode),
        pageContext: selectedPageContext,
        pageId: selectedNode.id,
        pageTitle: selectedNode.title,
      });

      if (result.job.status === 'succeeded' && result.draft) {
        await pageContextService.saveDraft(result.draft);
        setPageContext(await pageContextService.loadPageContext(selectedNode.id));
        setSelectedVersionId(null);
      }

      setGenerationJob(result.job);
    } catch (generationError) {
      setGenerationJob({
        ...runningJob,
        error:
          generationError instanceof Error ? generationError.message : 'Generation failed to complete.',
        status: 'failed',
        steps: [...runningJob.steps, 'Generation failed'],
      });
    }
  }

  async function handleDraftChange(nextDraft: PageDraft) {
    if (!isPageCapableNode(selectedNode)) {
      return;
    }

    const dirtyDraft = {
      ...nextDraft,
      isDirty: true,
    };

    setError('');
    setSelectedVersionId(null);
    setPageContext((currentContext) =>
      currentContext
        ? {
            ...currentContext,
            draft: dirtyDraft,
          }
        : currentContext,
    );

    try {
      await pageContextService.saveDraft(dirtyDraft);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Draft changes could not be saved.');
      setPageContext(await pageContextService.loadPageContext(selectedNode.id));
    }
  }

  async function handlePublishDraft() {
    if (!isPageCapableNode(selectedNode) || !pageContext?.draft) {
      return;
    }

    setIsPublishing(true);
    setPublishError('');

    try {
      await pageContextService.publishDraft({
        createdBy: workspace.ownerUserId,
        pageId: selectedNode.id,
      });
      setPageContext(await pageContextService.loadPageContext(selectedNode.id));
      setSelectedVersionId(null);
    } catch (publishFailure) {
      setPublishError(
        publishFailure instanceof Error ? publishFailure.message : 'Draft could not be published.',
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function handleOpenDraftPreview() {
    if (!isPageCapableNode(selectedNode) || !pageContext?.draft || selectedVersion) {
      return;
    }

    window.open(`/preview/${encodeURIComponent(selectedNode.id)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="cms-grid" data-workspace-id={workspace.id}>
      <section
        className="workspace-panel hierarchy-panel"
        aria-labelledby="content-hierarchy-title"
        role="region"
      >
        <div className="panel-heading">
          <FolderTree size={18} />
          <h2 id="content-hierarchy-title">Content hierarchy</h2>
        </div>
        {error ? (
          <div className="auth-error compact" role="alert">
            {error}
          </div>
        ) : null}
        {nodes.length === 0 ? (
          <div className="empty-state">
            <strong>No categories yet</strong>
            <p>Create a category to start organizing pages.</p>
          </div>
        ) : (
          <TreeNodes
            nodes={nodes}
            parentId={null}
            selectedNodeId={selectedNodeId}
            onSelect={handleSelectNode}
          />
        )}
        <div className="hierarchy-actions" aria-label="Hierarchy creation actions">
          <button
            className="button secondary icon-label neutral"
            type="button"
            onClick={() => handleCreate('category', null)}
          >
            <Plus size={16} />
            Create root category
          </button>
          {canCreateChildCategory(selectedNode) ? (
            <>
              <button
                className="button secondary icon-label neutral"
                type="button"
                onClick={() => handleCreate('category', selectedNode.id)}
              >
                <Plus size={16} />
                Create child category
              </button>
              <button
                className="button secondary icon-label neutral"
                type="button"
                onClick={() => handleCreate('page', selectedNode.id)}
              >
                <Plus size={16} />
                Create page
              </button>
            </>
          ) : null}
          {selectedNode?.type === 'page' ? (
            <button
              className="button secondary icon-label neutral"
              type="button"
              onClick={() => handleCreate('page', selectedNode.id)}
            >
              <Plus size={16} />
              Create child page
            </button>
          ) : null}
        </div>
        {selectedCategory ? (
          <form
            aria-label="Category settings"
            className="category-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCategory();
            }}
          >
            <div className="category-settings-heading">
              <strong>Category settings</strong>
              <small>{selectedCategory.slug ?? slugForCategoryTitle(selectedCategory.title)}</small>
            </div>
            <label htmlFor={categoryNameInputId}>
              Category name
              <input
                id={categoryNameInputId}
                type="text"
                value={categoryForm.title}
                onChange={(event) =>
                  setCategoryForm((currentForm) => ({
                    ...currentForm,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label htmlFor={categorySlugInputId}>
              Category slug
              <input
                id={categorySlugInputId}
                type="text"
                value={categoryForm.slug}
                onChange={(event) =>
                  setCategoryForm((currentForm) => ({
                    ...currentForm,
                    slug: event.target.value,
                  }))
                }
              />
            </label>
            <div className="category-settings-actions">
              <button
                className="button icon-label"
                type="submit"
                disabled={!categoryFormIsValid || isSavingCategory}
              >
                <Save size={16} />
                {isSavingCategory ? 'Saving' : 'Save category'}
              </button>
              <button
                className="button secondary icon-label danger"
                type="button"
                disabled={selectedCategoryHasChildren || isDeletingCategory}
                onClick={handleDeleteCategory}
              >
                <Trash2 size={16} />
                {isDeletingCategory ? 'Deleting' : 'Delete category'}
              </button>
            </div>
            {selectedCategoryHasChildren ? (
              <p className="category-delete-note">Delete child items before deleting this category.</p>
            ) : null}
          </form>
        ) : null}
      </section>

      <section className="workspace-panel preview-panel" aria-labelledby="page-preview-title" role="region">
        <div className="panel-heading panel-heading-split">
          <div>
            <span className="eyebrow">Selected page</span>
            <h2 id="page-preview-title">Page preview</h2>
          </div>
          <div className="preview-actions">
            <button
              className="button secondary icon-label neutral"
              type="button"
              disabled={!isPageCapableNode(selectedNode) || !pageContext?.draft || Boolean(selectedVersion)}
              onClick={handleOpenDraftPreview}
            >
              <ExternalLink size={16} />
              Open draft preview
            </button>
            <button
              className="button icon-label"
              type="button"
              disabled={!isPageCapableNode(selectedNode) || isGenerating}
              onClick={handleGenerate}
            >
              <Sparkles size={16} />
              {isGenerating ? 'Generating' : 'Generate'}
            </button>
            <button
              className="button secondary icon-label neutral"
              type="button"
              disabled={
                !isPageCapableNode(selectedNode) || !pageContext?.draft || Boolean(selectedVersion) || isPublishing
              }
              onClick={handlePublishDraft}
            >
              <UploadCloud size={16} />
              {isPublishing ? 'Publishing' : 'Publish draft'}
            </button>
          </div>
        </div>
        {publishError ? (
          <div className="auth-error compact" role="alert">
            {publishError}
          </div>
        ) : null}
        {generationJob ? (
          <div className={`generation-status ${generationJob.status}`} aria-live="polite">
            <strong>{generationStatusLabel(generationJob)}</strong>
            {generationJob.status === 'failed' ? (
              <div className="auth-error compact" role="alert">
                <AlertCircle size={16} />
                <span>{generationJob.error ?? 'Generation failed.'}</span>
              </div>
            ) : null}
            {generationJob.steps.length ? (
              <ol>
                {generationJob.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
        {isPageCapableNode(selectedNode) && pageContext?.versions.length ? (
          <div className="version-navigator" aria-label="Published versions">
            <strong>Published versions</strong>
            <div className="version-list">
              {pageContext.versions.map((version) => {
                const isActive =
                  pageContext.activePublication?.activeVersionId === version.id &&
                  pageContext.activePublication.status === 'published';
                return (
                  <div className="version-row" key={version.id}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setSelectedVersionId(version.id)}
                    >
                      Open version {version.versionNumber}
                    </button>
                    {isActive ? <span>Version {version.versionNumber} active</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {selectedVersion ? (
          <div className="version-view-banner" aria-live="polite">
            <span>Viewing version {selectedVersion.versionNumber}</span>
            <button className="button secondary" type="button" onClick={() => setSelectedVersionId(null)}>
              Return to draft
            </button>
          </div>
        ) : null}
        {isPageCapableNode(selectedNode) && previewDraft ? (
          <>
            <PageDraftPreview assets={pageContext?.assets ?? []} draft={previewDraft} />
            {selectedVersion ? null : (
              <PageDraftEditor draft={previewDraft} onDraftChange={handleDraftChange} />
            )}
          </>
        ) : (
          <div className="preview-empty">
            <FileText size={26} />
            <strong>
              {selectedNode
                ? `Selected page: ${selectedNode.title}`
                : 'No page selected'}
            </strong>
            <p>
              {isPageCapableNode(selectedNode)
                ? 'Draft preview will load here as page content is generated.'
                : 'Select a tree item to preview draft content and run generation.'}
            </p>
          </div>
        )}
      </section>

      <section className="workspace-panel inputs-panel" aria-labelledby="page-inputs-title" role="region">
        <div className="panel-heading">
          <MessageSquareText size={18} />
          <h2 id="page-inputs-title">Page inputs</h2>
        </div>
        <div className="chat-empty">
          {isPageCapableNode(selectedNode) ? (
            <>
              <strong>Inputs for {selectedNode.title}</strong>
              {pageContext?.inputs.length ? (
                <div className="input-feed" aria-label={`Saved inputs for ${selectedNode.title}`}>
                  {pageContext.inputs.map((input) => (
                    <article className="input-entry" key={input.id}>
                      <small>{input.type}</small>
                      <p>{input.content}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No inputs have been added to this page.</p>
              )}
              <ul className="context-list">
                <li>Draft: {draftStateLabel(pageContext)}</li>
                <li>Versions: {pageContext?.versions.length ?? 0}</li>
                <li>Active version: {pageContext?.activePublication ? 'published' : 'none'}</li>
              </ul>
              <div className="embed-snippet-panel">
                <strong>Embed</strong>
                {activeVersion ? (
                  <textarea
                    aria-label="Embed script"
                    readOnly
                    value={buildEmbedSnippet(activeVersion)}
                  />
                ) : (
                  <p>Publish this page before embedding.</p>
                )}
              </div>
              {pageContext?.assets.length ? (
                <div className="asset-list" aria-label={`Uploaded materials for ${selectedNode.title}`}>
                  {pageContext.assets.map((asset) => (
                    <article className="asset-entry" key={asset.id}>
                      <strong>{asset.filename}</strong>
                      <span>{asset.family}</span>
                      <small>{asset.uploadState}</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <strong>Inputs are page-specific</strong>
              <p>Select a page to collect inputs.</p>
            </>
          )}
        </div>
        <fieldset className="chat-composer" disabled={!isPageCapableNode(selectedNode)}>
          <div className="segmented-control" aria-label="Input type">
            <button
              aria-pressed={inputType === 'instruction'}
              type="button"
              onClick={() => setInputType('instruction')}
            >
              Instruction
            </button>
            <button
              aria-pressed={inputType === 'idea'}
              type="button"
              onClick={() => setInputType('idea')}
            >
              Idea
            </button>
            <button
              aria-pressed={inputType === 'description'}
              type="button"
              onClick={() => setInputType('description')}
            >
              Description
            </button>
          </div>
          <label htmlFor="idea-input">Message the page AI</label>
          <textarea
            id="idea-input"
            placeholder={
              isPageCapableNode(selectedNode)
                ? 'Send instructions, paste reference links, and attach materials'
                : 'Select a tree item before adding inputs'
            }
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
          />
          <label className="material-attachment" htmlFor="material-upload">
            <Paperclip size={16} />
            Attach materials
            <input
              id="material-upload"
              multiple
              ref={fileInputRef}
              type="file"
              onChange={(event) => handleSelectMaterials(event.target.files)}
            />
          </label>
          {pendingFiles.length ? (
            <div className="pending-materials" aria-label="Materials ready to send">
              {pendingFiles.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          ) : null}
          {composerError ? (
            <div className="auth-error compact" role="alert">
              {composerError}
            </div>
          ) : null}
          <button
            className="button secondary icon-label neutral"
            type="button"
            disabled={
              !isPageCapableNode(selectedNode) || (!inputText.trim() && pendingFiles.length === 0)
            }
            onClick={handleSendInput}
          >
            <Send size={16} />
            Send
          </button>
        </fieldset>
      </section>
    </div>
  );
}
