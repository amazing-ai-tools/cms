import type { PublishedVersion, PublishableAssetManifest } from '../page/types';
import type { CdnService } from '../publication/cdn';

interface RenderEmbedFromCdnInput {
  cdnService: CdnService;
  contentUrl: string;
  language?: string;
  target: HTMLElement;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function baseLanguageFor(version: PublishedVersion) {
  return version.language ?? version.manifest.content.language ?? 'en';
}

export function buildEmbedSnippet(version: PublishedVersion, language = baseLanguageFor(version)) {
  const targetId = `assisted-cms-${version.pageId}`;
  const scriptUrl = escapeAttribute(version.cdnUrls.script);
  const contentUrl = escapeAttribute(version.cdnUrls.content);
  const pageId = escapeAttribute(version.pageId);
  const selectedLanguage = escapeAttribute(language);

  return [
    `<div id="${targetId}" data-assisted-cms-page="${pageId}" data-language="${selectedLanguage}"></div>`,
    `<script async src="${scriptUrl}" data-page-id="${pageId}" data-target-id="${targetId}" data-content-url="${contentUrl}" data-language="${selectedLanguage}"></script>`,
  ].join('\n');
}

function contentForLanguage(content: PublishableAssetManifest['content'], language?: string) {
  const selectedLanguage = language || content.language || 'en';
  const localization =
    selectedLanguage !== (content.language ?? 'en') ? content.localizations?.[selectedLanguage] : null;

  return {
    blocks: localization?.blocks ?? content.blocks,
    layout: localization?.layout ?? content.layout,
    language: selectedLanguage,
    seo: localization?.seo ?? content.seo,
    title: localization?.title ?? content.title,
    visual: localization?.visual ?? content.visual,
  };
}

function appendSeoMetadata(
  article: HTMLElement,
  content: ReturnType<typeof contentForLanguage>,
) {
  if (!content.seo) {
    return;
  }

  article.setAttribute('aria-label', content.seo.title);
  article.setAttribute('data-seo-title', content.seo.title);
  article.setAttribute('data-seo-description', content.seo.description);
  article.setAttribute('data-seo-keywords', content.seo.keywords.join(', '));

  const jsonLd = document.createElement('script');
  jsonLd.type = 'application/ld+json';
  jsonLd.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    description: content.seo.description,
    inLanguage: content.language,
    keywords: content.seo.keywords.join(', '),
    name: content.seo.title,
  });
  article.appendChild(jsonLd);
}

function mediaElementFor(
  asset: PublishableAssetManifest['content']['mediaAssets'][number] | undefined,
  fallbackText: string,
) {
  if (!asset?.cdnUrl) {
    const missing = document.createElement('span');
    missing.textContent = fallbackText;
    return missing;
  }

  if (asset.mimeType.startsWith('image/')) {
    const image = document.createElement('img');
    image.alt = asset.filename;
    image.loading = 'lazy';
    image.src = asset.cdnUrl;
    return image;
  }

  if (asset.mimeType.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = asset.cdnUrl;
    return audio;
  }

  if (asset.mimeType.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.src = asset.cdnUrl;
    return video;
  }

  const link = document.createElement('a');
  link.download = asset.filename;
  link.href = asset.cdnUrl;
  link.textContent = asset.filename;
  return link;
}

function blockFontWeight(block: PublishableAssetManifest['content']['blocks'][number]) {
  if (block.visual.fontWeight === 'bold') {
    return '700';
  }

  if (block.visual.fontWeight === 'semibold') {
    return '600';
  }

  return '400';
}

export async function renderEmbedFromCdn({
  cdnService,
  contentUrl,
  language,
  target,
}: RenderEmbedFromCdnInput) {
  const content = await cdnService.readJson<PublishableAssetManifest['content']>(contentUrl);
  if (!content) {
    throw new Error('Embedded content could not be loaded from CDN.');
  }
  const localizedContent = contentForLanguage(content, language);

  const article = document.createElement('article');
  article.className = `assisted-cms-embed ${localizedContent.visual.spacing}`;
  article.lang = localizedContent.language;
  article.style.backgroundColor = localizedContent.visual.backgroundColor;
  article.style.color = localizedContent.visual.textColor;
  appendSeoMetadata(article, localizedContent);

  const heading = document.createElement('h1');
  heading.textContent = localizedContent.title;
  article.appendChild(heading);

  const blocksById = new Map(localizedContent.blocks.map((block) => [block.id, block]));
  const mediaAssetsById = new Map((content.mediaAssets ?? []).map((asset) => [asset.assetId, asset]));
  localizedContent.layout.sections.forEach((section) => {
    const sectionElement = document.createElement('section');
    if (section.title) {
      const sectionHeading = document.createElement('h2');
      sectionHeading.textContent = section.title;
      sectionElement.appendChild(sectionHeading);
    }
    section.blockIds.forEach((blockId) => {
      const block = blocksById.get(blockId);
      if (!block) {
        return;
      }

      const blockElement = document.createElement('article');
      blockElement.className = `assisted-cms-embed-block ${block.type} ${block.visual.size}`;
      blockElement.style.backgroundColor = block.visual.backgroundColor;
      blockElement.style.color = block.visual.textColor;
      blockElement.style.fontWeight = blockFontWeight(block);
      blockElement.style.textAlign = block.visual.textAlign ?? 'left';
      if (block.type === 'media') {
        blockElement.appendChild(mediaElementFor(mediaAssetsById.get(block.assetId ?? ''), block.content));
      } else if (block.href) {
        const link = document.createElement('a');
        link.href = block.href;
        link.textContent = block.content;
        blockElement.appendChild(link);
      } else {
        blockElement.textContent = block.content;
      }
      sectionElement.appendChild(blockElement);
    });
    article.appendChild(sectionElement);
  });

  target.replaceChildren(article);
}
