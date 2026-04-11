import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderForm } from '../provider-form';

const refresh = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh })
}));

describe('ProviderForm', () => {
  beforeEach(() => {
    refresh.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('keeps focus while typing in model id inputs', () => {
    render(<ProviderForm />);

    const firstInput = screen.getAllByLabelText('模型 ID')[0] as HTMLInputElement;
    firstInput.focus();
    expect(firstInput).toHaveFocus();

    fireEvent.change(firstInput, { target: { value: 'g' } });

    const afterFirstChange = screen.getAllByLabelText('模型 ID')[0] as HTMLInputElement;
    expect(afterFirstChange).toHaveFocus();
    expect(afterFirstChange.value).toBe('g');

    fireEvent.change(afterFirstChange, { target: { value: 'gp' } });

    const afterSecondChange = screen.getAllByLabelText('模型 ID')[0] as HTMLInputElement;
    expect(afterSecondChange).toHaveFocus();
    expect(afterSecondChange.value).toBe('gp');
  });

  it('submits multiple models and selected default model in one provider payload', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<ProviderForm />);

    fireEvent.change(screen.getAllByLabelText('供应商标识')[0], { target: { value: 'default' } });
    fireEvent.change(screen.getAllByLabelText('供应商名称')[0], { target: { value: '默认网关' } });
    fireEvent.change(screen.getAllByLabelText('API 请求地址')[0], { target: { value: 'https://proxy.example/v1' } });

    fireEvent.change(screen.getAllByPlaceholderText('gpt-5.4 / codex-5.4 / claude-sonnet-4-5')[0], { target: { value: 'kimi-k2.5' } });
    fireEvent.change(screen.getAllByPlaceholderText('GPT 5.4 / Codex 5.4')[0], { target: { value: 'Kimi K2.5' } });

    fireEvent.click(screen.getAllByRole('button', { name: '新增模型' })[0]);

    fireEvent.change(screen.getAllByPlaceholderText('gpt-5.4 / codex-5.4 / claude-sonnet-4-5')[1], { target: { value: 'codex-5.4' } });
    fireEvent.change(screen.getAllByPlaceholderText('GPT 5.4 / Codex 5.4')[1], { target: { value: 'Codex 5.4' } });

    fireEvent.change(screen.getAllByLabelText('默认模型')[0], { target: { value: 'codex-5.4' } });
    expect(screen.getByText(/当前选择：Codex 5.4 · codex-5.4/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '保存 Provider' })[0]);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, options] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(options?.body || '{}'));

    expect(payload.models).toEqual([
      { id: 'kimi-k2.5', name: 'Kimi K2.5' },
      { id: 'codex-5.4', name: 'Codex 5.4' }
    ]);
    expect(payload.defaultModelId).toBe('codex-5.4');
    expect(payload.modelId).toBe('kimi-k2.5');
    expect(payload.modelName).toBe('Kimi K2.5');
  });
});
