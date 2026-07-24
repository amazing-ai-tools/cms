import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';

const DEFAULT_RENDERER_SCRIPT = `
(function () {
  function selectContent(content, language) {
    var selected = language || content.language || 'en';
    var localization = selected !== (content.language || 'en') && content.localizations
      ? content.localizations[selected]
      : null;
    return {
      blocks: localization && localization.blocks ? localization.blocks : content.blocks,
      layout: localization && localization.layout ? localization.layout : content.layout,
      language: selected,
      title: localization && localization.title ? localization.title : content.title,
      visual: localization && localization.visual ? localization.visual : content.visual
    };
  }

  function mediaElement(asset, fallbackText) {
    if (!asset || !asset.cdnUrl) {
      var missing = document.createElement('span');
      missing.textContent = fallbackText;
      return missing;
    }
    if (asset.mimeType && asset.mimeType.indexOf('image/') === 0) {
      var image = document.createElement('img');
      image.alt = asset.filename || fallbackText;
      image.loading = 'lazy';
      image.src = asset.cdnUrl;
      return image;
    }
    if (asset.mimeType && asset.mimeType.indexOf('audio/') === 0) {
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.src = asset.cdnUrl;
      return audio;
    }
    if (asset.mimeType && asset.mimeType.indexOf('video/') === 0) {
      var video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.src = asset.cdnUrl;
      return video;
    }
    var link = document.createElement('a');
    link.download = asset.filename || '';
    link.href = asset.cdnUrl;
    link.textContent = asset.filename || fallbackText;
    return link;
  }

  async function render(script) {
    var target = document.getElementById(script.dataset.targetId || '');
    if (!target) return;
    var response = await fetch(script.dataset.contentUrl);
    if (!response.ok) throw new Error('Embedded content could not be loaded.');
    var content = await response.json();
    var selected = selectContent(content, script.dataset.language);
    var assets = new Map((content.mediaAssets || []).map(function (asset) {
      return [asset.assetId, asset];
    }));
    var article = document.createElement('article');
    article.className = 'assisted-cms-embed ' + selected.visual.spacing;
    article.lang = selected.language;
    article.style.backgroundColor = selected.visual.backgroundColor;
    article.style.color = selected.visual.textColor;
    var heading = document.createElement('h2');
    heading.textContent = selected.title;
    article.appendChild(heading);
    var blocks = new Map((selected.blocks || []).map(function (block) {
      return [block.id, block];
    }));
    (selected.layout.sections || []).forEach(function (section) {
      var sectionElement = document.createElement('section');
      (section.blockIds || []).forEach(function (blockId) {
        var block = blocks.get(blockId);
        if (!block) return;
        var blockElement = document.createElement('article');
        blockElement.className = 'assisted-cms-embed-block ' + block.type + ' ' + block.visual.size;
        blockElement.style.backgroundColor = block.visual.backgroundColor;
        blockElement.style.color = block.visual.textColor;
        if (block.type === 'media') {
          blockElement.appendChild(mediaElement(assets.get(block.assetId), block.content));
        } else if (block.href) {
          var link = document.createElement('a');
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

  var script = document.currentScript;
  window.AssistedCmsEmbed = window.AssistedCmsEmbed || { render: render };
  if (script) render(script).catch(function (error) { console.error(error); });
})();
`;

function safeSegment(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) {
    return null;
  }

  return Buffer.from(match[2], 'base64');
}

function stripPrivateAssetFields(asset) {
  const { sourceContent: _sourceContent, sourceEncoding: _sourceEncoding, ...publicAsset } = asset;
  return publicAsset;
}

function contentTypeFor(pathname) {
  const extension = extname(pathname).toLowerCase();
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function resolveCdnPath(rootDir, pathname) {
  const stripped = pathname.replace(/^\/cdn\/?/, '');
  const resolved = normalize(join(rootDir, stripped));
  const normalizedRoot = normalize(rootDir);
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error('Invalid CDN path.');
  }

  return resolved;
}

export function createFileCdnPublishingService(options = {}) {
  const rootDir = options.rootDir ?? process.env.CDN_ROOT_DIR ?? '/var/lib/cms/cdn';
  const baseUrl = (options.baseUrl ?? process.env.PUBLIC_CDN_BASE_URL ?? 'https://cms.api.amazing-ai.tools/cdn')
    .replace(/\/$/, '');

  async function writePublicFile(relativePath, content) {
    const absolutePath = join(rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }

  return {
    async publishVersion(version) {
      if (!version?.pageId || !version?.versionNumber) {
        throw new Error('Published version payload is required.');
      }

      const pageId = safeSegment(version.pageId);
      const versionNumber = safeSegment(version.versionNumber);
      const mediaUrls = [];
      const publicAssets = [];

      for (const asset of version.assetManifest ?? []) {
        const assetId = safeSegment(asset.assetId);
        const filename = safeSegment(asset.filename);
        const relativePath = `pages/${pageId}/assets/${assetId}/${filename}`;
        const cdnUrl = `${baseUrl}/${relativePath}`;
        const buffer =
          asset.sourceEncoding === 'text'
            ? Buffer.from(asset.sourceContent || '', 'utf8')
            : dataUrlToBuffer(asset.sourceContent) ?? Buffer.from(asset.storageUrl || '', 'utf8');

        await writePublicFile(relativePath, buffer);
        mediaUrls.push(cdnUrl);
        publicAssets.push(
          stripPrivateAssetFields({
            ...asset,
            cdnUrl,
          }),
        );
      }

      const scriptPath = 'renderers/assisted-cms-embed.js';
      const contentPath = `pages/${pageId}/versions/${versionNumber}/content.json`;
      const content = {
        title: version.title,
        blocks: version.contentSnapshot,
        layout: version.layoutSnapshot,
        visual: version.visualSnapshot,
        language: version.language ?? 'en',
        localizations: version.localizations ?? {},
        mediaAssets: publicAssets,
      };

      await writePublicFile(scriptPath, DEFAULT_RENDERER_SCRIPT);
      await writePublicFile(contentPath, `${JSON.stringify(content, null, 2)}\n`);

      return {
        contentUrl: `${baseUrl}/${contentPath}`,
        mediaUrls,
        scriptUrl: `${baseUrl}/${scriptPath}`,
      };
    },

    async readFile(pathname) {
      const absolutePath = resolveCdnPath(rootDir, pathname);
      const body = await readFile(absolutePath);
      return {
        body,
        contentType: contentTypeFor(pathname),
      };
    },
  };
}
