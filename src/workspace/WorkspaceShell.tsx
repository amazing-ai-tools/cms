import { FileText, FolderTree, MessageSquareText, Sparkles } from 'lucide-react';
import type { Workspace } from './types';

interface WorkspaceShellProps {
  workspace: Workspace;
}

export function WorkspaceShell({ workspace }: WorkspaceShellProps) {
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
        <div className="empty-state">
          <strong>No categories yet</strong>
          <p>Create a category to start organizing pages.</p>
          <button className="button secondary" type="button">
            Create category
          </button>
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
          <strong>No page selected</strong>
          <p>Select a page to preview draft content and run generation.</p>
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
