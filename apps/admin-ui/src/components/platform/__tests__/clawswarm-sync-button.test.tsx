import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClawSwarmSyncButton } from '../clawswarm-sync-button';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('ClawSwarmSyncButton', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it('posts sync action and refreshes page on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { summary: '已同步 1 个实例，ClawSwarm 通讯录已刷新。' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ClawSwarmSyncButton />);

    fireEvent.click(screen.getByRole('button', { name: '强制同步运行时' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/v1/clawswarm/sync', { method: 'POST' });
    });
    expect(await screen.findByText('已同步 1 个实例，ClawSwarm 通讯录已刷新。')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
