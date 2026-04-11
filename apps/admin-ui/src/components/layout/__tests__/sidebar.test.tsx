import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../sidebar';

describe('Sidebar', () => {
  it('renders the primary navigation groups', () => {
    render(<Sidebar currentPath="/overview" />);
    expect(screen.getByText('总览')).toBeInTheDocument();
    expect(screen.getByText('运行控制')).toBeInTheDocument();
    expect(screen.getByText('模型管理')).toBeInTheDocument();
    expect(screen.getByText('Agent 管理')).toBeInTheDocument();
    expect(screen.getByText('告警与通知')).toBeInTheDocument();
    expect(screen.getByText('系统')).toBeInTheDocument();
    expect(screen.getByText('宿主机能力')).toBeInTheDocument();
  });
});
