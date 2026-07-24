import type { PublishableAssetManifest, PublishedVersion } from '../page/types';

export const DEFAULT_RENDERER_SCRIPT_URL = 'local://cdn/renderers/assisted-cms-embed.js';

type ManifestSourceVersion = Omit<PublishedVersion, 'manifest'> & {
  manifest?: PublishedVersion['manifest'];
};

function publicAssetReference(asset: PublishedVersion['assetManifest'][number]) {
  const { sourceContent: _sourceContent, sourceEncoding: _sourceEncoding, ...publicAsset } = asset;
  return publicAsset;
}

export function buildPublishableManifest(version: ManifestSourceVersion): PublishableAssetManifest {
  const mediaAssets = version.assetManifest.map(publicAssetReference);

  return {
    pageId: version.pageId,
    versionId: version.id,
    versionNumber: version.versionNumber,
    rendererScriptUrl: version.cdnUrls.script || DEFAULT_RENDERER_SCRIPT_URL,
    content: {
      title: version.title,
      blocks: version.contentSnapshot,
      layout: version.layoutSnapshot,
      visual: version.visualSnapshot,
      seo: version.seo,
      language: version.language ?? 'en',
      localizations: version.localizations ?? {},
      mediaAssets,
    },
    mediaAssets,
    cache: {
      immutable: true,
      scope: 'version',
    },
  };
}
