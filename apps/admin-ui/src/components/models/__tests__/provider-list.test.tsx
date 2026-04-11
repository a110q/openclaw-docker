import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderList } from '../provider-list';
import type { ProviderRecord } from '@/lib/types/admin';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh })
}));

const providers: ProviderRecord[] = [
  {
    id: 'default',
    name: '默认网关',
    type: 'openai-compatible',
    baseUrl: 'https://example.com/v1',
    apiKeyMasked: 'sk****1234',
    apiKeyConfigured: true,
    enabled: true,
    isDefault: true,
    modelCount: 1,
    modelId: 'gpt-5.4',
    modelName: 'GPT 5.4',
    defaultModelId: 'gpt-5.4',
    models: [{ id: 'gpt-5.4', name: 'GPT 5.4', capabilities: ['text', 'image'] }],
    websiteUrl: 'https://example.com',
    notes: '默认供应商',
    lastTestStatus: 'unknown'
  },
  {
    id: 'claude',
    name: 'Claude 官方',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKeyMasked: 'sk****abcd',
    apiKeyConfigured: true,
    enabled: true,
    isDefault: false,
    modelCount: 1,
    modelId: 'claude-sonnet-4-5',
    modelName: 'Claude Sonnet 4.5',
    defaultModelId: 'claude-sonnet-4-5',
    models: [{ id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', capabilities: ['text', 'image'] }],
    websiteUrl: 'https://anthropic.com',
    notes: 'Anthropic 官方',
    lastTestStatus: 'unknown'
  }
];

describe('ProviderList', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it('keeps another provider test button available while one test is running', () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { ok: true, status: 200 } }) });

    vi.stubGlobal('fetch', fetchMock);

    render(<ProviderList providers={providers} onEdit={() => undefined} />);

    const buttons = screen.getAllByRole('button', { name: '真实测试' });
    fireEvent.click(buttons[0]);

    expect(screen.getByRole('button', { name: '测试中…' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '真实测试' }).length).toBeGreaterThan(0);

    resolveFirst?.({ ok: true, json: async () => ({ ok: true, data: { ok: true, status: 200 } }) });
  });

  it('renders a note explaining that tests use real api keys and tiny model calls', () => {
    render(<ProviderList providers={providers} onEdit={() => undefined} />);
    expect(screen.getAllByText(/当前“测试”会带真实 API Key 做两段校验/).length).toBeGreaterThan(0);
  });
});
