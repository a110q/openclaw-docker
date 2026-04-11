import { describe, expect, test } from 'vitest';
import {
  appendVersionedPath,
  buildChatHttpRequest,
  normalizeProviderKind,
  type ChatMessageDraft,
} from '../platform-chat';

const messages: ChatMessageDraft[] = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好，我在。' },
  { role: 'user', content: '给我一句总结' },
];

describe('normalizeProviderKind', () => {
  test('maps built-in provider api to provider kind', () => {
    expect(normalizeProviderKind('default', 'openai-completions')).toBe('openai-compatible');
    expect(normalizeProviderKind('claude', 'anthropic-messages')).toBe('anthropic');
    expect(normalizeProviderKind('gemini', 'google-generative-ai')).toBe('gemini');
    expect(normalizeProviderKind('ollama', 'openai-completions')).toBe('ollama');
  });
});

describe('appendVersionedPath', () => {
  test('keeps existing version path for openai-compatible endpoints', () => {
    expect(appendVersionedPath('http://127.0.0.1:8327/v1', '/chat/completions')).toBe('http://127.0.0.1:8327/v1/chat/completions');
  });

  test('adds missing version path for anthropic and gemini endpoints', () => {
    expect(appendVersionedPath('https://api.anthropic.com', '/v1/messages')).toBe('https://api.anthropic.com/v1/messages');
    expect(appendVersionedPath('https://generativelanguage.googleapis.com', '/v1beta/models/gemini-2.5-pro:generateContent')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    );
  });
});

describe('buildChatHttpRequest', () => {
  test('builds openai-compatible chat request', () => {
    const request = buildChatHttpRequest({
      providerKind: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:8327/v1',
      apiKey: 'sk-demo',
      modelId: 'gpt-5.4',
      messages,
    });

    expect(request.url).toBe('http://127.0.0.1:8327/v1/chat/completions');
    expect(request.init.method).toBe('POST');
    expect(request.init.headers).toMatchObject({ Authorization: 'Bearer sk-demo' });
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      model: 'gpt-5.4',
      messages,
    });
  });

  test('builds anthropic request with anthropic headers', () => {
    const request = buildChatHttpRequest({
      providerKind: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'anthropic-demo',
      modelId: 'claude-sonnet-4-5',
      messages,
    });

    expect(request.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request.init.headers).toMatchObject({
      'x-api-key': 'anthropic-demo',
      'anthropic-version': '2023-06-01',
    });
    expect(JSON.parse(String(request.init.body))).toMatchObject({
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好，我在。' },
        { role: 'user', content: '给我一句总结' },
      ],
    });
  });

  test('builds gemini request with generateContent endpoint', () => {
    const request = buildChatHttpRequest({
      providerKind: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: 'gemini-demo',
      modelId: 'gemini-2.5-pro',
      messages,
    });

    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=gemini-demo');
    const payload = JSON.parse(String(request.init.body));
    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: '你好' }] },
      { role: 'model', parts: [{ text: '你好，我在。' }] },
      { role: 'user', parts: [{ text: '给我一句总结' }] },
    ]);
  });
});
