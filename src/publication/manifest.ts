import type { PublishableAssetManifest, PublishedVersion } from '../page/types';

export const DEFAULT_RENDERER_SCRIPT_URL = 'local://cdn/renderers/assisted-cms-embed.js';

type ManifestSourceVersion = Omit<PublishedVersion, 'manifest'> & {
  manifest?: PublishedVersion['manifest'];
};

export function buildPublishableManifest(version: ManifestSourceVersion): PublishableAssetManifest {
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
    },
    mediaAssets: version.assetManifest,
    cache: {
      immutable: true,
      scope: 'version',
    },
  };
}
