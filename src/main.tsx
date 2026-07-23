import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { createGoogleAuthService } from './auth/googleAuthService';
import { createLocalContentService } from './content/localContentService';
import { createRemoteGenerationService } from './generation/remoteGenerationService';
import { createLocalPageContextService } from './page/localPageContextService';
import { createLocalWorkspaceService } from './workspace/localWorkspaceService';
import { createRemoteWorkspaceAiSettingsService } from './workspace/remoteWorkspaceAiSettingsService';
import './styles.css';

const bugzeroAppKey = import.meta.env.VITE_BUGZERO_APP_KEY || '';
const bugzeroWidgetUrl =
  import.meta.env.VITE_BUGZERO_WIDGET_URL || 'https://bugzero.amazing-ai.tools/widget.js';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleCallbackUrl = import.meta.env.VITE_GOOGLE_CALLBACK_URL || window.location.origin;
const productionApiBaseUrl =
  window.location.hostname === 'cms.app.amazing-ai.tools' ? 'https://cms.api.amazing-ai.tools' : '';
const workspaceAiSettingsApiBaseUrl =
  import.meta.env.VITE_AI_SETTINGS_API_BASE_URL || productionApiBaseUrl;
const generationApiUrl =
  import.meta.env.VITE_GENERATION_API_URL ||
  `${workspaceAiSettingsApiBaseUrl || ''}/api/generation/draft`;

function ensureBugZeroWidget() {
  if (!bugzeroAppKey || document.querySelector('script[data-bugzero-widget]')) {
    return;
  }

  const script = document.createElement('script');
  script.src = bugzeroWidgetUrl;
  script.async = true;
  script.dataset.bugzeroWidget = 'true';
  script.dataset.appKey = bugzeroAppKey;
  document.body.appendChild(script);
}

ensureBugZeroWidget();

const authService = createGoogleAuthService({
  clientId: googleClientId,
  storageKey: `assisted-cms.google-session.${googleClientId || googleCallbackUrl}`,
});
const workspaceService = createLocalWorkspaceService({
  storageKey: `assisted-cms.workspaces.${googleClientId || googleCallbackUrl}`,
});
const contentService = createLocalContentService({
  storageKey: `assisted-cms.content.${googleClientId || googleCallbackUrl}`,
});
const pageContextService = createLocalPageContextService();
const generationService = createRemoteGenerationService({
  endpoint: generationApiUrl,
});
const workspaceAiSettingsService = createRemoteWorkspaceAiSettingsService({
  baseUrl: workspaceAiSettingsApiBaseUrl,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      authService={authService}
      contentService={contentService}
      generationService={generationService}
      pageContextService={pageContextService}
      workspaceAiSettingsService={workspaceAiSettingsService}
      workspaceService={workspaceService}
    />
  </React.StrictMode>,
);
