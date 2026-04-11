import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeishuDiscoveryPanel } from '../feishu-discovery-panel';
import type { FeishuDiscoverySnapshot } from '@/lib/types/admin';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>
}));

const snapshot: FeishuDiscoverySnapshot = {
  scannedAt: '2026-04-10T07:00:00.000Z',
  managedAlertChannels: 0,
  botAccounts: 1,
  groupBindings: 1,
  dmBindings: 0,
  warnings: 0,
  items: [
    {
      id: 'account:default',
      kind: 'bot-account',
      source: 'openclaw-config',
      status: 'managed',
      title: 'OpenClaw Bot',
      subtitle: '账号 default',
      metadata: ['默认账号'],
      accountId: 'default',
      enabled: true,
      active: true,
      lastActivityAt: '2026-04-10T07:00:00.000Z',
      recentMessages: [{ occurredAt: '2026-04-10T07:00:00.000Z', text: '你现在是什么模型' }]
    },
    {
      id: 'group:oc_backend_group_id:backend',
      kind: 'group-binding',
      source: 'openclaw-config',
      status: 'managed',
      title: '群通道 · backend',
      subtitle: '群 oc_backend_group_id',
      metadata: ['需 @'],
      agentId: 'backend',
      peerId: 'oc_backend_group_id',
      bindingKind: 'group',
      enabled: true,
      requireMention: true,
      active: false,
      recentMessages: [{ occurredAt: '2026-04-10T06:55:00.000Z', text: '历史消息示例' }]
    }
  ]
};

describe('FeishuDiscoveryPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a 20 second countdown and resets after automatic rescan', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: snapshot })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FeishuDiscoveryPanel initialSnapshot={snapshot} />);

    expect(screen.getByText('20 秒后刷新')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByText('19 秒后刷新')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(19000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('20 秒后刷新')).toBeInTheDocument();
  });

  it('renders activity preview messages in plain text', () => {
    render(<FeishuDiscoveryPanel initialSnapshot={snapshot} />);
    expect(screen.getAllByText('你现在是什么模型').length).toBeGreaterThan(0);
  });

  it('uses faster ticker speed for active messages and slower speed for inactive messages', () => {
    const { container } = render(<FeishuDiscoveryPanel initialSnapshot={snapshot} />);
    const tracks = Array.from(container.querySelectorAll('.activity-ticker-track'));
    expect(tracks).toHaveLength(2);
    expect((tracks[0] as HTMLElement).style.getPropertyValue('--ticker-duration')).toBe('8s');
    expect((tracks[1] as HTMLElement).style.getPropertyValue('--ticker-duration')).toBe('18s');
  });

  it('pauses auto refresh while editing a binding', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: snapshot })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FeishuDiscoveryPanel initialSnapshot={snapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑绑定' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('自动刷新已暂停')).toBeInTheDocument();
  });
});
