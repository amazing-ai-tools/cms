import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { createLocalAuthService } from './auth/localAuthService';
import './styles.css';

const bugzeroAppKey = import.meta.env.VITE_BUGZERO_APP_KEY || '';
const bugzeroWidgetUrl =
  import.meta.env.VITE_BUGZERO_WIDGET_URL || 'https://bugzero.amazing-ai.tools/widget.js';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const googleCallbackUrl = import.meta.env.VITE_GOOGLE_CALLBACK_URL || window.location.origin;

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

const authService = createLocalAuthService({
  storageKey: `assisted-cms.google-session.${googleClientId || googleCallbackUrl}`,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App authService={authService} />
  </React.StrictMode>,
);
