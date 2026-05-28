/**
 * @file Unit tests for ForkConfirmDialog — session and message fork confirmation.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForkConfirmDialog } from './ForkConfirmDialog';

describe('ForkConfirmDialog', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <ForkConfirmDialog visible={false} mode="session" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders session fork dialog when visible with session mode', () => {
    render(
      <ForkConfirmDialog visible={true} mode="session" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('Fork Session')).toBeInTheDocument();
    expect(screen.getByText(/This will create a copy of the entire session/)).toBeInTheDocument();
  });

  it('renders message fork dialog when visible with message mode', () => {
    render(
      <ForkConfirmDialog visible={true} mode="message" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText('Fork from Message')).toBeInTheDocument();
    expect(
      screen.getByText(/This will create a copy of the session up to this message/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The message content will be restored to the input box/),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when Fork button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ForkConfirmDialog visible={true} mode="session" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('Fork'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ForkConfirmDialog visible={true} mode="session" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ForkConfirmDialog visible={true} mode="session" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    const overlay = container.querySelector('.confirm-overlay')!;
    fireEvent.click(overlay);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn();
    render(
      <ForkConfirmDialog visible={true} mode="session" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
