import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CapabilityConsole } from '../capability-console';
import type { HostCapabilityDefinition } from '@/lib/types/host-capabilities';

const capabilities: HostCapabilityDefinition[] = [
  {
    id: 'host.compose.ps',
    title: '读取 Compose 服务状态',
    description: '读取 Docker Compose 当前服务状态与健康信息。',
    riskLevel: 'read',
    requiresConfirmation: false,
    targetType: 'compose'
  },
  {
    id: 'host.compose.logs',
    title: '读取 Compose 服务日志',
    description: '读取指定服务的最近日志输出。',
    riskLevel: 'read',
    requiresConfirmation: false,
    targetType: 'compose'
  },
  {
    id: 'host.service.recreateGateway',
    title: '重建 Gateway 服务',
    description: '执行 gateway 强制重建，可能短暂影响可用性。',
    riskLevel: 'danger',
    requiresConfirmation: true,
    targetType: 'service'
  }
];

describe('CapabilityConsole', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the capability list and risk confirmation badge', () => {
    render(<CapabilityConsole capabilities={capabilities} />);

    expect(screen.getByRole('button', { name: '读取 Compose 服务状态' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重建 Gateway 服务' })).toBeInTheDocument();
    expect(screen.getByText('需确认')).toBeInTheDocument();
  });

  it('shows preview details after clicking preview', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          capabilityId: 'host.compose.logs',
          title: '读取 Compose 服务日志',
          summary: '读取 openclaw-gateway 最近 50 行日志。',
          impact: 'restart',
          changes: [],
          requiresConfirmation: false,
          riskLevel: 'read'
        }
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CapabilityConsole capabilities={capabilities} />);

    fireEvent.click(screen.getByRole('button', { name: '读取 Compose 服务日志' }));
    fireEvent.click(screen.getByRole('button', { name: '预览变更' }));

    await waitFor(() => {
      expect(screen.getByText('读取 openclaw-gateway 最近 50 行日志。')).toBeInTheDocument();
    });
  });

  it('requires confirmation before executing dangerous capabilities', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<CapabilityConsole capabilities={capabilities} />);

    fireEvent.click(screen.getByRole('button', { name: '重建 Gateway 服务' }));
    fireEvent.click(screen.getByRole('button', { name: '执行能力' }));

    expect(screen.getByText('确认执行高风险能力')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
