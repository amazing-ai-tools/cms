import { embeddedPageDraftSchema } from './pageDraftSchema.js';

function jsonSchemaFormat() {
  return {
    name: 'embedded_page_draft',
    schema: embeddedPageDraftSchema,
    type: 'json_schema',
  };
}

function assertOk(response, provider) {
  if (!response.ok) {
    throw new Error(`${provider} API returned ${response.status}.`);
  }
}

function extractOpenAiText(body) {
  if (typeof body.output_text === 'string') {
    return body.output_text;
  }

  const outputItems = Array.isArray(body.output) ? body.output : [];
  for (const item of outputItems) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const contentItem of content) {
      if (typeof contentItem.text === 'string') {
        return contentItem.text;
      }
      if (typeof contentItem.output_text === 'string') {
        return contentItem.output_text;
      }
    }
  }

  return '';
}

function extractAnthropicText(body) {
  const content = Array.isArray(body.content) ? body.content : [];
  const textBlock = content.find((block) => block?.type === 'text' && typeof block.text === 'string');
  return textBlock?.text ?? '';
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('AI provider returned an empty response.');
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function generateWithOpenAi({ apiKey, effort, fetcher, model, prompt }) {
  const body = {
    input: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    max_output_tokens: 4096,
    model,
    ...(effort ? { reasoning: { effort } } : {}),
    text: {
      format: jsonSchemaFormat(),
    },
  };
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  assertOk(response, 'OpenAI');
  return extractJson(extractOpenAiText(await response.json()));
}

export async function generateWithXai({ apiKey, fetcher, model, prompt }) {
  const body = {
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    model,
    response_format: {
      json_schema: {
        name: 'embedded_page_draft',
        schema: embeddedPageDraftSchema,
      },
      type: 'json_schema',
    },
    temperature: 0.55,
  };
  const response = await fetcher('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  assertOk(response, 'xAI');
  const json = await response.json();
  return extractJson(json.choices?.[0]?.message?.content);
}

export async function generateWithAnthropic({ apiKey, effort, fetcher, model, prompt }) {
  const body = {
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt.user }],
    model,
    output_config: {
      ...(effort ? { effort } : {}),
      format: jsonSchemaFormat(),
    },
    system: prompt.system,
    ...(effort ? { thinking: { type: 'adaptive' } } : {}),
  };
  const response = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  assertOk(response, 'Anthropic');
  return extractJson(extractAnthropicText(await response.json()));
}

export function providerAdapterFor(provider) {
  if (provider === 'openai') {
    return generateWithOpenAi;
  }

  if (provider === 'anthropic') {
    return generateWithAnthropic;
  }

  return generateWithXai;
}
