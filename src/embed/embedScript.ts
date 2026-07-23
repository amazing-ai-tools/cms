import type { PublishedVersion, PublishableAssetManifest } from '../page/types';
import type { CdnService } from '../publication/cdn';

interface RenderEmbedFromCdnInput {
  cdnService: CdnService;
  contentUrl: string;
  target: HTMLElement;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function buildEmbedSnippet(version: PublishedVersion) {
  const targetId = `assisted-cms-${version.pageId}`;
  const scriptUrl = escapeAttribute(version.cdnUrls.script);
  const contentUrl = escapeAttribute(version.cdnUrls.content);
  const pageId = escapeAttribute(version.pageId);

  return [
    `<div id="${targetId}" data-assisted-cms-page="${pageId}"></div>`,
    `<script async src="${scriptUrl}" data-page-id="${pageId}" data-target-id="${targetId}" data-content-url="${contentUrl}"></script>`,
  ].join('\n');
}

export async function renderEmbedFromCdn({
  cdnService,
  contentUrl,
  target,
}: RenderEmbedFromCdnInput) {
  const content = await cdnService.readJson<PublishableAssetManifest['content']>(contentUrl);
  if (!content) {
    throw new Error('Embedded content could not be loaded from CDN.');
  }

  const article = document.createElement('article');
  article.className = `assisted-cms-embed ${content.visual.spacing}`;
  article.style.backgroundColor = content.visual.backgroundColor;
  article.style.color = content.visual.textColor;

  const heading = document.createElement('h2');
  heading.textContent = content.title;
  article.appendChild(heading);

  const blocksById = new Map(content.blocks.map((block) => [block.id, block]));
  content.layout.sections.forEach((section) => {
    const sectionElement = document.createElement('section');
    section.blockIds.forEach((blockId) => {
      const block = blocksById.get(blockId);
      if (!block) {
        return;
      }

      const blockElement = document.createElement('article');
      blockElement.className = `assisted-cms-embed-block ${block.type} ${block.visual.size}`;
      blockElement.style.backgroundColor = block.visual.backgroundColor;
      blockElement.style.color = block.visual.textColor;
      blockElement.textContent = block.content;
      sectionElement.appendChild(blockElement);
    });
    article.appendChild(sectionElement);
  });

  target.replaceChildren(article);
}
