/**
 * @file Unit tests for PermissionCard — renders details and handles Allow/Deny clicks.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionCard } from './PermissionCard';

describe('PermissionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders permission details', () => {
    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{ command: 'ls -la' }}
        onReply={() => {}}
      />,
    );

    expect(screen.getByText('Run bash command')).toBeInTheDocument();
    expect(screen.getByText('Type: bash')).toBeInTheDocument();
  });

  it('calls onReply with allow=true when Allow is clicked', () => {
    const onReply = vi.fn();

    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{}}
        onReply={onReply}
      />,
    );

    fireEvent.click(screen.getByText('Allow'));
    expect(onReply).toHaveBeenCalledWith('perm-1', true);
  });

  it('calls onReply with allow=false when Deny is clicked', () => {
    const onReply = vi.fn();

    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{}}
        onReply={onReply}
      />,
    );

    fireEvent.click(screen.getByText('Deny'));
    expect(onReply).toHaveBeenCalledWith('perm-1', false);
  });
});
