import React from 'react';
import { FileText, FolderTree, MessageSquareText, Plus, Sparkles } from 'lucide-react';
import type { ContentNode, ContentNodeType, ContentService } from '../content/types';
import type { Workspace } from './types';

interface WorkspaceShellProps {
  contentService: ContentService;
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

export function WorkspaceShell({ contentService, workspace }: WorkspaceShellProps) {
  const [nodes, setNodes] = React.useState<ContentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  React.useEffect(() => {
    let isMounted = true;

    contentService.listNodes(workspace.id).then((loadedNodes) => {
      if (isMounted) {
        setNodes(loadedNodes);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [contentService, workspace.id]);

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
      setSelectedNodeId(node.id);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : 'Content node could not be created.',
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
            onSelect={setSelectedNodeId}
          />
        )}
        <div className="hierarchy-actions" aria-label="Hierarchy creation actions">
          <button className="button secondary icon-label neutral" type="button" onClick={() => handleCreate('category', null)}>
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
          <button className="button icon-label" type="button" disabled>
            <Sparkles size={16} />
            Generate
          </button>
        </div>
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
      </section>

      <section className="workspace-panel inputs-panel" aria-labelledby="page-inputs-title" role="region">
        <div className="panel-heading">
          <MessageSquareText size={18} />
          <h2 id="page-inputs-title">Page inputs</h2>
        </div>
        <div className="chat-empty">
          <strong>Inputs are page-specific</strong>
          <p>Select a page to collect inputs.</p>
        </div>
        <fieldset className="chat-composer" disabled>
          <label htmlFor="idea-input">Idea or content description</label>
          <textarea id="idea-input" placeholder="Select a page before adding inputs" />
          <button className="button secondary" type="button">
            Add input
          </button>
        </fieldset>
      </section>
    </div>
  );
}
