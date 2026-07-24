import React from 'react';
import {
  AlertCircle,
  Bot,
  ExternalLink,
  FileText,
  FolderTree,
  MessageSquareText,
  Paperclip,
  Plus,
  Save,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
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
  PageSourceIntent,
  PublishedVersion,
} from '../page/types';
import { readUploadSourceForFile } from '../page/uploadSource';
import { normalizeUrl } from '../page/url';
import {
  PreviewViewportControls,
  PreviewViewportFrame,
  type PreviewViewport,
} from '../page/PreviewViewportFrame';
import {
  defaultWorkspaceAiSettings,
  effortOptionsFor,
  WORKSPACE_LANGUAGE_OPTIONS,
  type WorkspaceAiSettings,
  type WorkspaceAiSettingsService,
} from './aiSettings';
import type { Workspace } from './types';

interface WorkspaceShellProps {
  contentService: ContentService;
  generationService: GenerationService;
  pageContextService: PageContextService;
  workspace: Workspace;
  workspaceAiSettingsService: WorkspaceAiSettingsService;
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

function slugForNodeTitle(title: string, fallback: 'category' | 'page') {
  return (
    title
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
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

function hierarchySlugPathFor(nodes: ContentNode[], node: ContentNode) {
  const path: string[] = [];
  let currentNode: ContentNode | undefined = node;

  while (currentNode) {
    path.unshift(currentNode.slug ?? slugForNodeTitle(currentNode.title, currentNode.type === 'page' ? 'page' : 'category'));
    currentNode = currentNode.parentId
      ? nodes.find((candidate) => candidate.id === currentNode?.parentId)
      : undefined;
  }

  return path;
}

function childContentFor(nodes: ContentNode[], node: ContentNode) {
  return childNodesFor(nodes, node.id).map((child) => {
    const href = `/${hierarchySlugPathFor(nodes, child).map(encodeURIComponent).join('/')}`;

    return {
      href,
      id: child.id,
      slug: child.slug ?? slugForNodeTitle(child.title, child.type === 'page' ? 'page' : 'category'),
      title: child.title,
      type: child.type,
    };
  });
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
    language: version.language,
    localizations: version.localizations,
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
  workspaceAiSettingsService,
}: WorkspaceShellProps) {
  const [nodes, setNodes] = React.useState<ContentNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [pageContext, setPageContext] = React.useState<PageContext | null>(null);
  const [sourceIntent, setSourceIntent] = React.useState<PageSourceIntent>('context');
  const [inputText, setInputText] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [composerError, setComposerError] = React.useState('');
  const [generationJob, setGenerationJob] = React.useState<GenerationJob | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState('');
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [contentNodeForm, setContentNodeForm] = React.useState({ title: '', slug: '' });
  const [isSavingContentNode, setIsSavingContentNode] = React.useState(false);
  const [isDeletingContentNode, setIsDeletingContentNode] = React.useState(false);
  const [aiSettings, setAiSettings] = React.useState<WorkspaceAiSettings>(() =>
    defaultWorkspaceAiSettings(workspace.id),
  );
  const [aiForm, setAiForm] = React.useState({
    apiKey: '',
    effort: '',
    languages: ['en'],
    model: 'grok-4.5',
    provider: 'xai',
  });
  const [aiSettingsError, setAiSettingsError] = React.useState('');
  const [isAiSettingsOpen, setIsAiSettingsOpen] = React.useState(false);
  const [isSavingAiSettings, setIsSavingAiSettings] = React.useState(false);
  const [previewLanguage, setPreviewLanguage] = React.useState('en');
  const [previewViewport, setPreviewViewport] = React.useState<PreviewViewport>('desktop');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedCategory = canCreateChildCategory(selectedNode) ? selectedNode : null;
  const selectedEditableNode = selectedNode;
  const selectedEditableNodeHasChildren = selectedEditableNode
    ? nodes.some((node) => node.parentId === selectedEditableNode.id)
    : false;
  const contentNodeFormIsValid = Boolean(contentNodeForm.title.trim() && contentNodeForm.slug.trim());
  const selectedEditableNodeKind = selectedEditableNode?.type === 'page' ? 'page' : 'category';
  const selectedEditableNodeLabel = selectedEditableNodeKind === 'page' ? 'Page' : 'Category';
  const contentNodeNameInputId = selectedEditableNode
    ? `content-node-name-${selectedEditableNode.id}`
    : 'content-node-name';
  const contentNodeSlugInputId = selectedEditableNode
    ? `content-node-slug-${selectedEditableNode.id}`
    : 'content-node-slug';
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
  const previewLanguageOptions = previewDraft
    ? Array.from(
        new Set([
          previewDraft.language ?? 'en',
          ...Object.keys(previewDraft.localizations ?? {}),
        ]),
      )
    : ['en'];
  const selectedPreviewLanguage = previewLanguageOptions.includes(previewLanguage)
    ? previewLanguage
    : previewLanguageOptions[0] ?? 'en';
  const isGenerating = generationJob?.status === 'queued' || generationJob?.status === 'running';
  const selectionStorageKey = `assisted-cms.selected-node.${workspace.id}`;
  const selectedProviderOption = aiSettings.availableProviders.find(
    (provider) => provider.id === aiForm.provider,
  );
  const effortOptions = effortOptionsFor(
    aiSettings.availableProviders,
    aiForm.provider,
    aiForm.model,
  );

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
    let isMounted = true;
    setAiSettingsError('');

    workspaceAiSettingsService
      .loadSettings(workspace.id)
      .then((loadedSettings) => {
        if (!isMounted) {
          return;
        }

        setAiSettings(loadedSettings);
        setAiForm({
          apiKey: '',
          effort: loadedSettings.effort ?? '',
          languages: loadedSettings.languages,
          model: loadedSettings.model,
          provider: loadedSettings.provider,
        });
      })
      .catch((settingsError) => {
        if (!isMounted) {
          return;
        }

        const fallback = defaultWorkspaceAiSettings(workspace.id);
        setAiSettings(fallback);
        setAiForm({
          apiKey: '',
          effort: fallback.effort ?? '',
          languages: fallback.languages,
          model: fallback.model,
          provider: fallback.provider,
        });
        setAiSettingsError(
          settingsError instanceof Error
            ? settingsError.message
            : 'AI settings could not be loaded.',
        );
      });

    return () => {
      isMounted = false;
    };
  }, [workspace.id, workspaceAiSettingsService]);

  React.useEffect(() => {
    if (!selectedEditableNode) {
      setContentNodeForm({ title: '', slug: '' });
      return;
    }

    setContentNodeForm({
      title: selectedEditableNode.title,
      slug:
        selectedEditableNode.slug ??
        slugForNodeTitle(selectedEditableNode.title, selectedEditableNodeKind),
    });
  }, [
    selectedEditableNode?.id,
    selectedEditableNode?.slug,
    selectedEditableNode?.title,
    selectedEditableNodeKind,
  ]);

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

  React.useEffect(() => {
    if (!previewDraft) {
      setPreviewLanguage('en');
      return;
    }

    const languages = Array.from(
      new Set([previewDraft.language ?? 'en', ...Object.keys(previewDraft.localizations ?? {})]),
    );
    if (!languages.includes(previewLanguage)) {
      setPreviewLanguage(languages[0] ?? 'en');
    }
  }, [previewDraft?.id, previewDraft?.updatedAt, selectedVersionId, previewLanguage]);

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

  async function handleSaveContentNode() {
    if (!selectedEditableNode || !contentNodeFormIsValid) {
      return;
    }

    try {
      setIsSavingContentNode(true);
      setError('');
      const updatedNode = await contentService.updateNode(selectedEditableNode.id, {
        slug: contentNodeForm.slug,
        title: contentNodeForm.title,
      });
      setNodes(await contentService.listNodes(workspace.id));
      setSelectedNodeId(updatedNode.id);
      window.localStorage.setItem(selectionStorageKey, updatedNode.id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : `${selectedEditableNodeLabel} could not be saved.`,
      );
    } finally {
      setIsSavingContentNode(false);
    }
  }

  async function handleDeleteContentNode() {
    if (!selectedEditableNode || selectedEditableNodeHasChildren) {
      return;
    }

    try {
      setIsDeletingContentNode(true);
      setError('');
      const nextSelectedNodeId = selectedEditableNode.parentId;
      await contentService.deleteNode(selectedEditableNode.id);
      const loadedNodes = await contentService.listNodes(workspace.id);
      setNodes(loadedNodes);

      if (nextSelectedNodeId && loadedNodes.some((node) => node.id === nextSelectedNodeId)) {
        handleSelectNode(nextSelectedNodeId);
      } else {
        clearSelection();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : `${selectedEditableNodeLabel} could not be deleted.`,
      );
    } finally {
      setIsDeletingContentNode(false);
    }
  }

  function handleSelectMaterials(files: FileList | null) {
    setPendingFiles(files ? Array.from(files) : []);
    setComposerError('');
  }

  function handlePasteMaterials(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pastedFiles = Array.from(event.clipboardData.files ?? []);
    if (!pastedFiles.length) {
      return;
    }

    setPendingFiles((currentFiles) => [...currentFiles, ...pastedFiles]);
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
          type: 'instruction',
          content: inputText,
          sourceIntent,
        });
      }

      for (const link of links) {
        await pageContextService.addInput({
          pageId: selectedNode.id,
          type: 'link',
          content: link,
          sourceIntent,
        });
      }

      for (const file of pendingFiles) {
        const uploadSource = await readUploadSourceForFile(file);
        await pageContextService.addAsset({
          pageId: selectedNode.id,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          sourceIntent,
          ...uploadSource,
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
        ai: {
          ...(effortOptions.length && aiForm.effort ? { effort: aiForm.effort } : {}),
          languages: aiForm.languages,
          model: aiForm.model,
          provider: aiForm.provider,
        },
        hierarchyPath: hierarchyPathFor(nodes, selectedNode),
        childContent: childContentFor(nodes, selectedNode),
        pageContext: selectedPageContext,
        pageId: selectedNode.id,
        pageTitle: selectedNode.title,
        workspaceId: workspace.id,
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

  function handleAiProviderChange(providerId: string) {
    const provider = aiSettings.availableProviders.find((candidate) => candidate.id === providerId);
    const model = provider?.models[0];

    setAiForm((currentForm) => ({
      ...currentForm,
      effort: model?.supportedEfforts[0] ?? '',
      model: model?.id ?? '',
      provider: providerId,
    }));
    setAiSettingsError('');
  }

  async function handleSaveAiSettings() {
    try {
      setIsSavingAiSettings(true);
      setAiSettingsError('');
      const nextSettings = await workspaceAiSettingsService.saveSettings(workspace.id, {
        ...(aiForm.apiKey.trim() ? { apiKey: aiForm.apiKey.trim() } : {}),
        ...(effortOptions.length && aiForm.effort ? { effort: aiForm.effort } : {}),
        languages: aiForm.languages,
        model: aiForm.model,
        provider: aiForm.provider,
      });
      setAiSettings(nextSettings);
      setAiForm({
        apiKey: '',
        effort: nextSettings.effort ?? '',
        languages: nextSettings.languages,
        model: nextSettings.model,
        provider: nextSettings.provider,
      });
    } catch (settingsError) {
      setAiSettingsError(
        settingsError instanceof Error
          ? settingsError.message
          : 'AI settings could not be saved.',
      );
    } finally {
      setIsSavingAiSettings(false);
    }
  }

  function toggleAiLanguage(language: string) {
    setAiForm((currentForm) => {
      const languages = currentForm.languages.includes(language)
        ? currentForm.languages.filter((candidate) => candidate !== language)
        : [...currentForm.languages, language];

      return {
        ...currentForm,
        languages: languages.length ? languages : currentForm.languages,
      };
    });
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

    window.open(
      `/preview/${encodeURIComponent(selectedNode.id)}?lang=${encodeURIComponent(
        selectedPreviewLanguage,
      )}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  return (
    <>
      <div className="workspace-action-bar">
        <div>
          <span className="eyebrow">Workspace AI</span>
          <strong>{selectedProviderOption?.label ?? aiForm.provider}</strong>
          <small>{aiSettings.hasApiKey ? 'key saved' : 'key required'}</small>
        </div>
        <button
          aria-label="Workspace settings"
          className="icon-button workspace-settings-trigger"
          title="Workspace settings"
          type="button"
          onClick={() => setIsAiSettingsOpen(true)}
        >
          <Settings size={18} />
        </button>
      </div>

      {isAiSettingsOpen ? (
        <div className="settings-overlay" role="presentation">
          <div
            aria-labelledby="workspace-ai-settings-title"
            aria-modal="true"
            className="workspace-settings-dialog"
            role="dialog"
          >
            <div className="settings-dialog-heading">
              <div>
                <span className="eyebrow">Workspace settings</span>
                <h2 id="workspace-ai-settings-title">Workspace AI settings</h2>
              </div>
              <button
                aria-label="Close workspace settings"
                className="icon-button"
                type="button"
                onClick={() => setIsAiSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form
              aria-label="Workspace AI settings form"
              className="ai-settings-panel workspace-ai-settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveAiSettings();
              }}
            >
              <div className="ai-settings-heading">
                <Bot size={16} />
                <strong>AI generation</strong>
                <small>{aiSettings.hasApiKey ? 'key saved' : 'key required'}</small>
              </div>
              <label htmlFor="ai-provider">
                AI provider
                <select
                  id="ai-provider"
                  value={aiForm.provider}
                  onChange={(event) => handleAiProviderChange(event.target.value)}
                >
                  {aiSettings.availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="ai-model">
                AI model
                <input
                  id="ai-model"
                  list={`ai-model-options-${workspace.id}`}
                  type="text"
                  value={aiForm.model}
                  onChange={(event) =>
                    setAiForm((currentForm) => ({
                      ...currentForm,
                      model: event.target.value,
                    }))
                  }
                />
                <datalist id={`ai-model-options-${workspace.id}`}>
                  {selectedProviderOption?.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </datalist>
              </label>
              <label htmlFor="ai-effort">
                Effort
                <select
                  id="ai-effort"
                  disabled={!effortOptions.length}
                  value={effortOptions.length ? aiForm.effort : ''}
                  onChange={(event) =>
                    setAiForm((currentForm) => ({
                      ...currentForm,
                      effort: event.target.value,
                    }))
                  }
                >
                  {effortOptions.length ? (
                    effortOptions.map((effort) => (
                      <option key={effort} value={effort}>
                        {effort}
                      </option>
                    ))
                  ) : (
                    <option value="">Not supported</option>
                  )}
                </select>
              </label>
              <fieldset className="workspace-language-settings">
                <legend>Generation languages</legend>
                <div className="language-checkbox-grid">
                  {WORKSPACE_LANGUAGE_OPTIONS.map((languageOption) => (
                    <label key={languageOption.code} htmlFor={`workspace-language-${languageOption.code}`}>
                      <input
                        checked={aiForm.languages.includes(languageOption.code)}
                        id={`workspace-language-${languageOption.code}`}
                        type="checkbox"
                        value={languageOption.code}
                        onChange={() => toggleAiLanguage(languageOption.code)}
                      />
                      {languageOption.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="workspace-api-key">
                Workspace API key
                <input
                  id="workspace-api-key"
                  autoComplete="off"
                  placeholder={aiSettings.hasApiKey ? 'Saved key is preserved' : 'Paste provider key'}
                  type="password"
                  value={aiForm.apiKey}
                  onChange={(event) =>
                    setAiForm((currentForm) => ({
                      ...currentForm,
                      apiKey: event.target.value,
                    }))
                  }
                />
              </label>
              {aiSettingsError ? (
                <div className="auth-error compact" role="alert">
                  {aiSettingsError}
                </div>
              ) : null}
              <button
                className="button secondary icon-label neutral"
                disabled={!aiForm.provider || !aiForm.model || isSavingAiSettings}
                type="submit"
              >
                <Save size={16} />
                {isSavingAiSettings ? 'Saving AI settings' : 'Save AI settings'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

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
        {selectedEditableNode ? (
          <form
            aria-label={`${selectedEditableNodeLabel} settings`}
            className="category-settings content-node-settings"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveContentNode();
            }}
          >
            <div className="category-settings-heading">
              <strong>{selectedEditableNodeLabel} settings</strong>
              <small>
                {selectedEditableNode.slug ??
                  slugForNodeTitle(selectedEditableNode.title, selectedEditableNodeKind)}
              </small>
            </div>
            <label htmlFor={contentNodeNameInputId}>
              {selectedEditableNodeLabel} name
              <input
                id={contentNodeNameInputId}
                type="text"
                value={contentNodeForm.title}
                onChange={(event) =>
                  setContentNodeForm((currentForm) => ({
                    ...currentForm,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label htmlFor={contentNodeSlugInputId}>
              {selectedEditableNodeLabel} slug
              <input
                id={contentNodeSlugInputId}
                type="text"
                value={contentNodeForm.slug}
                onChange={(event) =>
                  setContentNodeForm((currentForm) => ({
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
                disabled={!contentNodeFormIsValid || isSavingContentNode}
              >
                <Save size={16} />
                {isSavingContentNode ? 'Saving' : `Save ${selectedEditableNodeKind}`}
              </button>
              <button
                className="button secondary icon-label danger"
                type="button"
                disabled={selectedEditableNodeHasChildren || isDeletingContentNode}
                onClick={handleDeleteContentNode}
              >
                <Trash2 size={16} />
                {isDeletingContentNode ? 'Deleting' : `Delete ${selectedEditableNodeKind}`}
              </button>
            </div>
            {selectedEditableNodeHasChildren ? (
              <p className="category-delete-note">
                Delete child items before deleting this {selectedEditableNodeKind}.
              </p>
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
            <div className="preview-toolbar">
              <label className="preview-language-selector" htmlFor="workspace-preview-language">
                Preview language
                <select
                  id="workspace-preview-language"
                  value={selectedPreviewLanguage}
                  onChange={(event) => setPreviewLanguage(event.target.value)}
                >
                  {previewLanguageOptions.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </label>
              <PreviewViewportControls
                viewport={previewViewport}
                onViewportChange={setPreviewViewport}
              />
            </div>
            <PreviewViewportFrame viewport={previewViewport}>
              <PageDraftPreview
                assets={pageContext?.assets ?? []}
                draft={previewDraft}
                editable={!selectedVersion}
                language={selectedPreviewLanguage}
                onDraftChange={handleDraftChange}
              />
            </PreviewViewportFrame>
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
                      <span className={`source-intent-badge ${input.sourceIntent}`}>
                        {input.sourceIntent === 'required' ? 'Must appear' : 'AI context'}
                      </span>
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
                    value={buildEmbedSnippet(activeVersion, selectedPreviewLanguage)}
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
                      <span className={`source-intent-badge ${asset.sourceIntent}`}>
                        {asset.sourceIntent === 'required' ? 'Must appear' : 'AI context'}
                      </span>
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
          <button
            aria-pressed={sourceIntent === 'required'}
            className="source-intent-toggle"
            type="button"
            onClick={() =>
              setSourceIntent((currentIntent) =>
                currentIntent === 'required' ? 'context' : 'required',
              )
            }
          >
            Must appear on page
          </button>
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
            onPaste={handlePasteMaterials}
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
    </>
  );
}
