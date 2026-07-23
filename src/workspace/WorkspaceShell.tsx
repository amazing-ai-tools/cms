import React from 'react';
import { AlertCircle, FileText, FolderTree, MessageSquareText, Plus, Sparkles } from 'lucide-react';
import type { ContentNode, ContentNodeType, ContentService } from '../content/types';
import type { GenerationJob, GenerationService } from '../generation/types';
import { PageDraftPreview } from '../page/PageDraftPreview';
import type { PageContext, PageContextService, PageInputType } from '../page/types';
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

export function WorkspaceShell({
  contentService,
  generationService,
  pageContextService,
  workspace,
}: WorkspaceShellProps) {
  const [nodes, setNodes] = React.useState<ContentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [pageContext, setPageContext] = React.useState<PageContext | null>(null);
  const [inputType, setInputType] = React.useState<PageInputType>('idea');
  const [inputText, setInputText] = React.useState('');
  const [linkText, setLinkText] = React.useState('');
  const [linkError, setLinkError] = React.useState('');
  const [uploadError, setUploadError] = React.useState('');
  const [generationJob, setGenerationJob] = React.useState<GenerationJob | null>(null);
  const [error, setError] = React.useState('');
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const isGenerating = generationJob?.status === 'queued' || generationJob?.status === 'running';
  const selectionStorageKey = `assisted-cms.selected-node.${workspace.id}`;

  function handleSelectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setGenerationJob(null);
    window.localStorage.setItem(selectionStorageKey, nodeId);
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
    if (selectedNode?.type !== 'page') {
      setPageContext(null);
      return;
    }

    let isMounted = true;
    pageContextService.loadPageContext(selectedNode.id).then((loadedContext) => {
      if (isMounted) {
        setPageContext(loadedContext);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pageContextService, selectedNode]);

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

  async function handleAddInput() {
    if (selectedNode?.type !== 'page' || !inputText.trim()) {
      return;
    }

    await pageContextService.addInput({
      pageId: selectedNode.id,
      type: inputType,
      content: inputText,
    });
    setPageContext(await pageContextService.loadPageContext(selectedNode.id));
    setInputText('');
  }

  async function handleGenerate() {
    if (selectedNode?.type !== 'page') {
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

  async function handleAddLink() {
    if (selectedNode?.type !== 'page') {
      return;
    }

    try {
      setLinkError('');
      const normalizedUrl = normalizeUrl(linkText);
      await pageContextService.addInput({
        pageId: selectedNode.id,
        type: 'link',
        content: normalizedUrl,
      });
      setPageContext(await pageContextService.loadPageContext(selectedNode.id));
      setLinkText('');
    } catch {
      setLinkError('Enter a valid URL.');
    }
  }

  async function handleUploadMaterials(files: FileList | null) {
    if (selectedNode?.type !== 'page' || !files) {
      return;
    }

    setUploadError('');

    try {
      for (const file of Array.from(files)) {
        await pageContextService.addAsset({
          pageId: selectedNode.id,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
      setPageContext(await pageContextService.loadPageContext(selectedNode.id));
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error ? uploadFailure.message : 'Material upload failed.',
      );
    }
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
            Create category
          </button>
          {selectedNode?.type === 'category' ? (
            <>
              <button
                className="button secondary icon-label neutral"
                type="button"
                onClick={() => handleCreate('subcategory', selectedNode.id)}
              >
                <Plus size={16} />
                Create subcategory
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
          {selectedNode?.type === 'subcategory' ? (
            <button
              className="button secondary icon-label neutral"
              type="button"
              onClick={() => handleCreate('page', selectedNode.id)}
            >
              <Plus size={16} />
              Create page
            </button>
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
      </section>

      <section className="workspace-panel preview-panel" aria-labelledby="page-preview-title" role="region">
        <div className="panel-heading panel-heading-split">
          <div>
            <span className="eyebrow">Selected page</span>
            <h2 id="page-preview-title">Page preview</h2>
          </div>
          <button
            className="button icon-label"
            type="button"
            disabled={selectedNode?.type !== 'page' || isGenerating}
            onClick={handleGenerate}
          >
            <Sparkles size={16} />
            {isGenerating ? 'Generating' : 'Generate'}
          </button>
        </div>
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
        {selectedNode?.type === 'page' && pageContext?.draft ? (
          <PageDraftPreview assets={pageContext.assets} draft={pageContext.draft} />
        ) : (
          <div className="preview-empty">
            <FileText size={26} />
            <strong>
              {selectedNode
                ? `${selectedNode.type === 'page' ? 'Selected page' : 'Selected node'}: ${
                    selectedNode.title
                  }`
                : 'No page selected'}
            </strong>
            <p>
              {selectedNode?.type === 'page'
                ? 'Draft preview will load here as page content is generated.'
                : 'Select a page to preview draft content and run generation.'}
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
          {selectedNode?.type === 'page' ? (
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
                <li>Draft: {pageContext?.draft ? 'generated' : 'not generated'}</li>
                <li>Versions: {pageContext?.versions.length ?? 0}</li>
                <li>Active version: {pageContext?.activePublication ? 'published' : 'none'}</li>
              </ul>
              {uploadError ? (
                <div className="auth-error compact" role="alert">
                  {uploadError}
                </div>
              ) : null}
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
        <fieldset className="link-composer" disabled={selectedNode?.type !== 'page'}>
          <label htmlFor="reference-link">Reference link</label>
          <div className="inline-form">
            <input
              id="reference-link"
              placeholder="https://example.com/source"
              type="url"
              value={linkText}
              onChange={(event) => setLinkText(event.target.value)}
            />
            <button
              className="button secondary"
              type="button"
              disabled={selectedNode?.type !== 'page' || !linkText.trim()}
              onClick={handleAddLink}
            >
              Add link
            </button>
          </div>
          {linkError ? (
            <div className="auth-error compact" role="alert">
              {linkError}
            </div>
          ) : null}
        </fieldset>
        <fieldset className="upload-composer" disabled={selectedNode?.type !== 'page'}>
          <label htmlFor="material-upload">Upload page materials</label>
          <input
            id="material-upload"
            multiple
            type="file"
            onChange={(event) => handleUploadMaterials(event.target.files)}
          />
        </fieldset>
        <fieldset className="chat-composer" disabled={selectedNode?.type !== 'page'}>
          <div className="segmented-control" aria-label="Input type">
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
          <label htmlFor="idea-input">Idea or content description</label>
          <textarea
            id="idea-input"
            placeholder={
              selectedNode?.type === 'page'
                ? 'Add page-specific context'
                : 'Select a page before adding inputs'
            }
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
          />
          <button
            className="button secondary"
            type="button"
            disabled={selectedNode?.type !== 'page' || !inputText.trim()}
            onClick={handleAddInput}
          >
            Add input
          </button>
        </fieldset>
      </section>
    </div>
  );
}
