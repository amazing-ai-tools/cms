import http from 'node:http';
import { createAiGenerationService } from './aiGenerationService.js';
import { createFileWorkspaceAiSettingsStore } from './workspaceAiSettingsStore.js';

const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024;

function corsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    ...corsHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function workspaceSettingsMatch(pathname) {
  const match = pathname.match(/^\/api\/workspaces\/([^/]+)\/ai-settings$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createGenerationServer(options = {}) {
  const settingsStore =
    options.settingsStore ??
    createFileWorkspaceAiSettingsStore({
      filePath: process.env.AI_WORKSPACE_SETTINGS_FILE,
    });
  const generationService =
    options.generationService ?? createAiGenerationService({ settingsStore });

  return http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');

    try {
      if (request.method === 'GET' && url.pathname === '/healthz') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }

      const workspaceId = workspaceSettingsMatch(url.pathname);
      if (workspaceId && request.method === 'GET') {
        sendJson(response, 200, await settingsStore.getPublicSettings(workspaceId));
        return;
      }

      if (workspaceId && request.method === 'PUT') {
        const body = await readJsonBody(request);
        sendJson(response, 200, await settingsStore.saveSettings(workspaceId, body));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/generation/draft') {
        const body = await readJsonBody(request);
        const result = await generationService.generateDraft(body);
        sendJson(response, result.job.status === 'failed' ? 503 : 200, result);
        return;
      }

      sendJson(response, 404, { error: 'Not found.' });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Request failed.',
      });
    }
  });
}
