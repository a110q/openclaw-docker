import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmActionDialog } from '../confirm-action-dialog';

describe('ConfirmActionDialog', () => {
  it('renders dialog copy and fires confirm/cancel callbacks', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmActionDialog
        open
        title="删除 Agent"
        description="删除后将移出当前纳管列表。"
        confirmLabel="确认删除"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByText('删除 Agent')).toBeInTheDocument();
    expect(screen.getByText('删除后将移出当前纳管列表。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
